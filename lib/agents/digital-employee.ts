// ADR-014 / 4.1.18：数字员工 = 引用了子 Agent 的 Agent（同 agents 表派生）。
// 校验子 Agent 绑定：不能自引、不能纳入本身是数字员工的 Agent（嵌套仅 1 层）、须为用户有权使用者。
// 纯函数，前后端可共用；权限/派生数据由调用方（API 层）备好。

export function isDigitalEmployee(subAgentIds: string[]): boolean {
  return subAgentIds.length > 0
}

export type SubAgentReject = { id: string; reason: string }

export function validateSubAgents(input: {
  selfId: string
  candidateIds: string[]
  authorizedIds: Set<string> // 用户有 agent:chat 权限的候选（服务端裁定）
  digitalEmployeeIds: Set<string> // 候选中本身已是数字员工（含子 Agent）的
}): { accepted: string[]; rejected: SubAgentReject[] } {
  const accepted: string[] = []
  const rejected: SubAgentReject[] = []
  const seen = new Set<string>()
  for (const id of input.candidateIds) {
    if (seen.has(id)) continue
    seen.add(id)
    if (id === input.selfId) {
      rejected.push({ id, reason: '不能把自己作为子 Agent' })
    } else if (!input.authorizedIds.has(id)) {
      rejected.push({ id, reason: '你无权使用该 Agent，已跳过' })
    } else if (input.digitalEmployeeIds.has(id)) {
      rejected.push({ id, reason: '该 Agent 本身是数字员工，嵌套仅限一层，已跳过' })
    } else {
      accepted.push(id)
    }
  }
  return { accepted, rejected }
}
