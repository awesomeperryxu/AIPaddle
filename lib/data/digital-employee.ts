import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import type { Agent } from '@/lib/mock-data'

// DE-4/DE-5：数字员工详情——下级 Agent 清单 + 创建溯源。
//
// 为什么单开一个数据层文件而不塞进 agents.ts：
// 这里查的是「一个 Agent 作为**上级**时的样子」——它的下级是谁、下级各自什么状态、
// 谁在什么时候建的。agents.ts 关心的是 Agent 自身（config/status/metrics），
// 两者的调用方也不同（详情页 vs 编排页）。混在一起会让 agents.ts 的 COLS 越滚越大。
//
// 有效性判定（DE-6/7/8）会读本文件产出的 subAgents[].status，此处只如实返回，不下结论。

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type SubAgentBrief = {
  id: string
  name: string
  department: string
  description: string
  status: Agent['status']
}

/** 创建来源（ADR-013 四类的可读表述） */
export type OriginLabel = '平台内置·强制' | '平台市场' | '用户自建'

export type DigitalEmployeeDetail = {
  id: string
  name: string
  description: string
  department: string
  status: Agent['status']
  /** 下级 Agent（数字员工的定义：≥1 个）。普通 Agent 查出来是空数组 */
  subAgents: SubAgentBrief[]
  /** memberIds 里存在、但 agents 表已查不到的（已软删）——如实计数，不静默吞掉 */
  missingSubAgentIds: string[]
  // ── 创建溯源 ──
  createdByName: string
  createdAt: string
  updatedAt: string
  origin: OriginLabel
  model: string
}

function originLabel(origin: unknown, mandatory: unknown): OriginLabel {
  if (origin === 'platform') return mandatory === true ? '平台内置·强制' : '平台市场'
  return '用户自建'
}

/**
 * 取数字员工详情。RLS 兜底租户隔离；不存在/他租户 → null。
 *
 * 🔴 三次查询而不是一次 join：`agent_resources.resource_id` 是**裸 uuid 没有外键**
 * （它按 resource_type 指向不同的表，见 0001 的注释），PostgREST 推导不出关系，
 * 写成嵌套 select 会直接报错。
 */
export async function getDigitalEmployeeDetail(
  _ctx: RequestContext,
  id: string,
): Promise<DigitalEmployeeDetail | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from('agents')
    .select('id,name,description,department,status,created_by,created_at,updated_at,origin,mandatory,config')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!row) return null

  // 下级 Agent id
  const { data: resRows, error: resErr } = await supabase
    .from('agent_resources')
    .select('resource_id')
    .eq('agent_id', id)
    .eq('resource_type', 'agent')
    .is('deleted_at', null)
  if (resErr) throw new Error(resErr.message)
  const subIds = [...new Set(((resRows as { resource_id: string }[] | null) ?? []).map(r => r.resource_id))]

  let subAgents: SubAgentBrief[] = []
  if (subIds.length > 0) {
    const { data: subs, error: subErr } = await supabase
      .from('agents')
      .select('id,name,description,department,status')
      .in('id', subIds)
      .is('deleted_at', null)
    if (subErr) throw new Error(subErr.message)
    subAgents = ((subs as Record<string, unknown>[] | null) ?? []).map(s => ({
      id: s.id as string,
      name: s.name as string,
      department: (s.department ?? '') as string,
      description: (s.description ?? '') as string,
      status: s.status as Agent['status'],
    }))
  }
  const found = new Set(subAgents.map(s => s.id))
  const missingSubAgentIds = subIds.filter(x => !found.has(x))

  // 创建人姓名：查不到就如实显示「—」，不编造
  let createdByName = '—'
  if (row.created_by) {
    const { data: u } = await supabase
      .from('users').select('name').eq('id', row.created_by).maybeSingle()
    if (u?.name) createdByName = u.name as string
  }

  const cfg = (row.config ?? {}) as Record<string, unknown>
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description ?? '') as string,
    department: (row.department ?? '') as string,
    status: row.status as Agent['status'],
    subAgents,
    missingSubAgentIds,
    createdByName,
    createdAt: String(row.created_at ?? '').slice(0, 19).replace('T', ' '),
    updatedAt: String(row.updated_at ?? '').slice(0, 19).replace('T', ' '),
    origin: originLabel(row.origin, row.mandatory),
    model: typeof cfg.model === 'string' ? cfg.model : '',
  }
}
