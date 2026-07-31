/**
 * L1 单测 · Extension Key 的纯函数部分（V12-8.5 / ADR-020 §6）
 *
 * Key 是外部进入系统的唯一凭证，生成与比较的正确性直接决定攻击面，
 * 因此这几个纯函数单独锁死。数据操作部分（签发/撤销/校验）在 L3 集成层验。
 */
import { describe, it, expect } from 'vitest'
import {
  generateExtKey, hashExtKey, safeHashEqual, parseBearer, EXT_KEY_SCOPES,
} from '@/lib/data/extension-keys'

const fixedRand = (fill: number) => (n: number) => Buffer.alloc(n, fill)

describe('generateExtKey', () => {
  it('明文形如 ap_ext_<40 hex>', () => {
    const { plaintext } = generateExtKey(fixedRand(0xab))
    expect(plaintext).toMatch(/^ap_ext_[0-9a-f]{40}$/)
  })

  it('🔴 前缀与平台级 Key（ap_sk_live_）可区分——出问题时一眼看出是哪套体系', () => {
    const { prefix } = generateExtKey(fixedRand(1))
    expect(prefix.startsWith('ap_ext_')).toBe(true)
    expect(prefix.startsWith('ap_sk_live_')).toBe(false)
  })

  it('hash 是明文的 sha256，且前缀不足以反推明文', () => {
    const { plaintext, hash, prefix } = generateExtKey(fixedRand(0x5a))
    expect(hash).toBe(hashExtKey(plaintext))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(plaintext.length).toBeGreaterThan(prefix.length) // 前缀只是片段
    expect(hash).not.toContain(plaintext)
  })

  it('不同随机源产出不同 Key', () => {
    expect(generateExtKey(fixedRand(1)).plaintext)
      .not.toBe(generateExtKey(fixedRand(2)).plaintext)
  })

  it('真实随机源下两次签发不重复', () => {
    expect(generateExtKey().plaintext).not.toBe(generateExtKey().plaintext)
  })
})

describe('safeHashEqual（定长比较）', () => {
  it('相同串返回 true', () => {
    const h = hashExtKey('x')
    expect(safeHashEqual(h, h)).toBe(true)
  })

  it('不同串返回 false', () => {
    expect(safeHashEqual(hashExtKey('a'), hashExtKey('b'))).toBe(false)
  })

  it('🔴 长度不等直接判否，不抛异常（timingSafeEqual 对不等长会 throw）', () => {
    expect(safeHashEqual('abc', 'abcd')).toBe(false)
    expect(safeHashEqual('', hashExtKey('a'))).toBe(false)
  })

  it('仅首字符不同也判否（不因前缀相同而提前返回真）', () => {
    const h = hashExtKey('a')
    expect(safeHashEqual(h, 'f' + h.slice(1))).toBe(false)
  })
})

describe('parseBearer', () => {
  it('取出 Bearer token', () => {
    expect(parseBearer('Bearer ap_ext_abc')).toBe('ap_ext_abc')
  })

  it('大小写不敏感、容忍多余空白', () => {
    expect(parseBearer('  bearer   ap_ext_abc  ')).toBe('ap_ext_abc')
  })

  it('格式不符一律 null（不猜测、不兜底）', () => {
    for (const h of [null, '', 'ap_ext_abc', 'Basic abc', 'Bearer', 'Bearer a b']) {
      expect(parseBearer(h), `应拒绝：${JSON.stringify(h)}`).toBeNull()
    }
  })
})

describe('scope 约定', () => {
  it('本期只放 chat 与 leads（最小授权）', () => {
    expect([...EXT_KEY_SCOPES]).toEqual(['chat', 'leads'])
  })
})
