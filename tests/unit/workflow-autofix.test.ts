/**
 * L2 测试 · WF-25 体检项一键修复
 *
 * 🔴 背景：联网搜索开关（WF-22）只影响新生成的流程，已存库的老流程不会追溯变更。
 * 用户手上那两条「查全网AI大事件」正是老代码生成的——label 带「需接入实时资讯检索能力」、
 * 没有 enableSearch，一打开就被体检拦住，而修法（进节点翻出开关）他并不知道。
 * **拦住却不给出路，等于把问题丢回给用户。**
 */
import { describe, it, expect } from 'vitest'
import { autoFixGraph } from '@/lib/workflow/autofix'
import { checkReadiness } from '@/lib/workflow/readiness'

const node = (id: string, type: string, label: string, config: Record<string, unknown> = {}) => ({
  id, type, data: { label, config },
})
const g = (...nodes: ReturnType<typeof node>[]) => ({ nodes, edges: [] })

describe('修复要取数却没开联网的节点', () => {
  // 用户线上那条流程的真实形态
  const real = () => g(
    node('start-1', 'start', '工作流启动'),
    node('llm-1', 'llm', '抓取前一日的AI大事件（需接入实时资讯检索能力）', { prompt: '列出昨日AI领域重大事件' }),
    node('llm-2', 'llm', '筛选重要事件并摘要', { prompt: '从以下内容筛选：{{input}}' }),
    node('answer-1', 'answer', '输出昨日AI大事件简报'),
  )

  it('打开联网搜索，并摘掉 label 上的「需接入」标记', () => {
    const { graph, fixes } = autoFixGraph(real())
    const fixed = (graph.nodes as ReturnType<typeof node>[]).find((n) => n.id === 'llm-1')!
    expect(fixed.data?.config?.enableSearch).toBe(true)
    expect(fixed.data?.label).toBe('抓取前一日的AI大事件')
    expect(fixes).toHaveLength(1)
  })

  it('修完体检就通过——这正是修复的意义', () => {
    expect(checkReadiness(real()).ready).toBe(false)
    expect(checkReadiness(autoFixGraph(real()).graph).ready).toBe(true)
  })

  it('纯加工节点不动，不替用户做主', () => {
    const { graph } = autoFixGraph(real())
    const keep = (graph.nodes as ReturnType<typeof node>[]).find((n) => n.id === 'llm-2')!
    expect(keep.data?.config?.enableSearch).toBeUndefined()
    expect(keep.data?.label).toBe('筛选重要事件并摘要')
  })

  it('已经开着的不重复计入修复清单', () => {
    const { fixes } = autoFixGraph(g(
      node('llm-1', 'llm', '抓取最新资讯', { prompt: 'x', enableSearch: true }),
    ))
    expect(fixes).toHaveLength(0)
  })

  it('提示词里提到检索、label 没提，同样修', () => {
    const { fixes } = autoFixGraph(g(node('llm-1', 'llm', '每日速览', { prompt: '联网检索今天的行业新闻' })))
    expect(fixes).toHaveLength(1)
  })

  it('非 llm 节点一律不动', () => {
    const { graph, fixes } = autoFixGraph(g(node('http-1', 'http-request', '抓取数据', { url: '' })))
    expect(fixes).toHaveLength(0)
    expect((graph.nodes as ReturnType<typeof node>[])[0].data?.config?.enableSearch).toBeUndefined()
  })

  it('空图不炸', () => {
    expect(autoFixGraph({ nodes: [], edges: [] }).fixes).toEqual([])
  })
})
