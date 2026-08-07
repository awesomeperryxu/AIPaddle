import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { draftWorkflow, publishWorkflowAndDraftAgent } from '@/lib/assistant/orchestrate'
import { transitionAgent } from '@/lib/data/agents'
import { writeAudit } from '@/lib/data/audit'

// WF-6：个人助理「建流程 + 定时跑」的分步编排。
//
// 一个端点按 step 分派，而不是拆三个路由——它们共享同一套权限判定与审计口径，
// 拆开容易出现某一步漏了校验。
//
// 步骤与人工闸：
//   draft-workflow          自动：生成 workflow 草稿
//   ——【人工确认】——
//   publish-workflow        自动：发布 workflow + 建 Agent 草稿
//   ——【人工确认】——
//   publish-agent           自动：发布 Agent（无审核权限则停在 pending）
//   之后前端跳 /agent-schedules/new?agentId=... 走 PRD 既有的定时作业配置

type Step = 'draft-workflow' | 'publish-workflow' | 'publish-agent'

export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const step = String(body?.step ?? '') as Step
  const description = String(body?.description ?? '').trim()

  try {
    if (step === 'draft-workflow') {
      if (!can(ctx, 'workflow:create')) {
        return Response.json({ error: { code: 'forbidden', message: '无权限：创建工作流' } }, { status: 403 })
      }
      if (!description) {
        return Response.json({ error: { code: 'invalid', message: '请描述你想要的工作流' } }, { status: 400 })
      }
      const draft = await draftWorkflow(ctx, description)
      await writeAudit(ctx, 'workflow.copilot_created', 'workflow', draft.workflowId, {
        name: draft.name, nodeCount: draft.nodeCount, valid: draft.valid, via: 'assistant-orchestrate',
      })
      return Response.json({ step, draft }, { status: 201 })
    }

    if (step === 'publish-workflow') {
      // 发布工作流 + 建 Agent，两种权限都要有，否则会卡在半路
      if (!can(ctx, 'workflow:update') || !can(ctx, 'agent:create')) {
        return Response.json({ error: { code: 'forbidden', message: '无权限：发布工作流或创建 Agent' } }, { status: 403 })
      }
      const workflowId = String(body?.workflowId ?? '')
      if (!workflowId) return Response.json({ error: { code: 'invalid', message: '缺少 workflowId' } }, { status: 400 })

      const r = await publishWorkflowAndDraftAgent(ctx, workflowId, description)
      await writeAudit(ctx, 'workflow.published', 'workflow', workflowId, { via: 'assistant-orchestrate' })
      await writeAudit(ctx, 'agent.created', 'agent', r.agentId, {
        name: r.agentName, brainWorkflowId: workflowId, via: 'assistant-orchestrate',
      })
      return Response.json({ step, agent: r }, { status: 201 })
    }

    if (step === 'publish-agent') {
      if (!can(ctx, 'agent:submit')) {
        return Response.json({ error: { code: 'forbidden', message: '无权限：提交 Agent 审核' } }, { status: 403 })
      }
      const agentId = String(body?.agentId ?? '')
      if (!agentId) return Response.json({ error: { code: 'invalid', message: '缺少 agentId' } }, { status: 400 })

      // draft → pending
      const submitted = await transitionAgent(ctx, agentId, 'submit')
      if (!submitted.ok) {
        return Response.json({ error: { code: 'illegal_transition', message: '提交审核失败：状态不允许' } }, { status: 409 })
      }
      await writeAudit(ctx, 'agent.submit', 'agent', agentId, { via: 'assistant-orchestrate' })

      // 🔴 有审核权限才继续 pending → published。没有就停在 pending 交给有权限的人，
      // 绝不静默跳过审核——ADR-007 的审批权是安全边界，不能因为「流程要顺畅」被绕开
      if (!can(ctx, 'agent:review')) {
        return Response.json({
          step, agentId, status: 'pending', pendingReview: true,
          message: '已提交审核。你没有审批权限，需由管理员通过后才能配置定时执行。',
        })
      }
      const approved = await transitionAgent(ctx, agentId, 'approve')
      if (!approved.ok) {
        return Response.json({ error: { code: 'illegal_transition', message: '审核通过失败' } }, { status: 409 })
      }
      await writeAudit(ctx, 'agent.approve', 'agent', agentId, { via: 'assistant-orchestrate' })
      return Response.json({ step, agentId, status: 'published', pendingReview: false })
    }

    return Response.json({ error: { code: 'invalid', message: `未知步骤：${step}` } }, { status: 400 })
  } catch (e) {
    return Response.json(
      { error: { code: 'orchestrate_failed', message: e instanceof Error ? e.message : '编排失败' } },
      { status: 422 },
    )
  }
}
