/**
 * L2 测试 · WF-11 工作流可用性体检（自动创建后先测试、通过再交人工发布）
 *
 * 🔴 图合法 ≠ 跑得起来。用户实测遇到的正是「结构完全合法但发布出去就是坏的」：
 *   · LLM 节点点开是空的——没模型没提示词，跑起来是模型自由发挥；
 *   · HTTP 节点填 `https://api.example-search.com/v1/search` 这种编造地址，一跑就失败。
 * 体检把这些列为发布拦截项，机器先把关，人工再发布。
 */
import { describe, it, expect } from 'vitest'
import { checkReadiness, isUsableUrl, summarizeReadiness } from '@/lib/workflow/readiness'

const node = (id: string, type: string, config: Record<string, unknown> = {}, label = id) => ({
  id, type, data: { label, config },
})
const okLlm = (id = 'llm-1') => node(id, 'llm', {
  prompt: '从以下内容中提炼要点：{{input}}',
  model: { provider: 'qwen', name: 'qwen-plus' },
  prompts: [{ id: 'p', role: 'user', text: '从以下内容中提炼要点：{{input}}' }],
}, '提炼要点')

const graphOf = (...nodes: ReturnType<typeof node>[]) => ({ nodes, edges: [] })

describe('LLM 节点', () => {
  it('提示词齐全 → 通过', () => {
    const r = checkReadiness(graphOf(okLlm()))
    expect(r.ready).toBe(true)
    expect(r.issues).toHaveLength(0)
  })

  it('没有提示词 → error，拦住发布', () => {
    const r = checkReadiness(graphOf(node('llm-1', 'llm', {})))
    expect(r.ready).toBe(false)
    expect(r.issues[0]).toMatchObject({ level: 'error', code: 'llm_no_prompt' })
  })

  it('只在面板 prompts[] 里写了提示词也算齐全', () => {
    const r = checkReadiness(graphOf(node('llm-1', 'llm', {
      prompts: [{ id: 'p', role: 'user', text: '请总结以下内容并给出要点' }],
      model: { provider: 'qwen', name: 'qwen-plus' },
    })))
    expect(r.ready).toBe(true)
  })

  it('未指定模型只是 warn，不拦发布（会退到系统默认模型）', () => {
    const r = checkReadiness(graphOf(node('llm-1', 'llm', { prompt: '请总结以下内容的要点' })))
    expect(r.ready).toBe(true)
    expect(r.issues.map((i) => i.code)).toContain('llm_no_model')
  })

  it('label 标了「需接入」的降级节点 → error，它其实没有对应能力', () => {
    const r = checkReadiness(graphOf(
      node('llm-1', 'llm', { prompt: '检索全网AI资讯并汇总' }, '联网检索（需接入能力，请手动挂载）'),
    ))
    expect(r.ready).toBe(false)
    expect(r.issues.map((i) => i.code)).toContain('llm_placeholder_capability')
  })
})

describe('HTTP 节点的假地址', () => {
  it.each([
    'https://api.example-search.com/v1/search',
    'https://example.com/api',
    'https://your-api.com/x',
    '<YOUR_ENDPOINT>',
    'TODO',
  ])('%s → error', (url) => {
    const r = checkReadiness(graphOf(node('http-1', 'http-request', { url, method: 'GET' })))
    expect(r.ready).toBe(false)
    expect(r.issues[0].code).toBe('http_placeholder_url')
  })

  it('真实地址 → 通过', () => {
    const r = checkReadiness(graphOf(node('http-1', 'http-request', { url: 'https://newsapi.org/v2/everything', method: 'GET' })))
    expect(r.ready).toBe(true)
  })

  it('地址为空 → error', () => {
    const r = checkReadiness(graphOf(node('http-1', 'http-request', { method: 'GET' })))
    expect(r.issues[0].code).toBe('http_no_url')
  })
})

describe('其它节点', () => {
  it('tool 未绑定 Skill → error', () => {
    const r = checkReadiness(graphOf(node('tool-1', 'tool', {})))
    expect(r.issues[0].code).toBe('tool_unbound')
  })

  it('if-else 条件为空 → error（引擎里恒走 ELSE，等于分支没生效）', () => {
    const r = checkReadiness(graphOf(node('if-1', 'if-else', {
      cases: [{ caseId: 'if-true', conditions: [] }],
    })))
    expect(r.issues[0].code).toBe('ifelse_no_condition')
  })

  it('if-else 填了条件 → 通过', () => {
    const r = checkReadiness(graphOf(node('if-1', 'if-else', {
      cases: [{ caseId: 'if-true', conditions: [{ conditions: [{ variable: ['llm-1'], operator: 'contains', value: 'AI' }] }] }],
    })))
    expect(r.ready).toBe(true)
  })

  it('知识库检索未选库 → error', () => {
    const r = checkReadiness(graphOf(node('kb-1', 'knowledge-retrieval', { dataset_ids: [] })))
    expect(r.issues[0].code).toBe('kb_unbound')
  })

  it('start/end 不参与体检，空图也不报错', () => {
    const r = checkReadiness(graphOf(node('s', 'start'), node('e', 'end')))
    expect(r.ready).toBe(true)
    expect(r.checked).toBe(2)
  })
})

describe('isUsableUrl', () => {
  it('只认 http(s) 绝对地址', () => {
    expect(isUsableUrl('https://a.com')).toBe(true)
    expect(isUsableUrl('http://a.com/x?y=1')).toBe(true)
    expect(isUsableUrl('ftp://a.com')).toBe(false)
    expect(isUsableUrl('/relative/path')).toBe(false)
    expect(isUsableUrl('')).toBe(false)
  })
})

describe('摘要文案', () => {
  it('未通过时说清有几项必须处理', () => {
    const r = checkReadiness(graphOf(node('llm-1', 'llm', {}), node('http-1', 'http-request', {})))
    expect(summarizeReadiness(r)).toContain('2 项必须处理')
  })

  it('通过时给出节点数', () => {
    expect(summarizeReadiness(checkReadiness(graphOf(okLlm())))).toContain('体检通过')
  })
})
