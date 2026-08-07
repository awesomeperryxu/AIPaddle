import 'server-only'
import type { RequestContext } from '@/lib/context'
import { generateWorkflowGraph } from '@/lib/workflow/copilot'
import { createWorkflow, saveWorkflow, deleteWorkflow, publishWorkflow, getWorkflow } from '@/lib/data/workflow'
import { listSkills } from '@/lib/data/skills'
import { createAgent } from '@/lib/data/agents'
import { validateGraph } from '@/lib/workflow/validate'
import { validateToolNodes } from '@/lib/workflow/validate-tools'

// WF-6：助理里一句话「建流程 + 每天定时跑」→ 分步编排，每步之间由人确认。
//
// 用户定的链路：
//   ① 自动生成 workflow（草稿）
//   ② 【人工确认】发布 workflow
//   ③ 自动创建 Agent 并绑该 workflow 为大脑（草稿）
//   ④ 【人工确认】发布 Agent
//   ⑤ 自动进入定时作业配置并上线
//
// 🔴 为什么两道闸都不能省：AI 生成的资产未经人过目就上线、还会按时自动跑，
// 出问题时它已经自己执行过很多次了。风险与收益不对等，所以自动化只做「步骤衔接」，
// 不替人做「是否放行」的判断。

/** 从描述提炼名称：去掉口语开头、截首句、限长 */
export function deriveName(desc: string): string {
  const cleaned = desc
    .replace(/^(我(需要|想|要)|帮我|请|麻烦)(创建|建立|做|搭建|生成)?(一个)?/, '')
    .split(/[，,。;；\n]/)[0]
    .trim()
  const name = cleaned || desc.trim()
  return name.length > 40 ? `${name.slice(0, 40)}…` : name
}

export type WorkflowDraft = {
  workflowId: string
  name: string
  nodeCount: number
  edgeCount: number
  /** 节点摘要，供确认框展示「这条流程到底干什么」 */
  nodes: { type: string; label: string }[]
  /** Copilot 找不到匹配 Skill 时降级产生的节点——跑起来是模型在编，确认前必须知情 */
  pendingAbilityNodes: string[]
  validation: { code: string; message: string }[]
  valid: boolean
}

/** 步骤 ①：生成 workflow 草稿。失败不留残骸。 */
export async function draftWorkflow(ctx: RequestContext, description: string): Promise<WorkflowDraft> {
  const published = (await listSkills(ctx))
    .filter((s) => s.status === 'published')
    .map((s) => ({ id: s.id, name: s.name, description: s.description, type: s.type }))

  const gen = await generateWorkflowGraph(description, published)
  if (gen.graph.nodes.length === 0) {
    throw new Error('未能从描述生成流程，请把需求描述得更具体一些')
  }

  const name = deriveName(description)
  const wf = await createWorkflow(ctx, { name, type: 'workflow' })

  try {
    const saved = await saveWorkflow(ctx, wf.id, { graph: gen.graph })
    if (!saved) throw new Error('流程已生成但保存失败')

    const validation = [...validateGraph(saved.graph), ...(await validateToolNodes(ctx, saved.graph))]
    const nodes = (saved.graph.nodes ?? []).map((n) => {
      const nn = n as { type: string; label?: string }
      return { type: nn.type, label: nn.label ?? nn.type }
    })

    return {
      workflowId: wf.id,
      name,
      nodeCount: nodes.length,
      edgeCount: saved.graph.edges.length,
      nodes,
      pendingAbilityNodes: nodes.filter((n) => n.label.includes('需接入能力')).map((n) => n.label),
      validation,
      valid: validation.length === 0,
    }
  } catch (e) {
    // 用户明确要求中途失败「不保存」——不回滚会在列表里留下不知从何而来的空壳
    await deleteWorkflow(ctx, wf.id).catch(() => {})
    throw e
  }
}

export type AgentDraft = {
  agentId: string
  agentName: string
  workflowId: string
  workflowName: string
}

/**
 * 步骤 ②③：发布 workflow，随即自动建 Agent 并绑它为大脑（Agent 仍是草稿）。
 *
 * 合成一个函数是刻意的：用户确认的是「发布这条流程并据此建 Agent」这一件事，
 * 中间断开会多出一个「流程已发布但没 Agent」的中间态，用户还得再点一次。
 */
export async function publishWorkflowAndDraftAgent(
  ctx: RequestContext,
  workflowId: string,
  description: string,
): Promise<AgentDraft> {
  const wf = await getWorkflow(ctx, workflowId)
  if (!wf) throw new Error('工作流不存在或无权访问')

  // 图非法时不允许发布——带着结构错误上线，到点执行必然失败
  const errs = [...validateGraph(wf.graph), ...(await validateToolNodes(ctx, wf.graph))]
  if (errs.length > 0) {
    throw new Error(`工作流校验未通过，无法发布：${errs.map((e) => e.message).join('；')}`)
  }

  const publishedWf = await publishWorkflow(ctx, workflowId)
  if (!publishedWf) throw new Error('发布工作流失败')

  const agentName = `${wf.name} · 定时执行`
  const agent = await createAgent(ctx, {
    name: agentName,
    description: `由个人助理根据「${description.slice(0, 60)}」自动编排，以工作流「${wf.name}」为大脑`,
    // 🔴 brainMode/brainWorkflowId 是「定时到点真正跑这条流程」的关键（配合 WF-5 的分流）；
    // 不设的话定时会退化成模型自由发挥，且看不出走偏
    config: {
      brainMode: 'workflow',
      brainWorkflowId: workflowId,
      systemPrompt: `你是「${agentName}」，负责按计划执行工作流「${wf.name}」。`,
    },
  })

  return { agentId: agent.id, agentName: agent.name, workflowId, workflowName: wf.name }
}
