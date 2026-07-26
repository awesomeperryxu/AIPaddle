import { describe, it, expect } from 'vitest'
import { normalizeRetrievalConfig, DEFAULT_KB_RETRIEVAL_CONFIG } from '@/lib/data/knowledge'

// 4.2.8：检索参数规整（纯函数，不触发 supabase）。

describe('normalizeRetrievalConfig 规整', () => {
  it('缺省回落默认 topK5/阈值0.28/vector', () => {
    expect(normalizeRetrievalConfig(undefined)).toEqual(DEFAULT_KB_RETRIEVAL_CONFIG)
    expect(normalizeRetrievalConfig(null)).toEqual(DEFAULT_KB_RETRIEVAL_CONFIG)
  })

  it('topK 夹取 [1,20]', () => {
    expect(normalizeRetrievalConfig({ topK: 0 }).topK).toBe(1)
    expect(normalizeRetrievalConfig({ topK: 999 }).topK).toBe(20)
  })

  it('阈值夹取 [0,1]', () => {
    expect(normalizeRetrievalConfig({ scoreThreshold: -1 }).scoreThreshold).toBe(0)
    expect(normalizeRetrievalConfig({ scoreThreshold: 5 }).scoreThreshold).toBe(1)
    expect(normalizeRetrievalConfig({ scoreThreshold: 0.5 }).scoreThreshold).toBe(0.5)
  })

  it('未落地的 fulltext/hybrid 保留（前端禁用），非法值回落 vector', () => {
    expect(normalizeRetrievalConfig({ searchMethod: 'fulltext' }).searchMethod).toBe('fulltext')
    expect(normalizeRetrievalConfig({ searchMethod: 'hybrid' }).searchMethod).toBe('hybrid')
    // @ts-expect-error 测非法值
    expect(normalizeRetrievalConfig({ searchMethod: '乱写' }).searchMethod).toBe('vector')
  })
})
