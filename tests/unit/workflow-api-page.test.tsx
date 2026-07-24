/**
 * 4.4.7a · 工作流「访问 API」下级页
 * 验证：真实端点渲染、发布/未发布态提示、请求响应文档存在、不伪造密钥。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { WorkflowApiPage } from '@/components/workflow/pages/workflow-api-page'

function mockFetchWorkflow(status: 'draft' | 'published') {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ workflow: { id: 'wf-1', name: '示例流', status, type: 'workflow' } }),
  })
}

describe('WorkflowApiPage（访问 API 下级页）', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetchWorkflow('published'))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('渲染真实运行端点（POST …/api/workflows/{id}/run）', async () => {
    render(<WorkflowApiPage workflowId="wf-1" />)
    const ep = await screen.findByText(/\/api\/workflows\/wf-1\/run$/)
    expect(ep).toBeInTheDocument()
    // 端点方法徽标
    expect(screen.getAllByText('POST').length).toBeGreaterThan(0)
  })

  it('已发布 → 显示「已发布」，不显示未发布告警', async () => {
    render(<WorkflowApiPage workflowId="wf-1" />)
    await screen.findByText('已发布')
    expect(screen.queryByText(/尚未发布/)).not.toBeInTheDocument()
  })

  it('草稿态 → 显示「未发布」告警', async () => {
    vi.stubGlobal('fetch', mockFetchWorkflow('draft'))
    render(<WorkflowApiPage workflowId="wf-1" />)
    await waitFor(() => expect(screen.getByText(/尚未发布/)).toBeInTheDocument())
    expect(screen.getByText('未发布')).toBeInTheDocument()
  })

  it('鉴权文档诚实标注：当前=登录会话，API Key 即将上线（不伪造密钥）', async () => {
    render(<WorkflowApiPage workflowId="wf-1" />)
    await screen.findByText(/登录会话（Cookie）/)
    expect(screen.getByText(/API Key（Bearer Token）/)).toBeInTheDocument()
  })

  it('含请求/响应文档：curl 示例与响应字段', async () => {
    render(<WorkflowApiPage workflowId="wf-1" />)
    await screen.findByText(/\/api\/workflows\/wf-1\/run$/)
    // curl 示例（POST … input）
    expect(screen.getByText(/curl -X POST/)).toBeInTheDocument()
    // 响应字段说明表
    expect(screen.getByText('run.id')).toBeInTheDocument()
    expect(screen.getByText('run.traces[]')).toBeInTheDocument()
  })
})
