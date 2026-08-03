import 'server-only'
import { Client } from 'pg'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { getCredentialPlaintext, getCredentialById } from '@/lib/data/credentials'
import { assertApiBinding, assertDbBinding, assertSmtpBinding, BindingConfigError } from '@/lib/plugins/binding'
import { guardedFetch, assertOutboundAllowed, NetGuardError } from '@/lib/tools/net-guard'
import { runHandler } from '@/lib/tools/handlers'

// V12-4.5 / AC-01：Tool 的真实调用。
//
// 🔴 调用期必须重新校验存库的 binding_config，不能信「写进去时校验过」：
// 回填脚本、迁移、以及任何早于校验规则的存量数据，都可能绕过 assertApiBinding。
// 重新校验的代价是几微秒，漏掉的代价是拿一条没人审过的配置去发真实请求。

export type ToolTestResult = {
  ok: boolean
  message: string
  /** 面向人的诊断信息，绝不含凭证 */
  detail?: Record<string, unknown>
  /** 结果被 max_rows 截断（DB 专用，承接 V12-4.4 未尽项） */
  truncated?: boolean
  elapsedMs: number
}

const now = () => Date.now()

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}

/** 统一收口错误：把内部异常翻成可读结论，且不外泄凭证与堆栈 */
function fail(message: string, started: number, detail?: Record<string, unknown>): ToolTestResult {
  return { ok: false, message, detail, elapsedMs: now() - started }
}

// ── API Binding ────────────────────────────────────────────────────────

async function testApi(
  ctx: RequestContext,
  cfgRaw: unknown,
  credentialId: string | null,
  started: number,
): Promise<ToolTestResult> {
  const cfg = assertApiBinding(cfgRaw)   // 🔴 调用期重校验

  const headers: Record<string, string> = { accept: 'application/json' }
  if (credentialId) {
    const secret = await getCredentialPlaintext(ctx, credentialId)
    if (!secret) return fail('凭证不可用（不存在／已停用／已过期／解密失败）', started)
    // 用完即弃：只在此处进 header，不落任何变量之外的地方
    headers.authorization = secret.startsWith('Bearer ') ? secret : `Bearer ${secret}`
  }

  // 🔴 连通性测试一律用 GET 探测，哪怕 Tool 声明的是 POST/DELETE。
  // 否则「测一下通不通」会在对方系统里建出真实数据、甚至删掉东西。
  // 代价是 GET 与实际方法的鉴权/路由可能不同，测通不等于该方法可用——
  // 这一点在 detail.note 里明说，不让人误以为验证了写路径。
  const res = await guardedFetch(cfg.endpoint, cfg.allowed_hosts, {
    method: 'GET',
    headers,
    timeoutMs: cfg.timeout_ms,
  })

  const bodyText = await res.text().catch(() => '')
  return {
    ok: res.ok,
    message: res.ok
      ? `连通（HTTP ${res.status}）`
      : `目标返回 HTTP ${res.status}`,
    detail: {
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      // 只回前 200 字符，且这是对方的响应，不含我方凭证
      bodyPreview: bodyText.slice(0, 200),
      note: cfg.method !== 'GET'
        ? `该 Tool 声明为 ${cfg.method}，连通性测试仅以 GET 探测，未验证 ${cfg.method} 路径本身`
        : undefined,
    },
    elapsedMs: now() - started,
  }
}

// ── DB Binding ─────────────────────────────────────────────────────────

/** 脱敏：把 mask_fields 里列出的字段值替换掉，不改字段名 */
function maskRow(row: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  if (fields.length === 0) return row
  const lower = new Set(fields.map((f) => f.toLowerCase()))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = lower.has(k.toLowerCase()) && v != null ? '***' : v
  }
  return out
}

async function testDb(
  ctx: RequestContext,
  cfgRaw: unknown,
  credentialId: string | null,
  started: number,
): Promise<ToolTestResult> {
  const cfg = assertDbBinding(cfgRaw)   // 🔴 调用期重校验 select-only

  if (!credentialId) {
    return fail('未绑定数据库凭证——DB Binding 必须绑定一个**只读账号**的连接串', started)
  }
  const conn = await getCredentialPlaintext(ctx, credentialId)
  if (!conn) return fail('凭证不可用（不存在／已停用／已过期／解密失败）', started)

  // 🔴 这里**刻意不套用** net-guard 的私网 IP 黑名单。
  //
  // 那套黑名单是给 API/MCP 出站用的：目标由 Tool 配置决定，而 Tool 配置可能被
  // 提示注入或低权限用户影响，所以要拦住指向内网的请求。
  // DB Binding 不一样——它的典型用途**就是**连企业内网数据库（10.x / 192.168.x），
  // 照搬黑名单等于把这个功能直接废掉。
  //
  // DB 侧的防线是另外三层，且都比 IP 黑名单更贴题：
  //   ① 连接串是 credentials 表里管理员维护的，不由 Tool 配置随意指定
  //   ② 会话强制 read only（见下），且要求凭证本身是只读账号
  //   ③ select-only 文本校验 + 行数上限 + 语句超时
  let host = ''
  try {
    const u = new URL(conn)
    host = u.hostname
  } catch {
    return fail('数据库连接串格式无效', started)
  }

  const client = new Client({
    connectionString: conn,
    // 云托管 PG 基本都要求 TLS；自签证书场景由连接串自带 sslmode 参数控制
    connectionTimeoutMillis: 8000,
    // 🔴 语句超时兜底：select-only 挡得住写操作，挡不住一条扫全表的慢查询
    statement_timeout: 10_000,
  } as ConstructorParameters<typeof Client>[0])

  try {
    await client.connect()

    // 🔴 只读会话：即便凭证误用了可写账号，这里也让本次连接不能写。
    // 这是纵深防御的第二层——第一层是 select-only 文本校验，
    // 第三层（也是最该有的那层）是凭证本身就用只读账号。
    await client.query('set session characteristics as transaction read only')

    // 取 max_rows + 1 条：多出来那条只用于判断「是否被截断」，不返回。
    // 这样既落实了行数上限（承接 V12-4.4 未尽项），又能如实告诉用户结果不完整
    const wrapped = `select * from (${cfg.query_template.replace(/;\s*$/, '')}) as _probe limit ${cfg.max_rows + 1}`
    const r = await client.query(wrapped)

    const truncated = r.rows.length > cfg.max_rows
    const rows = (truncated ? r.rows.slice(0, cfg.max_rows) : r.rows)
      .map((row) => maskRow(row as Record<string, unknown>, cfg.mask_fields))

    return {
      ok: true,
      truncated,
      message: truncated
        ? `连通，返回 ${cfg.max_rows} 行（已达上限，结果被截断——实际数据更多）`
        : `连通，返回 ${rows.length} 行`,
      detail: {
        host,
        rowCount: rows.length,
        maxRows: cfg.max_rows,
        columns: r.fields?.map((f) => f.name) ?? [],
        maskedFields: cfg.mask_fields,
        // 只回前 3 行做样例，已脱敏
        sample: rows.slice(0, 3),
      },
      elapsedMs: now() - started,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // 🔴 连接串里带密码，异常信息可能把它带出来——只回收敛后的结论
    return fail(`数据库调用失败：${msg.replace(/postgres(ql)?:\/\/[^\s]*/gi, '(连接串已隐去)')}`, started)
  } finally {
    await client.end().catch(() => {})
  }
}

// ── MCP Binding ────────────────────────────────────────────────────────

async function testMcp(
  ctx: RequestContext,
  pluginVersion: { transport: string | null; remote_url: string | null; command: string | null },
  credentialId: string | null,
  started: number,
): Promise<ToolTestResult> {
  const transport = (pluginVersion.transport ?? '').toLowerCase()

  // 🔴 stdio 传输：平台**不执行**它。
  // command 是一条来自数据库的任意字符串（真实数据里如 `npx -y firecrawl-mcp`）。
  // 从 Web 应用里 spawn 它 = 任何有 plugin:create 权限的人都能远程执行代码。
  // 这不是「暂未实现」，是不该实现——要跑 stdio MCP，得放在独立的、
  // 有沙箱与白名单的执行器进程里，那是另一个任务。
  if (transport === 'stdio' || (!pluginVersion.remote_url && pluginVersion.command)) {
    return fail(
      'stdio 传输的 MCP Server 无法从平台直接调用——command 是数据库里的任意字符串，' +
      '由 Web 应用执行等于任意代码执行。需改用 HTTP 传输，或部署独立的沙箱执行器。',
      started,
      { transport: transport || '(未声明)', hasCommand: true },
    )
  }

  const url = pluginVersion.remote_url
  if (!url) return fail('该 MCP Server 未配置 remote_url，无法发起调用', started)

  let host: string
  try { host = new URL(url).hostname } catch { return fail(`remote_url 无效：${url}`, started) }

  // MCP 的远端地址没有独立白名单字段，用它自身的域名作为唯一允许项——
  // 仍然要过 IP 解析检查（内网地址一样拦）
  await assertOutboundAllowed(url, [host])

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  }
  if (credentialId) {
    const secret = await getCredentialPlaintext(ctx, credentialId)
    if (!secret) return fail('凭证不可用（不存在／已停用／已过期／解密失败）', started)
    headers.authorization = secret.startsWith('Bearer ') ? secret : `Bearer ${secret}`
  }

  // MCP 标准的 JSON-RPC：tools/list 是最轻的只读探测
  const res = await guardedFetch(url, [host], {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    timeoutMs: 15_000,
  })

  const text = await res.text().catch(() => '')
  if (!res.ok) {
    return fail(`MCP Server 返回 HTTP ${res.status}`, started, { bodyPreview: text.slice(0, 200) })
  }
  let toolCount: number | undefined
  try {
    const j = JSON.parse(text) as { result?: { tools?: unknown[] } }
    toolCount = j.result?.tools?.length
  } catch { /* 可能是 SSE 流，非致命 */ }

  return {
    ok: true,
    message: toolCount === undefined
      ? `连通（HTTP ${res.status}），但响应不是标准 JSON-RPC，无法统计工具数`
      : `连通，该 Server 暴露 ${toolCount} 个工具`,
    detail: { host, status: res.status, toolCount, bodyPreview: text.slice(0, 200) },
    elapsedMs: now() - started,
  }
}

// ── 对外入口 ───────────────────────────────────────────────────────────

/**
 * 对某个 Tool 版本发起一次真实的连通性调用。
 * 只做只读探测：API 用 GET、DB 用 select、MCP 用 tools/list。
 */
export async function testToolVersion(
  ctx: RequestContext,
  toolVersionId: string,
): Promise<ToolTestResult> {
  const started = now()
  const supabase = await createClient()

  const { data: v } = await supabase.from('tool_versions')
    .select('id,binding_config,credential_id,tool_id,tools(binding_type,plugin_id)')
    .eq('id', toolVersionId).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  if (!v) return fail('Tool 版本不存在或无权访问', started)

  const row = v as unknown as {
    binding_config: unknown
    credential_id: string | null
    tools?: { binding_type?: string; plugin_id?: string }
  }
  const bindingType = row.tools?.binding_type ?? ''

  try {
    switch (bindingType) {
      case 'api':
        return await testApi(ctx, row.binding_config, row.credential_id, started)
      case 'db':
        return await testDb(ctx, row.binding_config, row.credential_id, started)
      case 'mcp': {
        const { data: pv } = await supabase.from('plugin_versions')
          .select('transport,remote_url,command')
          .eq('plugin_id', row.tools?.plugin_id ?? '')
          .eq('org_id', ctx.orgId).is('deleted_at', null)
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (!pv) return fail('该 Plugin 没有版本记录，缺少连接信息', started)
        return await testMcp(ctx, pv as never, row.credential_id, started)
      }
      case 'smtp': {
        // V12-4.9。SMTP 的连接参数在凭证 meta 里（非敏感），密码在密文列。
        // 两者都要取：只有密码没有 host 是连不上的
        const cfg = assertSmtpBinding(row.binding_config)   // 🔴 调用期重校验
        if (!row.credential_id) {
          return fail('未绑定 SMTP 凭证——host/port/user 存凭证 meta，密码存密文列', started)
        }
        const [secret, cred] = await Promise.all([
          getCredentialPlaintext(ctx, row.credential_id),
          getCredentialById(ctx, row.credential_id),
        ])
        if (!secret) return fail('凭证不可用（不存在／已停用／已过期／解密失败）', started)
        const r = await runHandler({
          handlerId: 'smtp.send_mail',
          config: { ...cfg, _credential_meta: cred?.meta ?? {} },
          secret, probeOnly: true,
        })
        return { ok: r.ok, message: r.message, detail: r.detail, elapsedMs: now() - started }
      }
      case 'native': {
        // V12-4.7：内置 Handler（企微等）。probeOnly=true——连通性测试不产生真实副作用，
        // 否则「点一下测试」会让所有成员收到一条消息
        const cfg = obj(row.binding_config)
        const secret = row.credential_id
          ? await getCredentialPlaintext(ctx, row.credential_id)
          : null
        const r = await runHandler({
          handlerId: cfg.handler_id, config: cfg, secret, probeOnly: true,
        })
        return { ok: r.ok, message: r.message, detail: r.detail, elapsedMs: now() - started }
      }
      default:
        return fail(`Binding 类型「${bindingType || '未知'}」暂不支持连通性测试`, started)
    }
  } catch (e) {
    // 🔴 校验类与网络类异常都翻成可读结论；其余一律收敛，不把堆栈捅到前端
    if (e instanceof BindingConfigError) {
      return fail(`配置未通过校验（存量配置可能早于当前规则）：${e.message}`, started)
    }
    if (e instanceof NetGuardError) return fail(e.message, started)
    return fail('调用失败', started)
  }
}
