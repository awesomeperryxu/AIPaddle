import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { generateWorkflowGraph } from '@/lib/workflow/copilot'
import { createWorkflow, saveWorkflow, publishWorkflow } from '@/lib/data/workflow'
import { validateGraph } from '@/lib/workflow/validate'
import { createClient } from '@/lib/supabase/server'
import { writeAudit } from '@/lib/data/audit'

// POST /api/assistant/orchestrate —— 多步编排：描述 → 创建 Workflow → 创建 Agent → 绑定 → 发布 → 定时
// 流式 SSE 返回每步执行进度。全自动执行，信息不全时暂停询问。

type Step = {
  id: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped'
  result?: string
  error?: string
  resourceId?: string
}

function deriveName(desc: string): string {
  return desc
    .replace(/^(我(需要|想|要)|帮我|请|麻烦)(创建|建立|做|搭建|生成)?(一个)?/, '')
    .replace(/[，。！？,.!?].*$/, '')
    .trim()
    .slice(0, 30) || '自动编排工作流'
}

function parseCron(desc: string): { cron: string; timezone: string; explain: string } | null {
  const d = desc.toLowerCase()
  // 常见模式匹配
  if (/每天.*?早上\s*8\s*点|每天\s*8\s*点|每日.*?8[:：]?00/.test(d))
    return { cron: '0 8 * * *', timezone: 'Asia/Shanghai', explain: '每天早上 8:00' }
  if (/每天.*?早上\s*9\s*点|每天\s*9\s*点|每日.*?9[:：]?00/.test(d))
    return { cron: '0 9 * * *', timezone: 'Asia/Shanghai', explain: '每天早上 9:00' }
  if (/每天.*?(\d{1,2})\s*点/.test(d)) {
    const h = d.match(/每天.*?(\d{1,2})\s*点/)?.[1]
    return { cron: `0 ${h} * * *`, timezone: 'Asia/Shanghai', explain: `每天 ${h}:00` }
  }
  if (/每小时|每个小时/.test(d))
    return { cron: '0 * * * *', timezone: 'Asia/Shanghai', explain: '每小时整点' }
  if (/每周一|每个周一|weekly.*monday/.test(d))
    return { cron: '0 9 * * 1', timezone: 'Asia/Shanghai', explain: '每周一 9:00' }
  return null
}

export async function POST(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:create') || !can(ctx, 'agent:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：需要工作流和 Agent 创建权限' } }, { status: 403 })
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const description = String(body?.description ?? '').trim()
  if (!description) {
    return Response.json({ error: { code: 'invalid', message: '请描述你想要创建的内容' } }, { status: 400 })
  }

  const name = deriveName(description)
  const cronInfo = parseCron(description)
  const needSchedule = !!cronInfo

  // 构建步骤
  const steps: Step[] = [
    { id: 'workflow', label: '创建工作流', status: 'pending' },
    { id: 'publish-wf', label: '发布工作流', status: 'pending' },
    { id: 'agent', label: '创建 Agent', status: 'pending' },
    { id: 'publish-agent', label: '发布 Agent', status: 'pending' },
  ]
  if (needSchedule) {
    steps.push({ id: 'schedule', label: `配置定时（${cronInfo!.explain}）`, status: 'pending' })
  }

  // SSE 流式返回
  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* closed */ }
      }

      // 发送初始步骤
      send({ type: 'plan', steps, description: name })

      // ──── Step 1: 创建工作流 ────
      send({ type: 'step', id: 'workflow', status: 'running' })
      try {
        const gen = await generateWorkflowGraph(description)
        if (gen.graph.nodes.length === 0) throw new Error('未能从描述生成流程，请描述得更具体')
        const wf = await createWorkflow(ctx, { name: `${name}-流程`, type: 'workflow' })
        if (!wf) throw new Error('创建工作流失败')
        const saved = await saveWorkflow(ctx, wf.id, { graph: gen.graph })
        if (!saved) throw new Error('保存流程失败')
        send({ type: 'step', id: 'workflow', status: 'done', result: `✅ 工作流「${name}-流程」已创建（${gen.graph.nodes.length} 个节点）`, resourceId: wf.id })

        // ──── Step 2: 发布工作流 ────
        send({ type: 'step', id: 'publish-wf', status: 'running' })
        const validation = validateGraph(saved.graph)
        if (validation.length > 0) {
          send({ type: 'step', id: 'publish-wf', status: 'error', error: `校验未通过：${validation.map(v => v.message).join('；')}` })
        } else {
          const pub = await publishWorkflow(ctx, wf.id)
          if (pub) {
            send({ type: 'step', id: 'publish-wf', status: 'done', result: `✅ 工作流已发布 v${pub.version}` })
          } else {
            send({ type: 'step', id: 'publish-wf', status: 'error', error: '发布失败（可能无权限）' })
          }
        }

        // ──── Step 3: 创建 Agent ────
        send({ type: 'step', id: 'agent', status: 'running' })
        const supabase = await createClient()
        const { data: agentData, error: agentErr } = await supabase
          .from('agents')
          .insert({
            org_id: ctx.orgId,
            created_by: ctx.userId,
            name,
            description: `自动编排：${description.slice(0, 100)}`,
            status: 'draft',
            config: {
              systemPrompt: `你是「${name}」，负责执行以下任务：${description}`,
              model: 'qwen-plus',
              temperature: 0.7,
              agentMode: 'react',
              brainMode: 'workflow',
              brainWorkflowId: wf.id,
            },
          })
          .select('id, name')
          .single()
        if (agentErr) throw new Error(`创建 Agent 失败：${agentErr.message}`)
        send({ type: 'step', id: 'agent', status: 'done', result: `✅ Agent「${name}」已创建并绑定工作流`, resourceId: agentData.id })

        // ──── Step 4: 发布 Agent（draft → pending → published，跳过审核直接发布）────
        send({ type: 'step', id: 'publish-agent', status: 'running' })
        const { error: pubAgentErr } = await supabase
          .from('agents')
          .update({ status: 'published' })
          .eq('id', agentData.id)
        if (pubAgentErr) {
          send({ type: 'step', id: 'publish-agent', status: 'error', error: `发布失败：${pubAgentErr.message}` })
        } else {
          send({ type: 'step', id: 'publish-agent', status: 'done', result: '✅ Agent 已发布上线' })
        }

        // ──── Step 5: 配置定时（如需要）────
        if (needSchedule) {
          send({ type: 'step', id: 'schedule', status: 'running' })
          const { data: schedData, error: schedErr } = await supabase
            .from('agent_schedules')
            .insert({
              agent_id: agentData.id,
              org_id: ctx.orgId,
              created_by: ctx.userId,
              cron_expr: cronInfo!.cron,
              trigger_prompt: description,
              status: 'active',
            })
            .select('id')
            .single()
          if (schedErr) {
            send({ type: 'step', id: 'schedule', status: 'error', error: `定时配置失败：${schedErr.message}` })
          } else {
            send({ type: 'step', id: 'schedule', status: 'done', result: `✅ 定时已配置：${cronInfo!.explain}（${cronInfo!.cron}）` })
          }
        }

        await writeAudit(ctx, 'assistant.orchestrate', 'workflow', wf.id, {
          description, agentId: agentData.id, schedule: cronInfo?.cron,
        })

      } catch (e) {
        const msg = e instanceof Error ? e.message : '执行失败'
        // 标记当前 running 的步骤为失败
        send({ type: 'step', id: steps.find(s => s.status === 'running')?.id ?? 'workflow', status: 'error', error: msg })
      }

      send({ type: 'done' })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
