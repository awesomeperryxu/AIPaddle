import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  encryptApiKey, decryptApiKey, isEncryptionAvailable, maskApiKey,
} from '@/lib/crypto/model-key'

// 4.7.1（ADR-016）：模型 Key 应用层 AES-256-GCM 加密。

const HEX_KEY = '8e81e5571c70ea0f855be1779f24717f67d3fa7df91718b4a4555ecac228b1a0'

describe('model-key 加密（4.7.1）', () => {
  const prev = process.env.MODEL_KEY_ENC_SECRET
  beforeEach(() => { process.env.MODEL_KEY_ENC_SECRET = HEX_KEY })
  afterEach(() => {
    if (prev === undefined) delete process.env.MODEL_KEY_ENC_SECRET
    else process.env.MODEL_KEY_ENC_SECRET = prev
  })

  it('加解密往返还原明文', () => {
    const plain = 'sk-abcdef1234567890'
    const ct = encryptApiKey(plain)
    expect(ct).toMatch(/^v1:/)
    expect(ct).not.toContain(plain) // 密文不含明文
    expect(decryptApiKey(ct)).toBe(plain)
  })

  it('同一明文两次加密密文不同（随机 IV）', () => {
    expect(encryptApiKey('k')).not.toBe(encryptApiKey('k'))
  })

  it('密文被篡改 → 解密抛错（GCM 认证）', () => {
    const ct = encryptApiKey('secret')
    const parts = ct.split(':')
    // 翻转密文最后一个字符
    const tampered = parts.slice(0, 3).join(':') + ':' + parts[3].slice(0, -1) + (parts[3].slice(-1) === 'A' ? 'B' : 'A')
    expect(() => decryptApiKey(tampered)).toThrow()
  })

  it('格式非法 → 抛错', () => {
    expect(() => decryptApiKey('not-a-cipher')).toThrow(/格式非法/)
  })

  it('isEncryptionAvailable：配了主密钥→true，缺失→false', () => {
    expect(isEncryptionAvailable()).toBe(true)
    delete process.env.MODEL_KEY_ENC_SECRET
    expect(isEncryptionAvailable()).toBe(false)
    expect(() => encryptApiKey('x')).toThrow(/MODEL_KEY_ENC_SECRET/)
  })

  it('非 hex 主密钥也能用（sha256 派生）', () => {
    process.env.MODEL_KEY_ENC_SECRET = '一个中文口令passphrase'
    expect(isEncryptionAvailable()).toBe(true)
    const ct = encryptApiKey('hello')
    expect(decryptApiKey(ct)).toBe('hello')
  })

  it('maskApiKey 只留后 4 位', () => {
    expect(maskApiKey('sk-abcdef1234')).toBe('****1234')
    expect(maskApiKey('abc')).toBe('****')
  })
})
