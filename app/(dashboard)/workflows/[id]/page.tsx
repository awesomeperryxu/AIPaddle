import { notFound, redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { getWorkflow } from '@/lib/data/workflow'
import { WorkflowPage } from '@/components/workflow/workflow-page'

// W1-a：工作流编排编辑器（全屏覆盖，React Flow 画布接真实后端）。
// 服务端加载真实 graph（刷新可恢复），交给客户端画布；自动保存回 PATCH /api/workflows/[id]。
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const wf = await getWorkflow(ctx, id)
  if (!wf) notFound()

  return (
    <WorkflowPage
      workflowId={wf.id}
      title={wf.name}
      appType={wf.type}
      initialGraph={wf.graph}
    />
  )
}
