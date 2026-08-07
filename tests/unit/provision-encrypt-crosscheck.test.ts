/**
 * L1 测试 · 开通脚本的凭证加密必须与应用端解密互通（WF-23）
 *
 * 🔴 为什么要有这条：`scripts/provision-websearch-plugin.mjs` **复刻**了
 * `lib/crypto/model-key.ts` 的加密逻辑——node 跑 .mjs 没法 import 带
 * `import 'server-only'` 的 .ts 模块（实测 MODULE_NOT_FOUND）。
 * 复刻的代价是两边可能悄悄漂移：真漂了，脚本照样跑成功、页面上凭证看着正常，
 * **只有等某次工具调用时才失败**，而那时根本联想不到是开通脚本的问题。
 *
 * 这条测试把复刻的那段算法钉在这里：改了 model-key.ts 的格式或密钥派生，
 * 这里立刻红，提醒同步改脚本。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
vi.mock('server-only', () => ({}))
import { createCipheriv, randomBytes, createHash } from 'node:crypto'
import { decryptApiKey } from '@/lib/crypto/model-key'

// ↓↓↓ 与 scripts/provision-websearch-plugin.mjs 中的实现保持逐行一致 ↓↓↓
function masterKey() {
  const raw = process.env.MODEL_KEY_ENC_SECRET!
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return createHash('sha256').update(raw).digest()
}
function scriptEncrypt(plaintext: string) {
  const key = masterKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ct.toString('base64')}`
}
// ↑↑↑ 与脚本保持一致 ↑↑↑

const ORIGINAL = process.env.MODEL_KEY_ENC_SECRET
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.MODEL_KEY_ENC_SECRET
  else process.env.MODEL_KEY_ENC_SECRET = ORIGINAL
})

describe('开通脚本的加密与应用端互通', () => {
  it.each([
    ['非 hex 主密钥（走 sha256 派生）', 'some-arbitrary-secret-string'],
    ['标准 hex64 主密钥（直接当字节用）', 'a'.repeat(64)],
  ])('%s：脚本加密的凭证，应用端解得开', (_label, secret) => {
    process.env.MODEL_KEY_ENC_SECRET = secret
    const plain = 'AIzaSy_FAKE_KEY_FOR_TEST'
    expect(decryptApiKey(scriptEncrypt(plain))).toBe(plain)
  })

  it('两种主密钥形式不可互换——派生方式若混用会解不开', () => {
    process.env.MODEL_KEY_ENC_SECRET = 'b'.repeat(64)
    const ct = scriptEncrypt('x')
    process.env.MODEL_KEY_ENC_SECRET = 'b'.repeat(63) // 非 hex64 → 走 sha256，密钥不同
    expect(() => decryptApiKey(ct)).toThrow()
  })
})
