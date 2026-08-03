import 'server-only'
import { Client } from 'pg'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { getCredentialPlaintext, getCredentialById } from '@/lib/data/credentials'
import {
  assertApiBinding, assertDbBinding, assertSmtpBinding, BindingConfigError,
} from '@/lib/plugins/binding'
import { guardedFetch, NetGuardError } from '@/lib/tools/net-guard'
import { runHandler } from '@/lib/tools/handlers'

// GAP-1：Agent 对话中**带参数的真实 Tool 调用**。
//
// 与 lib/tools/invoke.ts 的分工：
//   invoke.ts  —— 连通性探测（probeOnly）：不带业务参数、不产生副作用，给「测试」按钮用
//   run.ts     —— 真调用：带 LLM 给出的参数，会产生真实副作用
// 刻意分成两个文件而不是加一个 boolean：两者的风险等级差一个数量级，
// 混在一起时「探测」和「真发」只差一个参数，太容易在某次改动里传错。

export type ToolRunResult = {
  ok: boolean
  /** 回给模型的内容。失败时也要可读——模型需要据此决定重试还是换路 */
  content: string
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}

/** 可被 Agent 调用的 Tool（已解析到具体版本） */
export type RunnableTool = {
  toolId: string
  versionId: string
  name: string
  description: string
  bindingType: string
  riskLevel: 'low' | 'medium' | 'high'
  inputSchema: Record<string, unknown>
}

/**
 * 取某 Agent 可用的 Tool。
 *
 * 🔴 只取 **status='published'** 的 Tool 及其**已发布版本**。
 * 草稿/待审/已下线的一律不给——Tool 白名单就是用发布状态表达的（V12-4.2），
 * 这里若放宽，那套治理就形同虚设。
 */
export async function listAgentTools(
  ctx: RequestContext,
  toolIds: string[],
): Promise<RunnableTool[]> {
  if (toolIds.length === 0) return []
  const supabase = await createClient()

  const { data: tools } = await supabase.from('tools')
    .select('id,name,display_name,description,binding_type,risk_level')
    .in('id', toolIds).eq('org_id', ctx.orgId)
    .eq('status', 'published').is('deleted_at', null)
  if (!tools || tools.length === 0) return []

  const { data: versions } = await supabase.from('tool_versions')
    .select('id,tool_id,input_schema,created_at')
    .in('tool_id', tools.map((t) => t.id))
    .eq('org_id', ctx.orgId).eq('status', 'published').is('deleted_at', null)
    .order('created_at', { ascending: false })

  // 每个 Tool 取最新的已发布版本
  const latest = new Map<string, { id: string; input_schema: unknown }>()
  for (const v of versions ?? []) {
    if (!latest.has(v.tool_id)) latest.set(v.tool_id, { id: v.id, input_schema: v.input_schema })
  }

  const out: RunnableTool[] = []
  for (const t of tools) {
    const v = latest.get(t.id)
    // 没有已发布版本的 Tool 直接跳过：拿不到 binding_config，给模型也调不通
    if (!v) continue
    out.push({
      toolId: t.id, versionId: v.id,
      name: t.name,
      description: t.display_name ? `${t.display_name}${t.description ? '：' + t.description : ''}` : (t.description ?? t.name),
      bindingType: t.binding_type,
      riskLevel: (t.risk_level ?? 'low') as RunnableTool['riskLevel'],
      inputSchema: obj(v.input_schema),
    })
  }
  return out
}

/** 把 {{name}} / :name 形式的占位符按参数替换 */
function fillTemplate(tpl: string, args: Record<string, unknown>, quote: (v: unknown) => string): string {
  return tpl
    .replace(/\{\{\s*([A-Za-z_]\w*)\s*\}\}/g, (m, k: string) => (k in args ? quote(args[k]) : m))
    .replace(/:([A-Za-z_]\w*)/g, (m, k: string) => (k in args ? quote(args[k]) : m))
}

/**
 * 真实调用一个 Tool 版本。
 *
 * 🔴 与探测一样，调用期重新校验存库配置——存量配置可能早于校验规则。
 */
export async function runToolVersion(
  ctx: RequestContext,
  versionId: string,
  args: Record<string, unknown>,
): Promise<ToolRunResult> {
  const supabase = await createClient()
  const { data: v } = await supabase.from('tool_versions')
    .select('id,binding_config,credential_id,status,tools(binding_type,status)')
    .eq('id', versionId).eq('org_id', ctx.orgId).is('deleted_at', null).maybeSingle()
  if (!v) return { ok: false, content: '工具不存在或无权访问' }

  const row = v as unknown as {
    binding_config: unknown; credential_id: string | null; status: string
    tools?: { binding_type?: string; status?: string }
  }
  // 🔴 调用期再查一次发布状态：装载与调用之间可能隔了很久，
  // 期间 Tool 可能已被下线（V12-3.6 的下线阻断就是为这个场景设计的）
  if (row.status !== 'published' || row.tools?.status !== 'published') {
    return { ok: false, content: '该工具已下线，无法调用' }
  }

  try {
    switch (row.tools?.binding_type) {
      case 'api': return await runApi(ctx, row.binding_config, row.credential_id, args)
      case 'db': return await runDb(ctx, row.binding_config, row.credential_id, args)
      case 'smtp': return await runSmtp(ctx, row.binding_config, row.credential_id, args)
      case 'native': {
        const cfg = obj(row.binding_config)
        const secret = row.credential_id ? await getCredentialPlaintext(ctx, row.credential_id) : null
        const r = await runHandler({
          handlerId: cfg.handler_id, config: { ...cfg, ...args }, secret, probeOnly: false,
        })
        return { ok: r.ok, content: r.message + (r.detail ? `\n${JSON.stringify(r.detail)}` : '') }
      }
      default:
        return { ok: false, content: `暂不支持调用「${row.tools?.binding_type ?? '未知'}」类型的工具` }
    }
  } catch (e) {
    if (e instanceof BindingConfigError) return { ok: false, content: `工具配置不合法：${e.message}` }
    if (e instanceof NetGuardError) return { ok: false, content: e.message }
    // 🔴 内部异常只回收敛结论：这段内容会进模型上下文，堆栈既没用又可能带出内部路径
    return { ok: false, content: '工具调用失败' }
  }
}

async function runApi(
  ctx: RequestContext, cfgRaw: unknown, credentialId: string | null, args: Record<string, unknown>,
): Promise<ToolRunResult> {
  const cfg = assertApiBinding(cfgRaw)
  const headers: Record<string, string> = { accept: 'application/json' }
  if (credentialId) {
    const secret = await getCredentialPlaintext(ctx, credentialId)
    if (!secret) return { ok: false, content: '工具凭证不可用' }
    headers.authorization = secret.startsWith('Bearer ') ? secret : `Bearer ${secret}`
  }

  // path 里的 {id} 用参数替换；替换后仍要过白名单（guardedFetch 内部会查）
  const endpoint = fillTemplate(cfg.endpoint, args, (x) => encodeURIComponent(String(x)))
  const isBodyMethod = cfg.method !== 'GET' && cfg.method !== 'DELETE'
  if (isBodyMethod) headers['content-type'] = 'application/json'

  const res = await guardedFetch(endpoint, cfg.allowed_hosts, {
    method: cfg.method,
    headers,
    ...(isBodyMethod ? { body: JSON.stringify(args) } : {}),
    timeoutMs: cfg.timeout_ms,
  })
  const text = await res.text().catch(() => '')
  // 回给模型的内容截断：一个超长响应会把上下文挤爆，反而让回答变差
  const body = text.slice(0, 4000)
  return {
    ok: res.ok,
    content: res.ok ? body : `调用返回 HTTP ${res.status}：${body.slice(0, 300)}`,
  }
}

async function runDb(
  ctx: RequestContext, cfgRaw: unknown, credentialId: string | null, args: Record<string, unknown>,
): Promise<ToolRunResult> {
  const cfg = assertDbBinding(cfgRaw)   // 调用期重校验 select-only
  if (!credentialId) return { ok: false, content: '该查询工具未绑定数据库凭证' }
  const conn = await getCredentialPlaintext(ctx, credentialId)
  if (!conn) return { ok: false, content: '数据库凭证不可用' }

  const client = new Client({
    connectionString: conn, connectionTimeoutMillis: 8000, statement_timeout: 15_000,
  } as ConstructorParameters<typeof Client>[0])

  try {
    await client.connect()
    await client.query('set session characteristics as transaction read only')

    // 🔴 参数用 $1/$2 占位传给 pg，**不做字符串拼接**——拼接就是 SQL 注入。
    // 模板里的 :name 按出现顺序转成 $n，值单独作为参数数组传入。
    const names: string[] = []
    const sql = cfg.query_template.replace(/;\s*$/, '')
      .replace(/:([A-Za-z_]\w*)/g, (_m, k: string) => {
        names.push(k)
        return `$${names.length}`
      })
    const values = names.map((k) => args[k] ?? null)

    const wrapped = `select * from (${sql}) as _t limit ${cfg.max_rows + 1}`
    const r = await client.query(wrapped, values)
    const truncated = r.rows.length > cfg.max_rows
    const mask = new Set(cfg.mask_fields.map((f) => f.toLowerCase()))
    const rows = (truncated ? r.rows.slice(0, cfg.max_rows) : r.rows).map((row) => {
      const o: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(row as Record<string, unknown>)) {
        o[k] = mask.has(k.toLowerCase()) && val != null ? '***' : val
      }
      return o
    })
    return {
      ok: true,
      content: JSON.stringify(rows)
        + (truncated ? `\n（已达 ${cfg.max_rows} 行上限，结果被截断，实际数据更多）` : ''),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, content: `查询失败：${msg.replace(/postgres(ql)?:\/\/[^\s]*/gi, '(连接串已隐去)')}` }
  } finally {
    await client.end().catch(() => {})
  }
}

async function runSmtp(
  ctx: RequestContext, cfgRaw: unknown, credentialId: string | null, args: Record<string, unknown>,
): Promise<ToolRunResult> {
  const cfg = assertSmtpBinding(cfgRaw)
  if (!credentialId) return { ok: false, content: '该发信工具未绑定 SMTP 凭证' }
  const [secret, cred] = await Promise.all([
    getCredentialPlaintext(ctx, credentialId),
    getCredentialById(ctx, credentialId),
  ])
  if (!secret) return { ok: false, content: 'SMTP 凭证不可用' }

  // 🔴 收件人不取模型给的参数，只用配置里的白名单。
  // 让模型决定发给谁，等于把「向任意地址发信」的能力交给提示词——
  // 一次提示注入就能把内部信息发到站外。模型只能填主题与正文。
  const r = await runHandler({
    handlerId: 'smtp.send_mail',
    config: {
      ...cfg,
      subject_template: fillTemplate(cfg.subject_template, args, (x) => String(x)),
      body_template: fillTemplate(cfg.body_template, args, (x) => String(x)),
      _credential_meta: cred?.meta ?? {},
    },
    secret,
    probeOnly: false,
  })
  return { ok: r.ok, content: r.message }
}
