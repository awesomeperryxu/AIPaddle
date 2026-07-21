import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 数据层（ADR-008）：唯一访问 workflows 表的地方，首参 ctx，用请求级客户端（RLS 生效）。
// graph（画布节点/连线/配置）直存 jsonb；图结构校验由 API 层在保存前调用 validate.ts。

export type WorkflowType = 'workflow' | 'chatflow'
export type WorkflowStatus = 'draft' | 'published'

/** graph jsonb 的最小形状；nodes/edges 具体结构由 components/workflow/types 约定 */
export type WorkflowGraphJson = { nodes: unknown[]; edges: unknown[]; [k: string]: unknown }

export type WorkflowSummary = {
  id: string
  name: string
  type: WorkflowType
  status: WorkflowStatus
  version: number
  createdAt: string
  updatedAt: string
}
export type WorkflowDetail = WorkflowSummary & { graph: WorkflowGraphJson }

type Row = {
  id: string
  name: string
  type: WorkflowType
  status: WorkflowStatus
  version: number | null
  graph: WorkflowGraphJson | null
  created_at: string | null
  updated_at: string | null
}

const LIST_COLS = 'id,name,type,status,version,created_at,updated_at'
const FULL_COLS = 'id,name,type,status,version,graph,created_at,updated_at'
const EMPTY_GRAPH: WorkflowGraphJson = { nodes: [], edges: [] }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mapSummary(r: Row): WorkflowSummary {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    status: r.status,
    version: r.version ?? 1,
    createdAt: (r.created_at ?? '').slice(0, 10),
    updatedAt: r.updated_at ?? '',
  }
}
function mapDetail(r: Row): WorkflowDetail {
  return { ...mapSummary(r), graph: r.graph ?? EMPTY_GRAPH }
}

export async function listWorkflows(_ctx: RequestContext): Promise<WorkflowSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflows')
    .select(LIST_COLS)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Row[] | null ?? []).map(mapSummary)
}

// 按 id 取完整工作流（含 graph）。RLS 只放行本租户 → 他租户 id 返回 null（路由回 404）。
// 非法 UUID 直接当不存在，避免 DB 抛错变 500。
export async function getWorkflowById(_ctx: RequestContext, id: string): Promise<WorkflowDetail | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflows')
    .select(FULL_COLS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapDetail(data as Row) : null
}

export async function createWorkflow(
  ctx: RequestContext,
  input: { name: string; type?: WorkflowType; graph?: WorkflowGraphJson },
): Promise<WorkflowDetail> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflows')
    .insert({
      org_id: ctx.orgId,
      created_by: ctx.userId,
      name: input.name.trim(),
      type: input.type ?? 'workflow',
      graph: input.graph ?? EMPTY_GRAPH,
      status: 'draft', // 创建一律 draft，发布须走审核（4.4.4）
    })
    .select(FULL_COLS)
    .single()
  if (error) throw new Error(error.message)
  return mapDetail(data as Row)
}

// 更新工作流名称/图。RLS 兜底租户隔离：他租户 id 影响 0 行 → null → 路由 404。
// graph 的结构校验由 API 层在调用本函数前完成（非法图返回 422，不落库）。
export async function updateWorkflow(
  _ctx: RequestContext,
  id: string,
  patch: { name?: string; graph?: WorkflowGraphJson },
): Promise<WorkflowDetail | null> {
  if (!UUID_RE.test(id)) return null
  const fields: Record<string, unknown> = {}
  if (typeof patch.name === 'string') fields.name = patch.name.trim()
  if (patch.graph !== undefined) fields.graph = patch.graph
  if (Object.keys(fields).length === 0) return getWorkflowById(_ctx, id)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflows')
    .update(fields)
    .eq('id', id)
    .is('deleted_at', null)
    .select(FULL_COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapDetail(data as Row) : null
}

// 软删除（置 deleted_at）。他租户 id 或已删行影响 0 行 → false → 路由 404，幂等且不泄露存在性。
export async function deleteWorkflow(_ctx: RequestContext, id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflows')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return !!data
}
