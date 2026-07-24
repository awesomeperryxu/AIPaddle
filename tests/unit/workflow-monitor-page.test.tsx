/**
 * 4.4.7b · 工作流「监测」下级页
 * 验证：真实 runs 聚合指标（调用数/成功率/平均耗时/P95）、空态、诚实标注「近 50 次」。
 * recharts 在 jsdom 下依赖 ResizeObserver，测试聚焦聚合逻辑，故 mock 掉图表库。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: Stub,
    BarChart: Stub,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  }
})

import { WorkflowMonitorPage } from '@/components/workflow/pages/workflow-monitor-page'

function mockRuns(runs: unknown[]) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ runs }) })
}

afterEach(() => vi.unstubAllGlobals())

describe('WorkflowMonitorPage（监测下级页）', () => {
  it('聚合指标：3 次运行(2成功1失败, 耗时50/100/200)', async () => {
    vi.stubGlobal(
      'fetch',
      mockRuns([
        { id: 'r1', status: 'succeeded', durationMs: 100, createdAt: '2026-07-22 10:00:00' },
        { id: 'r2', status: 'succeeded', durationMs: 200, createdAt: '2026-07-22 11:00:00' },
        { id: 'r3', status: 'failed', durationMs: 50, createdAt: '2026-07-22 12:00:00' },
      ]),
    )
    render(<WorkflowMonitorPage workflowId="wf-1" />)
    await screen.findByText('67%') // 成功率 round(2/3*100)
    expect(screen.getByText('2/3 成功')).toBeInTheDocument()
    expect(screen.getByText('117 ms')).toBeInTheDocument() // 平均 round((100+200+50)/3)
    expect(screen.getByText('200 ms')).toBeInTheDocument() // P95
    expect(screen.getByText(/基于最近 3 次运行/)).toBeInTheDocument()
  })

  it('无运行 → 空态提示', async () => {
    vi.stubGlobal('fetch', mockRuns([]))
    render(<WorkflowMonitorPage workflowId="wf-1" />)
    await waitFor(() => expect(screen.getByText(/尚无运行记录/)).toBeInTheDocument())
  })

  it('加载失败 → 错误提示', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    render(<WorkflowMonitorPage workflowId="wf-1" />)
    await waitFor(() => expect(screen.getByText(/加载失败/)).toBeInTheDocument())
  })
})
