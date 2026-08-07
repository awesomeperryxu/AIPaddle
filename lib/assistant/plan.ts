// WF-7：识别到创建意图时，先把「创建计划」讲清楚再动手。
//
// 用户要求：一旦判断需要创建 Agent / workflow / Skill / plugin 等任何对象，
// 必须在回复里说明**要建哪些、先做哪个后做哪个、最后实现什么**。
//
// 🔴 用模板而非让 LLM 临场编计划：步骤与顺序是由意图类型**确定**的
// （比如定时工作流必然是 建流程→发布→建Agent→发布→配定时），
// 交给模型发挥会出现漏步骤、顺序颠倒、把需要人工确认的步骤写成自动完成。
// 模型只负责理解意图，计划本身必须可复现。

import type { IntentKind } from './intent'

export type PlanStep = {
  /** 展示用序号 */
  order: number
  title: string
  /** 该步是否需要人工确认后才继续 */
  needsConfirm: boolean
  detail?: string
}

export type CreationPlan = {
  /** 一句话说明识别到什么 */
  intro: string
  steps: PlanStep[]
  /** 全部完成后实现什么 */
  outcome: string
}

type PlanTemplate = {
  intro: (desc: string) => string
  steps: PlanStep[]
  outcome: (desc: string) => string
}

const TEMPLATES: Record<Exclude<IntentKind, 'chat'>, PlanTemplate> = {
  'create-scheduled-workflow': {
    intro: (d) => `我理解你想要「${d}」——这需要一条工作流加上定时执行，我会分步来做。`,
    steps: [
      { order: 1, title: '生成工作流草稿', needsConfirm: false, detail: '根据你的描述编排节点与连线，并做结构校验' },
      { order: 2, title: '发布工作流', needsConfirm: true, detail: '由你确认流程无误后发布' },
      { order: 3, title: '创建 Agent 并绑定该工作流为大脑', needsConfirm: false, detail: '发布后自动进行' },
      { order: 4, title: '发布 Agent', needsConfirm: true, detail: '由你确认后发布；无审批权限时会提交管理员审核' },
      { order: 5, title: '配置定时作业并上线', needsConfirm: false, detail: '进入定时作业页，执行时间可再调整' },
    ],
    outcome: (d) => `完成后，系统会按你设定的时间自动运行这条流程，无需再手动触发——即「${d}」。`,
  },
  'create-workflow': {
    intro: (d) => `我理解你想创建一条工作流：「${d}」。`,
    steps: [
      { order: 1, title: '生成工作流草稿', needsConfirm: false, detail: '编排节点与连线并做结构校验' },
      { order: 2, title: '在编辑器中查看与调整', needsConfirm: true, detail: '确认无误后由你发布' },
    ],
    outcome: () => '完成后你会得到一条可手动运行、也可被 Agent 引用的工作流。',
  },
  'create-chatflow': {
    intro: (d) => `我理解你想创建一个对话流：「${d}」。`,
    steps: [
      { order: 1, title: '生成 Chatflow 草稿', needsConfirm: false },
      { order: 2, title: '在编辑器中查看与调整', needsConfirm: true, detail: '确认无误后由你发布' },
    ],
    outcome: () => '完成后你会得到一个支持多轮对话、流式输出的对话应用。',
  },
  'create-agent': {
    intro: (d) => `我理解你想创建一个数字员工：「${d}」。`,
    steps: [
      { order: 1, title: '生成 Agent 草稿', needsConfirm: false, detail: '按描述生成角色设定与基础配置' },
      { order: 2, title: '补充能力并发布', needsConfirm: true, detail: '按需挂载知识库 / Skill / Tool，确认后发布' },
    ],
    // 这句是刻意写的：外部导入或纯生成的 Agent 常是「只有提示词没有能力」的空壳
    outcome: () => '完成后你会得到一个可对话的数字员工。注意：只有挂载了知识库或工具，它才具备平台增强能力，否则只是普通对话。',
  },
  'create-skill': {
    intro: (d) => `我理解你想创建一个 Skill：「${d}」。`,
    steps: [
      { order: 1, title: '进入 Skill 创建页并预填描述', needsConfirm: false },
      { order: 2, title: '配置连接信息并提交上架审核', needsConfirm: true, detail: 'API/DB 型需填连接配置；上架需通过安全审核' },
    ],
    outcome: () => '完成并过审后，该 Skill 可被 Agent 与工作流引用。',
  },
}

/** 生成创建计划。desc 为空时回落用意图标签，避免出现「想创建「」」这种空引号 */
export function buildCreationPlan(kind: Exclude<IntentKind, 'chat'>, description: string): CreationPlan {
  const t = TEMPLATES[kind]
  const desc = description.trim() || '你描述的内容'
  return { intro: t.intro(desc), steps: t.steps, outcome: t.outcome(desc) }
}

/** 渲染成对话气泡里的 Markdown 文本 */
export function renderPlan(plan: CreationPlan): string {
  const lines = [plan.intro, '', '**创建计划**', '']
  for (const s of plan.steps) {
    const mark = s.needsConfirm ? ' 🔸**需你确认**' : ''
    lines.push(`${s.order}. ${s.title}${mark}`)
    if (s.detail) lines.push(`   ${s.detail}`)
  }
  lines.push('', `**最终实现**：${plan.outcome}`)
  return lines.join('\n')
}
