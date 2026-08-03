import { lookup as dnsLookup } from 'node:dns/promises'

// V12-4.5：出站请求的 SSRF 防线。
//
// 🔴 配置期的域名白名单**不足以**在调用期保证安全，理由有三：
//   ① 存量配置可能早于校验规则（回填脚本、迁移直接写库，都绕过了 assertApiBinding）
//   ② DNS rebinding：白名单里的域名完全可以解析到 127.0.0.1 或 169.254.169.254
//   ③ HTTP 重定向：目标站回一个 302 指向内网，跟着跳就出去了
// 所以调用期必须重新解析、重新判断，且绝不自动跟随重定向。

export class NetGuardError extends Error {
  constructor(message: string) { super(message); this.name = 'NetGuardError' }
}

/** 转成 32 位无符号整数便于比较网段 */
function v4ToInt(ip: string): number | null {
  const p = ip.split('.')
  if (p.length !== 4) return null
  let n = 0
  for (const s of p) {
    if (!/^\d{1,3}$/.test(s)) return null
    const v = Number(s)
    if (v > 255) return null
    n = (n << 8) | v
  }
  return n >>> 0
}

const V4_BLOCKED: [string, number, number][] = [
  ['本机回环', 0x7f000000, 8],        // 127.0.0.0/8
  ['未指定地址', 0x00000000, 8],       // 0.0.0.0/8
  ['私有网段', 0x0a000000, 8],         // 10.0.0.0/8
  ['运营商级 NAT', 0x64400000, 10],    // 100.64.0.0/10
  ['链路本地/云元数据', 0xa9fe0000, 16], // 169.254.0.0/16 —— 含 169.254.169.254
  ['私有网段', 0xac100000, 12],        // 172.16.0.0/12
  ['IETF 协议专用', 0xc0000000, 24],   // 192.0.0.0/24
  ['私有网段', 0xc0a80000, 16],        // 192.168.0.0/16
  ['基准测试网段', 0xc6120000, 15],     // 198.18.0.0/15
  ['组播', 0xe0000000, 4],             // 224.0.0.0/4
  ['保留', 0xf0000000, 4],             // 240.0.0.0/4
]

/** 判断某个已解析的 IP 是否属于禁止直连的范围；返回原因或 null */
export function blockedIpReason(ip: string): string | null {
  const addr = ip.trim().toLowerCase()

  // IPv4-mapped IPv6（::ffff:127.0.0.1）要按其内嵌的 v4 判断，
  // 否则用这种写法就能绕过整张 v4 黑名单
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr)
  const v4 = mapped ? mapped[1] : addr

  const n = v4ToInt(v4)
  if (n !== null) {
    for (const [reason, base, bits] of V4_BLOCKED) {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
      if ((n & mask) === (base & mask)) return reason
    }
    return null
  }

  // IPv6
  if (addr === '::1' || addr === '::') return '本机回环'
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return '唯一本地地址'   // fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(addr)) return '链路本地'        // fe80::/10
  if (/^ff/.test(addr)) return '组播'
  return null
}

/** 域名 → IP。抽成参数是为了可测——直接吃 node:dns 会让这层根本没法写单测。 */
export type Resolver = (host: string) => Promise<string>

const defaultResolver: Resolver = async (host) => (await dnsLookup(host)).address

/**
 * 调用前校验目标 URL：协议、域名白名单、解析后的 IP。
 * 返回解析到的 IP（调用方可据此记录/复用）。
 */
export async function assertOutboundAllowed(
  rawUrl: string,
  allowedHosts: string[],
  resolver: Resolver = defaultResolver,
): Promise<{ host: string; ip: string }> {
  let u: URL
  try { u = new URL(rawUrl) } catch { throw new NetGuardError(`目标地址无效：${rawUrl}`) }

  if (u.protocol !== 'https:') throw new NetGuardError('只允许 https 出站')

  const host = u.hostname.toLowerCase()
  const allow = allowedHosts.map((h) => h.trim().toLowerCase()).filter(Boolean)
  if (allow.length === 0) throw new NetGuardError('未配置域名白名单，拒绝出站')
  if (!allow.includes(host)) throw new NetGuardError(`域名 ${host} 不在白名单内`)

  // 🔴 白名单里的域名照样要查它解析到哪。DNS rebinding 就是靠这一步拦住的。
  let ip: string
  try {
    ip = await resolver(host)
  } catch {
    throw new NetGuardError(`域名 ${host} 解析失败`)
  }
  const bad = blockedIpReason(ip)
  if (bad) {
    // 198.18.0.0/15 单独给提示：本机开着 fake-ip 模式的代理时，**所有**域名
    // 都会解析到这个段，于是每个出站调用都在这里被拦，报错却指向「基准测试网段」，
    // 排查方向完全错。见记忆条目「访问慢=代理劫持」。
    const hint = bad === '基准测试网段'
      ? '——这通常是本机代理的 fake-ip，不是真实解析结果；请为该域名配置直连（DIRECT）或关闭代理后重试'
      : ''
    throw new NetGuardError(`域名 ${host} 解析到${bad}地址（${ip}），拒绝出站${hint}`)
  }

  return { host, ip }
}

/**
 * 带 SSRF 防护的 fetch。
 *
 * 🔴 redirect: 'manual' 不可改成 'follow'：目标站回一个 302 指向
 * http://169.254.169.254/ 就能把云元数据读出来，而那一跳不会再过白名单。
 * 收到 3xx 一律当失败返回，让调用方看见「对方要跳转」这件事本身。
 */
export async function guardedFetch(
  url: string,
  allowedHosts: string[],
  init: RequestInit & { timeoutMs: number; resolver?: Resolver },
): Promise<Response> {
  await assertOutboundAllowed(url, allowedHosts, init.resolver)

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), init.timeoutMs)
  try {
    const res = await fetch(url, { ...init, redirect: 'manual', signal: ctl.signal })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location') ?? '(未给出)'
      throw new NetGuardError(`目标返回重定向（${res.status} → ${loc}），出于安全不自动跟随`)
    }
    return res
  } catch (e) {
    if (e instanceof NetGuardError) throw e
    if ((e as { name?: string })?.name === 'AbortError') {
      throw new NetGuardError(`请求超时（${init.timeoutMs}ms）`)
    }
    throw new NetGuardError(`请求失败：${e instanceof Error ? e.message : String(e)}`)
  } finally {
    clearTimeout(timer)
  }
}
