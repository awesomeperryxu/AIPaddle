// V12-4.3 / V12-4.4 / PRD v1.13 §7.3：Tool Binding 的配置校验。
//
// 这不是「格式检查」，是**安全边界**。PRD §7.3 对每类 Binding 都规定了强制要求：
//   API —— 域名白名单、Secret 服务端保存、超时、重试、响应过滤
//   DB  —— 只读账号、库表白名单、select-only、行数限制、字段脱敏
// 少一条，那类 Binding 就成了任意 HTTP 请求器 / 任意 SQL 执行器。
//
// 🔴 键名一律 snake_case，与 0029_tools.sql 中 tool_versions.binding_config 的
// 注释逐字对齐。这块是 jsonb 直存直取，没有 mapRow 做转换——校验器输出什么形状，
// 库里就是什么形状。用 camelCase 会让那段表注释变成谎言。
//
// 🔴 这里只放非敏感配置。凭证值一律经 credential_id 引用 credentials 表，绝不内联。

export class BindingConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'BindingConfigError' }
}

const asStringList = (v: unknown, lower = false): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && !!x.trim())
       .map((x) => (lower ? x.trim().toLowerCase() : x.trim()))
    : []

// ── API Binding（V12-4.3）──────────────────────────────────────────────

export type ApiBindingConfig = {
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  operation_id?: string
  allowed_hosts: string[]
  timeout_ms: number
  retry: number
  response_filter: string[]
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

export function assertApiBinding(raw: unknown): ApiBindingConfig {
  const c = (raw ?? {}) as Record<string, unknown>

  const endpoint = String(c.endpoint ?? '').trim()
  if (!endpoint) throw new BindingConfigError('接口地址不能为空')
  let url: URL
  try { url = new URL(endpoint) } catch { throw new BindingConfigError(`接口地址无效：${endpoint}`) }

  // 🔴 只允许 https。API Binding 必然带凭证，http 明文传输等于凭证在网络上裸奔。
  // 本地调试请用隧道，不要为图方便放宽这条。
  if (url.protocol !== 'https:') {
    throw new BindingConfigError('接口地址必须是 https —— API 调用会携带凭证，http 明文传输等于凭证裸奔')
  }

  const method = String(c.method ?? 'GET').toUpperCase()
  if (!(HTTP_METHODS as readonly string[]).includes(method)) {
    throw new BindingConfigError(`HTTP 方法无效（只能是 ${HTTP_METHODS.join(' / ')}）`)
  }

  // 🔴 域名白名单：空 = 拒绝一切，不是放行一切。与 Extension 的 Origin 白名单同一取向。
  // 否则一个配错的 Tool 就能被提示注入引导去请求任意内网地址（SSRF）。
  const allowedHosts = asStringList(c.allowed_hosts, true)
  if (allowedHosts.length === 0) {
    throw new BindingConfigError('必须配置域名白名单——留空意味着可请求任意地址，存在 SSRF 风险')
  }
  if (allowedHosts.some((h) => h === '*' || h.startsWith('*'))) {
    throw new BindingConfigError('域名白名单不接受通配符')
  }
  // endpoint 的 host 必须在白名单内，否则白名单形同虚设
  if (!allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new BindingConfigError(`接口地址的域名 ${url.hostname} 不在白名单内`)
  }

  const timeoutMs = c.timeout_ms === undefined ? 10_000 : c.timeout_ms
  if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120_000) {
    throw new BindingConfigError('超时须为 1000~120000 之间的整数（毫秒）')
  }
  const retry = c.retry === undefined ? 1 : c.retry
  if (typeof retry !== 'number' || !Number.isInteger(retry) || retry < 0 || retry > 3) {
    throw new BindingConfigError('重试次数须为 0~3 之间的整数')
  }

  return {
    endpoint,
    method: method as ApiBindingConfig['method'],
    ...(typeof c.operation_id === 'string' && c.operation_id.trim()
      ? { operation_id: c.operation_id.trim() } : {}),
    allowed_hosts: allowedHosts,
    timeout_ms: timeoutMs,
    retry,
    // 响应过滤：只回传列出的字段。空 = 不过滤（与白名单不同，
    // 过滤是「减少泄露面」的优化，不是安全边界，默认放行不会造成越权）
    response_filter: asStringList(c.response_filter),
  }
}

// ── DB Binding（V12-4.4）───────────────────────────────────────────────

export type DbBindingConfig = {
  query_template: string
  param_schema: Record<string, unknown>
  allowed_tables: string[]
  select_only: true
  max_rows: number
  mask_fields: string[]
}

/** 只读语句的开头。CTE（with）也允许，但下面会再查其中有无写操作。 */
const READONLY_START = /^\s*(select|with)\b/i

/**
 * 把 SQL 里的**注释删掉、字符串/引号标识符的内容抹白**，只留下可执行结构。
 * 后续所有 select-only 检查都跑在它的输出上。
 *
 * 🔴 为什么必须逐字符扫而不能用正则：
 * 最初这里是两条正则（剥行注释 + 剥块注释），实测被这条绕过——
 *
 *     select '--' as a from t; drop table customers
 *
 * `--` 在单引号内对 Postgres 不是注释，但正则当它是，于是把本行剩下的
 * `; drop table customers` 一起吃掉，分号检查与关键字检查都扫了个空，
 * 而存进库的是含 drop 的原文。要判断 `--` 是不是注释，就必须知道
 * 当前在不在字符串里——这是正则做不到的。
 *
 * 🔴 遇到未闭合的引号一律抛错（fail closed）。解析不了的东西不放行。
 */
export function stripSqlNoise(sql: string): string {
  let out = ''
  let i = 0
  const n = sql.length

  while (i < n) {
    const ch = sql[i]
    const next = sql[i + 1]

    // 行注释 -- ... 到行尾
    if (ch === '-' && next === '-') {
      while (i < n && sql[i] !== '\n') i++
      out += ' '
      continue
    }
    // 块注释 /* ... */，Postgres 允许嵌套
    if (ch === '/' && next === '*') {
      let depth = 1
      i += 2
      while (i < n && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') { depth++; i += 2 }
        else if (sql[i] === '*' && sql[i + 1] === '/') { depth--; i += 2 }
        else i++
      }
      if (depth > 0) throw new BindingConfigError('查询模板中有未闭合的块注释')
      out += ' '
      continue
    }
    // 美元引用 $tag$ ... $tag$
    const dollar = ch === '$' ? /^\$[A-Za-z_]\w*\$|^\$\$/.exec(sql.slice(i)) : null
    if (dollar) {
      const tag = dollar[0]
      const end = sql.indexOf(tag, i + tag.length)
      if (end === -1) throw new BindingConfigError('查询模板中有未闭合的美元引用')
      out += " '' "   // 内容抹白
      i = end + tag.length
      continue
    }
    // 单引号字符串 / 双引号标识符：内容抹白，'' 与 "" 视为转义
    if (ch === "'" || ch === '"') {
      const q = ch
      i++
      let closed = false
      while (i < n) {
        if (sql[i] === q) {
          if (sql[i + 1] === q) { i += 2; continue }  // '' 转义
          i++; closed = true; break
        }
        i++
      }
      // 🔴 未闭合 = 解析不了 = 拒绝。不解析反斜杠转义（E'\'' 之类会落到这里被拒），
      // 宁可误拒一个合法查询，也不放过一个我读不懂的
      if (!closed) throw new BindingConfigError('查询模板中有未闭合的引号')
      out += q === "'" ? " '' " : ' "x" '
      continue
    }
    out += ch
    i++
  }
  return out
}

/**
 * 写操作与危险语句。用 \b 词边界匹配，避免把 `selected_at` 里的 select 之类误判。
 * 这份清单宁可宽 —— 多拦一个合法查询只是麻烦，漏放一个写操作是数据被改。
 */
const FORBIDDEN_SQL = [
  'insert', 'update', 'delete', 'drop', 'truncate', 'alter', 'create',
  'grant', 'revoke', 'merge', 'call', 'do', 'copy', 'vacuum', 'analyze',
  'pg_read_file', 'pg_write_file', 'pg_sleep', 'dblink', 'lo_import', 'lo_export',
]

export function assertDbBinding(raw: unknown): DbBindingConfig {
  const c = (raw ?? {}) as Record<string, unknown>

  const queryTemplate = String(c.query_template ?? '').trim()
  if (!queryTemplate) throw new BindingConfigError('查询模板不能为空')

  // 🔴 select-only（PRD §7.3）。四道检查缺一不可：
  //   ① 抹掉注释与字符串内容（见 stripSqlNoise，那里有踩过的坑）
  //   ② 必须以 select / with 开头
  //   ③ 不得有分号后续语句（防 `select 1; select 2` 这类无违禁词的多语句）
  //   ④ 不得含写操作关键字（CTE 里藏 `with x as (delete ...)` 靠这条拦）
  //
  // ⚠️ 这是**纵深防御的一层，不是唯一一层**。PRD §7.3 同时要求 DB Binding
  // 必须绑定**只读数据库账号**——数据库侧的权限才是最终防线。文本校验能被
  // 足够刁钻的构造绕过（本文件就真的被绕过过一次），只读账号不能。两者都要有。
  const stripped = stripSqlNoise(queryTemplate)

  if (!READONLY_START.test(stripped)) {
    throw new BindingConfigError('查询模板必须以 SELECT 或 WITH 开头——DB Binding 只允许只读查询')
  }
  const withoutTrailing = stripped.replace(/;\s*$/, '')
  if (withoutTrailing.includes(';')) {
    throw new BindingConfigError('查询模板不得包含多条语句（分号）——防止在只读查询后追加写操作')
  }
  const lowered = withoutTrailing.toLowerCase()
  for (const kw of FORBIDDEN_SQL) {
    if (new RegExp(`\\b${kw}\\b`).test(lowered)) {
      throw new BindingConfigError(`查询模板不得包含「${kw}」——DB Binding 只允许只读查询`)
    }
  }

  // 🔴 库表白名单：空 = 拒绝，同域名白名单的取向
  const allowedTables = asStringList(c.allowed_tables, true)
  if (allowedTables.length === 0) {
    throw new BindingConfigError('必须配置库表白名单——留空意味着可查询任意表')
  }

  const maxRows = c.max_rows === undefined ? 100 : c.max_rows
  if (typeof maxRows !== 'number' || !Number.isInteger(maxRows) || maxRows < 1 || maxRows > 1000) {
    throw new BindingConfigError('行数上限须为 1~1000 之间的整数——单次返回过多数据既慢又容易把敏感信息整批带出')
  }

  return {
    query_template: queryTemplate,   // 存原文（含注释），执行前再走一次本校验
    param_schema: (c.param_schema && typeof c.param_schema === 'object' && !Array.isArray(c.param_schema))
      ? c.param_schema as Record<string, unknown> : {},
    allowed_tables: allowedTables,
    // 常量 true：这个字段不接受外部传入的 false。留成可配开关，
    // 迟早有人为了「临时跑个 update」把它关掉，然后忘了打开。
    select_only: true,
    max_rows: maxRows,
    mask_fields: asStringList(c.mask_fields),
  }
}

// ── OpenAPI 导入（V12-4.3 · AC-02）─────────────────────────────────────

export type DerivedTool = {
  name: string
  displayName: string
  description: string
  deprecated: boolean
  bindingConfig: ApiBindingConfig
}

/**
 * 定出 baseUrl。用真实规范试过之后加的——起初直接取 servers[0].url，
 * 碰到两种非常常见的写法就废了：
 *
 *   ① 相对地址 `"url": "/v1"`（Petstore 官方规范就是这么写的）
 *      → 原来报「接口地址无效：/v1/pets」，用户根本不知道该干什么
 *   ② 模板变量 `"url": "https://{region}.api.example.com"`（AWS/Azure 常见）
 *      → 原来报「域名 {region}.api.example.com 不在白名单内」，同样莫名其妙
 *
 * 现在：模板变量按规范用 variables[].default 展开；仍是相对地址的，
 * 明确要求调用方补一个绝对地址，而不是抛个看不懂的解析错误。
 */
function resolveBaseUrl(d: Record<string, unknown>, override?: string): string {
  const ov = (override ?? '').trim()
  if (ov) {
    try {
      const u = new URL(ov)
      if (u.protocol !== 'https:') throw new BindingConfigError('接口基地址必须是 https')
      return ov.replace(/\/+$/, '')
    } catch (e) {
      if (e instanceof BindingConfigError) throw e
      throw new BindingConfigError(`接口基地址无效：${ov}`)
    }
  }

  const servers = Array.isArray(d.servers) ? (d.servers as Record<string, unknown>[]) : []
  const first = servers[0]
  const raw = typeof first?.url === 'string' ? first.url.trim() : ''
  if (!raw) {
    throw new BindingConfigError('OpenAPI 文档缺少 servers[0].url，请另行提供接口基地址')
  }

  // 模板变量按 OpenAPI 规范用 default 展开
  const vars = (first?.variables ?? {}) as Record<string, { default?: unknown }>
  const expanded = raw.replace(/\{([^}]+)\}/g, (m, key: string) => {
    const dv = vars[key]?.default
    return typeof dv === 'string' && dv ? dv : m
  })

  if (/\{[^}]+\}/.test(expanded)) {
    throw new BindingConfigError(
      `servers[0].url 含未定义默认值的变量（${expanded}），请另行提供接口基地址`,
    )
  }
  if (!/^https?:\/\//i.test(expanded)) {
    // 相对地址：文档本身不含域名，只能由用户补
    throw new BindingConfigError(
      `servers[0].url 是相对地址（${expanded}），文档中没有域名信息，请另行提供接口基地址`,
    )
  }
  return expanded.replace(/\/+$/, '')
}

/**
 * 从 OpenAPI 文档按 operation 拆出 Tool（AC-02：一个 Plugin 提供多个 Tool）。
 *
 * 只做解析，**不执行任何请求** —— 导入阶段碰网络会让「导入」和「连通性测试」
 * 两件事混在一起，出错时分不清是文档写错了还是服务不通。连通性测试是 V12-4.5。
 */
export function deriveToolsFromOpenApi(
  doc: unknown,
  allowedHosts: string[],
  baseUrlOverride?: string,
): DerivedTool[] {
  const d = (doc ?? {}) as Record<string, unknown>
  if (!d.paths || typeof d.paths !== 'object' || Array.isArray(d.paths)) {
    throw new BindingConfigError('OpenAPI 文档缺少 paths')
  }
  const paths = d.paths as Record<string, Record<string, unknown>>

  const hosts = asStringList(allowedHosts, true)
  if (hosts.length === 0) throw new BindingConfigError('导入前必须先配置域名白名单')

  const baseUrl = resolveBaseUrl(d, baseUrlOverride)

  const out: DerivedTool[] = []
  const seen = new Set<string>()

  for (const [p, item] of Object.entries(paths)) {
    if (!item || typeof item !== 'object') continue
    for (const m of HTTP_METHODS) {
      const op = item[m.toLowerCase()] as Record<string, unknown> | undefined
      if (!op || typeof op !== 'object') continue

      // 工具名优先取 operationId；缺失时由 method+path 生成，保证稳定可复现
      const rawName = typeof op.operationId === 'string' && op.operationId.trim()
        ? op.operationId.trim()
        : `${m.toLowerCase()}_${p.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '')}`
      // 同名去重：OpenAPI 不保证 operationId 唯一，但 Tool 在同 Plugin 下有唯一索引，
      // 撞名会让整批导入在中途 23505 失败，前面的已经写进去了——半成品最难收拾
      let name = rawName.slice(0, 64)
      for (let i = 2; seen.has(name); i++) name = `${rawName.slice(0, 58)}_${i}`
      seen.add(name)

      // path 里的 {id} 占位符原样保留，由调用方在运行时替换。
      // 字符串拼接而非 URL 拼接：URL 会把 {} 转义成 %7B%7D，就认不出是占位符了。
      // （assertApiBinding 内部用 new URL 解析仍然正常——它只取 hostname/protocol，
      //   返回的是原始字符串，不是 url.href）
      const endpoint = `${baseUrl}${p.startsWith('/') ? p : '/' + p}`

      // 已废弃的 operation 照常导入，但在描述里点出来。
      // 不静默跳过——文档标了 deprecated 不代表接口已经关掉，少导一个
      // 用户会以为是 bug；也不假装正常——导进来的东西得让人知道是什么成色
      const deprecated = op.deprecated === true
      const desc = typeof op.description === 'string' ? op.description : ''

      out.push({
        name,
        displayName: typeof op.summary === 'string' && op.summary.trim() ? op.summary.trim() : name,
        description: deprecated ? `[文档标记为已废弃] ${desc}`.trim() : desc,
        deprecated,
        bindingConfig: assertApiBinding({
          endpoint,
          method: m,
          operation_id: op.operationId,
          allowed_hosts: hosts,
        }),
      })
    }
  }

  if (out.length === 0) throw new BindingConfigError('OpenAPI 文档中没有可导入的 operation')
  return out
}
