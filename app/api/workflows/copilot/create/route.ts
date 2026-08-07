import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { generateWorkflowGraph } from '@/lib/workflow/copilot'
import { listSkills } from '@/lib/data/skills'
import { createWorkflow, saveWorkflow } from '@/lib/data/workflow'
import { validateGraph } from '@/lib/workflow/validate'
import { validateToolNodes } from '@/lib/workflow/validate-tools'
import { writeAudit } from '@/lib/data/audit'
import { checkReadiness } from '@/lib/workflow/readiness'

// POST /api/workflows/copilot/create —— 描述 → 直接建出一条**已填好流程**的工作流。
//
// 为什么不让前端连发三次（copilot → POST /workflows → PATCH graph）：
// 中途任一步失败都会留下一条空白工作流，用户看到的正是「打开编辑器里面什么都没有」。
// 一次调用里失败就整体不产出，不留残骸。
//
// 🔴 仍产 draft、不发布：AI 生成的流程必须人工过目，发布走既有审核（ADR-005 铁律）。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'workflow:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：创建工作流' } }, { status: 403 })
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const description = String(body?.description ?? '').trim()
  if (!description) {
    return Response.json({ error: { code: 'invalid', message: '请描述你想要的工作流' } }, { status: 400 })
  }
  const type = body?.type === 'chatflow' ? 'chatflow' : 'workflow'

  // ① 生成（copilot 内部已含「生成 → 校验 → 非法则让模型修一次」）
  // WF-3：把本租户【已发布】的 Skill 作为可选能力清单交给 Copilot。
  // 不传的话它只能生成 llm 节点假装联网检索——看着完整、跑起来是编的。
  const published = (await listSkills(ctx))
    .filter((s) => s.status === 'published')
    .map((s) => ({ id: s.id, name: s.name, description: s.description, type: s.type }))
  // 🔴 type 此前算出来却没传给 Copilot——它于是不知道该用 end 还是 answer，
  // 给 Workflow 也配了 Chatflow 专用的 answer 收尾，执行时那一步直接被跳过
  const gen = await generateWorkflowGraph(description, { availableSkills: published, appType: type })
  if (gen.graph.nodes.length === 0) {
    // 🔴 失败同样留痕：只记成功的记录页等于没监督，用户回头也查不到「那次为什么没建出来」
    await writeAudit(ctx, 'workflow.copilot_failed', 'workflow', '-', {
      description, success: false, error: '模型未能生成任何节点',
    })
    return Response.json(
      { error: { code: 'generate_failed', message: '未能从描述生成流程，请把需求描述得更具体一些' } },
      { status: 422 },
    )
  }

  // ② 建壳。名称取描述首句，避免又出现一堆「未命名」
  const name = deriveName(description)
  const created = await createWorkflow(ctx, { name, type })

  // ③ 存图。失败则把刚建的壳删掉，不留空白工作流
  const saved = await saveWorkflow(ctx, created.id, { graph: gen.graph })
  if (!saved) {
    await writeAudit(ctx, 'workflow.copilot_failed', 'workflow', created.id, {
      description, name, success: false, error: '流程已生成但保存失败',
    })
    return Response.json({ error: { code: 'save_failed', message: '流程已生成但保存失败，请重试' } }, { status: 500 })
  }

  // ④ 复校验：以**落库后**的图为准，而非生成时的内存对象——
  //    保存过程若对图做了规整，校验结论必须跟着落库结果走
  const validation = [...validateGraph(saved.graph), ...(await validateToolNodes(ctx, saved.graph))]
  // WF-11：自动创建后立即体检——「先测试、通过再交人工发布」的机器把关那一步。
  // 静态检查，不调模型不发请求；未通过时流程照样留着（草稿），只是发布会被拦。
  const readiness = checkReadiness(saved.graph)

  await writeAudit(ctx, 'workflow.copilot_created', 'workflow', created.id, {
    name, description, // description 用于回溯「是哪句话建出来的」
    nodeCount: gen.graph.nodes.length, edgeCount: gen.graph.edges.length,
    valid: validation.length === 0,
    ready: readiness.ready,
    readinessIssues: readiness.issues.length,
    // WF-24：定时不再落进工作流，只记「识别到了什么」供回溯
    scheduleHint: gen.scheduleHint?.cron || (gen.scheduleHint ? 'unspecified' : null),
  })

  return Response.json(
    { workflow: saved, validation, valid: validation.length === 0, readiness, scheduleHint: gen.scheduleHint },
    { status: 201 },
  )
}

/** 从描述取一个像样的名字：截首句、去掉「我需要/帮我」这类口语开头、限长 */
function deriveName(desc: string): string {
  const cleaned = desc
    .replace(/^(我(需要|想|要)|帮我|请|麻烦)(创建|建立|做|搭建|生成)?(一个)?/, '')
    .split(/[，,。;；\n]/)[0]
    .trim()
  const name = cleaned || desc.trim()
  return name.length > 40 ? `${name.slice(0, 40)}…` : name
}
