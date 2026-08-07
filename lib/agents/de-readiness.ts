// 数字员工「可用性体检」（DE-6）。形状照搬 lib/workflow/readiness.ts：
// 纯静态、不调模型、不发请求、零副作用，只回 { ready, issues[] }。
//
// 🔴 为什么必须有这一层：数字员工自身状态是 published，不代表它跑得起来。
// 它的活干在下级 Agent 身上——下级是草稿、已下线或已被删除，调用时才失败，
// 而页面上一路显示"已发布"。2026-08-07 实测线上 19 个数字员工里 **16 个**
// 有失效下级（65 行 agent_resources 指向已删除的 Agent），全部是 published。
//
// 判定只看"下级能不能被调用"，不重复校验层级规则——那是 validateSubAgents 的事
// （ADR-026 §1：R1 Agent 下不可挂 Agent、R2 Agent 的上级不可以是 Agent）。

export type DeReadinessLevel = 'error' | 'warn'

export type DeReadinessIssue = {
  level: DeReadinessLevel
  code: 'sub_agent_missing' | 'sub_agent_unpublished' | 'sub_agent_pending' | 'no_sub_agent'
  subAgentId?: string
  subAgentName?: string
  message: string
}

export type DeReadinessReport = {
  /** 无 error 即可发布；warn 只提示不拦 */
  ready: boolean
  issues: DeReadinessIssue[]
  /** 体检覆盖的下级数量（含查不到的） */
  checked: number
}

export type SubAgentState = {
  id: string
  name: string
  status: 'draft' | 'pending' | 'published' | 'offline'
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  pending: '待审核',
  published: '已发布',
  offline: '已下线',
}

/**
 * 体检一个数字员工的下级是否都可用。
 *
 * @param subAgents        能查到的下级（已按 org 隔离过）
 * @param missingIds       agent_resources 里有、但 agents 表查不到的（已软删）
 * @param isDigitalEmployee 是否按数字员工口径体检。普通 Agent（无下级）不该报"没有下级"
 */
export function checkDigitalEmployee(
  subAgents: SubAgentState[],
  missingIds: string[] = [],
  isDigitalEmployee = true,
): DeReadinessReport {
  const issues: DeReadinessIssue[] = []

  // 已被删除的下级——error。这类最隐蔽：页面上连名字都不显示，
  // 只表现为"组成里少了一个"，不主动报就永远没人发现。
  for (const id of missingIds) {
    issues.push({
      level: 'error',
      code: 'sub_agent_missing',
      subAgentId: id,
      message: '下级 Agent 已被删除，调用时会失败',
    })
  }

  for (const s of subAgents) {
    if (s.status === 'published') continue
    // 🔴 待审核单独归 warn 而非 error：它代表"正在走流程"，是过程态不是坏状态，
    // 拦住发布只会让审核流程互相死锁（上级等下级发布、下级等审核）。
    // 草稿与已下线则是 error——前者没人打算发布它，后者是被人为停掉的。
    const pending = s.status === 'pending'
    issues.push({
      level: pending ? 'warn' : 'error',
      code: pending ? 'sub_agent_pending' : 'sub_agent_unpublished',
      subAgentId: s.id,
      subAgentName: s.name,
      message: `下级「${s.name}」当前是${STATUS_LABEL[s.status] ?? s.status}，${
        pending ? '发布后才会参与运行' : '无法参与运行'
      }`,
    })
  }

  // 声称是数字员工却一个下级都没有——多半是下级被删光了。
  // 归 warn 不归 error：它此刻等价于一个普通 Agent，仍能对话，只是名不副实。
  if (isDigitalEmployee && subAgents.length === 0 && missingIds.length === 0) {
    issues.push({
      level: 'warn',
      code: 'no_sub_agent',
      message: '没有任何下级 Agent，当前等同于一个普通 Agent',
    })
  }

  return {
    ready: !issues.some((i) => i.level === 'error'),
    issues,
    checked: subAgents.length + missingIds.length,
  }
}

/** 供 UI / API 错误信息直接使用的一句话摘要 */
export function summarizeDeReadiness(r: DeReadinessReport): string {
  const errs = r.issues.filter((i) => i.level === 'error')
  if (errs.length === 0) return '全部下级可用'
  const names = errs
    .map((e) => e.subAgentName ?? e.subAgentId ?? '未知')
    .slice(0, 5)
    .join('、')
  return `${errs.length} 个下级不可用：${names}${errs.length > 5 ? ' 等' : ''}`
}
