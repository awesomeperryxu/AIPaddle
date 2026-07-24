/**
 * 4.4.12 · 工作流 DSL 导入/导出（自有 DSL，与图同构）
 */
import { describe, it, expect } from 'vitest'
import { exportDSL, parseDSL } from '@/lib/workflow/dsl'

const graph = { nodes: [{ id: 's', type: 'start' }, { id: 'e', type: 'end' }], edges: [{ source: 's', target: 'e' }] }

describe('workflow DSL', () => {
  it('exportDSL 生成 v1 文档（kind/name/graph）', () => {
    const d = exportDSL({ name: '我的流', type: 'workflow', graph })
    expect(d.aipaddle_dsl).toBe('v1')
    expect(d.kind).toBe('workflow')
    expect(d.name).toBe('我的流')
    expect(d.graph.nodes).toHaveLength(2)
    expect(d.graph.edges).toHaveLength(1)
  })

  it('exportDSL 空图安全兜底', () => {
    const d = exportDSL({ name: 'x', type: 'chatflow', graph: null })
    expect(d.graph).toEqual({ nodes: [], edges: [] })
    expect(d.kind).toBe('chatflow')
  })

  it('export→parse 往返一致', () => {
    const d = exportDSL({ name: '往返', type: 'chatflow', graph })
    const p = parseDSL(d)
    expect(p.ok).toBe(true)
    if (p.ok) {
      expect(p.value.name).toBe('往返')
      expect(p.value.type).toBe('chatflow')
      expect(p.value.graph.nodes).toHaveLength(2)
    }
  })

  it('parseDSL 拒绝非对象 / 错误版本 / 缺 graph', () => {
    expect(parseDSL(null).ok).toBe(false)
    expect(parseDSL('str').ok).toBe(false)
    expect(parseDSL({ aipaddle_dsl: 'v2', graph }).ok).toBe(false)
    expect(parseDSL({ aipaddle_dsl: 'v1', name: 'x' }).ok).toBe(false)
    const noEdges = parseDSL({ aipaddle_dsl: 'v1', name: 'x', graph: { nodes: [] } })
    expect(noEdges.ok).toBe(false)
  })

  it('parseDSL 缺名字用默认名', () => {
    const p = parseDSL({ aipaddle_dsl: 'v1', graph })
    expect(p.ok).toBe(true)
    if (p.ok) expect(p.value.name).toBe('导入的工作流')
  })
})
