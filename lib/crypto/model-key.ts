import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

// ADR-016 4.7.1：租户模型供应商 API Key 的应用层加密。
// AES-256-GCM，主密钥来自 env MODEL_KEY_ENC_SECRET（服务器 only）。
// 密文格式：v1:<iv-b64>:<tag-b64>:<ciphertext-b64>。
// 「两把钥匙」原则：解密只经本模块；主密钥缺失时优雅降级（isEncryptionAvailable=false），
// 上层据此回退平台 env（现状不破），绝不明文落库。

const FORMAT = 'v1'

/** 从 env 取 32 字节主密钥；支持 64 位 hex 或任意字符串（后者 sha256 派生）。缺失返回 null。 */
function masterKey(): Buffer | null {
  const raw = process.env.MODEL_KEY_ENC_SECRET
  if (!raw) return null
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  // 非标准长度 → sha256 派生出确定的 32 字节（容错，但推荐用 openssl rand -hex 32）
  return createHash('sha256').update(raw).digest()
}

/** 加密可用性：主密钥是否已配置。上层用它决定启用租户 Key 还是回退平台 env。 */
export function isEncryptionAvailable(): boolean {
  return masterKey() !== null
}

/** 加密明文 API Key → 密文串（v1:iv:tag:ct）。未配主密钥则抛错（调用方应先查 isEncryptionAvailable）。 */
export function encryptApiKey(plaintext: string): string {
  const key = masterKey()
  if (!key) throw new Error('未配置 MODEL_KEY_ENC_SECRET，无法加密模型 Key')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${FORMAT}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

/** 解密密文串 → 明文 API Key。格式非法/篡改/主密钥缺失均抛错。 */
export function decryptApiKey(ciphertext: string): string {
  const key = masterKey()
  if (!key) throw new Error('未配置 MODEL_KEY_ENC_SECRET，无法解密模型 Key')
  const parts = ciphertext.split(':')
  if (parts.length !== 4 || parts[0] !== FORMAT) throw new Error('模型 Key 密文格式非法')
  const iv = Buffer.from(parts[1], 'base64')
  const tag = Buffer.from(parts[2], 'base64')
  const ct = Buffer.from(parts[3], 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

/** 脱敏展示：只回 Key 后 4 位（前端一律脱敏，绝不回明文/密文）。 */
export function maskApiKey(plaintext: string): string {
  const s = plaintext.trim()
  if (s.length <= 4) return '****'
  return `****${s.slice(-4)}`
}
