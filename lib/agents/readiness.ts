// Agent 配置完整度判定。纯函数、无 IO，供列表徽标、编排页提示与体检脚本共用同一套口径。
//
// 背景：从 Dify / WorkBuddy 之类外部平台导入的 Agent 只搬得动「文本资产」（提示词、描述）——
// 模型、知识库、Skill、Tool 这些**能力接线**搬不过来（两边工具模型不通用）。
// 结果是大量「看着能用、实际是裸 LLM 聊天」的空壳，一度还全是 published 状态。
//
// 🔴 关于「安装」：AIPaddle 的 skill_installs 按 **user_id** 记录，是「加到我的 Skill」的个人收藏，
//    与 Dify「插件必须安装才能运行」不是一回事——Agent 挂载与调用 Skill **都不校验安装态**。
//    所以判定「能不能干活」看的是**挂载**，不是安装。

export type AgentReadinessInput = {
  hasSystemPrompt: boolean
  hasModel: boolean
  knowledgeBaseCount: number
  skillCount: number
  toolCount: number
  mcpCount: number
  subAgentCount: number
  /** 挂载的 Skill 中尚未发布的名称——这个会真的让调用失败 */
  unpublishedSkillNames?: string[]
}

export type ReadinessGap = {
  code: 'system-prompt' | 'model' | 'ability' | 'unpublished-dep'
  label: string
  /** 告诉用户去哪补、不补会怎样——只说「缺 X」没有行动价值 */
  hint: string
  severity: 'blocking' | 'warning'
}

export type AgentReadiness = {
  gaps: ReadinessGap[]
  /** 空壳：无模型且无任何能力资源。两者皆缺才算，避免误伤纯提示词型 Agent */
  isShell: boolean
  /** 可发布：没有 blocking 级缺口 */
  publishable: boolean
}

export function assessAgentReadiness(i: AgentReadinessInput): AgentReadiness {
  const gaps: ReadinessGap[] = []

  if (!i.hasSystemPrompt) {
    gaps.push({
      code: 'system-prompt', label: '未设系统提示词', severity: 'blocking',
      hint: '去「编排」页填写角色设定，否则模型没有任何行为约束',
    })
  }

  if (!i.hasModel) {
    gaps.push({
      code: 'model', label: '未设模型', severity: 'warning',
      hint: '去「编排」页选择模型；当前会回落租户默认模型，行为不受该 Agent 控制',
    })
  }

  const abilityCount =
    i.knowledgeBaseCount + i.skillCount + i.toolCount + i.mcpCount + i.subAgentCount
  if (abilityCount === 0) {
    gaps.push({
      code: 'ability', label: '未挂载能力', severity: 'warning',
      hint: '未挂任何知识库 / Skill / Tool / 子 Agent——它现在只是裸 LLM 对话，不具备平台增强能力',
    })
  }

  const unpub = i.unpublishedSkillNames ?? []
  if (unpub.length > 0) {
    gaps.push({
      code: 'unpublished-dep', label: '依赖未过审', severity: 'blocking',
      hint: `挂载的 Skill 尚未发布：${unpub.join('、')}——需先完成上架审核，否则调用会失败`,
    })
  }

  return {
    gaps,
    isShell: !i.hasModel && abilityCount === 0,
    publishable: !gaps.some((g) => g.severity === 'blocking'),
  }
}
