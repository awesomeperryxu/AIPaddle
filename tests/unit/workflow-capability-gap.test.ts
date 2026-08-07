/**
 * L2 测试 · WF-17 能力缺口分析 + find-skill
 *
 * 用户要的是「发现需要的 skill 就去创建，或从网络寻找并安装」。
 * 🔴 联网自动安装被明确排除：平台没有外部 Skill 源，所谓联网找＝让模型搜网页再生成配置，
 *    与刚修掉的「编造假 URL」同类；且自动装外部代码进租户会绕过 SEC-1/2/3 上架审核
 *    与 ADR-005「AI 只产 draft」。这里只做发现 + 起草，安装/发布始终人工。
 */
import { describe, it, expect } from 'vitest'
import { findCapabilityGaps, resolveGaps, extractNeed } from '@/lib/workflow/capability-gap'

const node = (id: string, type: string, label: string, config: Record<string, unknown> = {}) => ({
  id, type, data: { label, config },
})

describe('缺口识别', () => {
  it('标了「需接入」的 llm 节点 = 缺真实能力', () => {
    const gaps = findCapabilityGaps({ nodes: [node('l1', 'llm', '抓取前一日的AI大事件（需接入实时网络检索能力）')] })
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({ kind: 'capability', nodeId: 'l1', need: '实时网络检索' })
  })

  it('URL 被清空的 http 节点 = 缺接口', () => {
    const gaps = findCapabilityGaps({ nodes: [node('h1', 'http-request', '搜索资讯（地址需人工填写）', { url: '' })] })
    expect(gaps[0]).toMatchObject({ kind: 'endpoint', nodeId: 'h1' })
  })

  it('未绑定的 tool 节点 = 缺绑定', () => {
    const gaps = findCapabilityGaps({ nodes: [node('t1', 'tool', '调用能力', {})] })
    expect(gaps[0].kind).toBe('binding')
  })

  it('配置齐全的流程没有缺口', () => {
    const gaps = findCapabilityGaps({
      nodes: [
        node('s', 'start', '开始'),
        node('l1', 'llm', '筛选重要事件并摘要', { prompt: 'x' }),
        node('h1', 'http-request', '拉取资讯', { url: 'https://newsapi.org/v2/everything' }),
        node('t1', 'tool', '发送通知', { tool_id: 'sk-1' }),
        node('e', 'end', '结束'),
      ],
    })
    expect(gaps).toHaveLength(0)
  })
})

describe('extractNeed', () => {
  it.each([
    ['抓取AI大事件（需接入实时网络检索能力）', '实时网络检索'],
    ['联网检索（需接入能力，请手动挂载）', '联网检索'],
    ['发送邮件通知', '发送邮件通知'],
  ])('%s → %s', (label, need) => expect(extractNeed(label)).toBe(need))
})

describe('find-skill：在已有资产里找候选', () => {
  const gaps = findCapabilityGaps({ nodes: [node('l1', 'llm', '联网检索资讯（需接入联网检索能力）')] })

  it('命中同类 Skill', () => {
    const [r] = resolveGaps(gaps, {
      skills: [{ id: 's1', name: '联网检索', description: '调用搜索引擎检索全网资讯', status: 'published' }],
      mcpServers: [],
    })
    expect(r.candidates[0]).toMatchObject({ source: 'skill', id: 's1', status: 'published' })
    expect(r.suggestDraft).toBe(false)
  })

  it('命中 MCP Server', () => {
    const [r] = resolveGaps(gaps, {
      skills: [],
      mcpServers: [{ id: 'm1', name: '检索服务', description: '联网检索与网页抓取' }],
    })
    expect(r.candidates[0].source).toBe('mcp')
  })

  it('草稿态 Skill 也列出来——用户可能刚起草过正合适的', () => {
    const [r] = resolveGaps(gaps, {
      skills: [{ id: 's1', name: '联网检索工具', description: '检索资讯', status: 'draft' }],
      mcpServers: [],
    })
    expect(r.candidates[0].status).toBe('draft')
  })

  it('🔴 不相干的资产不硬凑——推荐错的比不推荐更糟', () => {
    const [r] = resolveGaps(gaps, {
      skills: [{ id: 's1', name: '财务报销审批', description: '走审批流并回写ERP', status: 'published' }],
      mcpServers: [{ id: 'm1', name: '打印机管理', description: '管理办公室打印设备' }],
    })
    expect(r.candidates).toHaveLength(0)
    expect(r.suggestDraft).toBe(true)
  })

  it('候选按匹配度排序且最多 5 条', () => {
    const [r] = resolveGaps(gaps, {
      skills: Array.from({ length: 8 }, (_, i) => ({
        id: `s${i}`, name: `联网检索${i}`, description: '联网检索资讯', status: 'published',
      })),
      mcpServers: [],
    })
    expect(r.candidates.length).toBe(5)
    expect(r.candidates[0].score).toBeGreaterThanOrEqual(r.candidates[4].score)
  })

  it('没有缺口时不产出任何解析结果', () => {
    expect(resolveGaps([], { skills: [], mcpServers: [] })).toEqual([])
  })
})
