import 'server-only'
import { createHmac } from 'crypto'

// V12-8.6 / ADR-020 §3 路径A：为 Extension 机器用户自签短期 Supabase 访问令牌。
//
// 为什么需要它：全库 79 条 RLS 策略都走 current_org_id() = `select org_id from users
// where id = auth.uid()`。外部 Key 调用没有 Supabase 会话，auth.uid() 为空 → 策略全判假
// → 查不到任何数据。签一个 sub=机器用户 id 的令牌交给请求级客户端，auth.uid() 就有值了，
// 既有策略一条都不用改。
//
// 🔴 密钥必须用**原始字符串**做 HMAC，不可 base64 解码后再用——实测解码后签发会被
// PostgREST 拒为 PGRST301（None of the keys was able to decode the JWT）。

const TTL_SECONDS = 300 // 5 分钟：够一次请求用完，泄露了也很快失效

function b64url(input: object | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(JSON.stringify(input))
  return buf.toString('base64url')
}

/**
 * 为机器用户签发短期访问令牌。
 * @param serviceUserId Extension 绑定的机器用户 id（extensions.service_user_id）
 */
export function signServiceUserToken(serviceUserId: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    // 不静默降级：缺密钥就拒绝服务，绝不退回 service_role 应答外部请求（ADR-002）
    throw new Error('SUPABASE_JWT_SECRET 未配置，Extension 无法签发机器用户令牌')
  }
  const now = Math.floor(Date.now() / 1000)
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({
    sub: serviceUserId,
    role: 'authenticated',
    aud: 'authenticated',
    iat: now,
    exp: now + TTL_SECONDS,
  })
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}
