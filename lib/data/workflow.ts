import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import type { WorkflowGraph } from '@/lib/workflow/validate'

// 工作流数据层（ADR-008，4.4.1）：请求级客户端 + RLS，按租户隔离。
export type WorkflowItem = {
  id: string
  name: string
  type: 'workflow' | 'chatflow'
  status: 'draft' | 'published'
  version: number
  updatedAt: string
}

export type WorkflowDetail = WorkflowItem & { graph: WorkflowGraph }

const LIST_COLS = 'id,name,type,status,version,updated_at'
const DETAIL_COLS = 'id,name,type,status,version,graph,updated_at'

type Row = {
  id: string
  name: string
  type: 'workflow' | 'chatflow'
  status: 'draft' | 'published'
  version: number
  graph?: WorkflowGraph
  updated_at: string | null
}

function mapItem(r: Row): WorkflowItem {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    status: r.status,
    version: r.version,
    updatedAt: (r.updated_at ?? '').slice(0, 10),
  }
}

export async function listWorkflows(_ctx: RequestContext): Promise<WorkflowItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflows')
    .select(LIST_COLS)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as Row[] | null) ?? []).map(mapItem)
}

export async function getWorkflow(_ctx: RequestContext, id: string): Promise<WorkflowDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflows')
    .select(DETAIL_COLS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const r = data as Row
  return { ...mapItem(r), graph: r.graph ?? { nodes: [], edges: [] } }
}

export async function createWorkflow(
  ctx: RequestContext,
  input: { name: string; type?: 'workflow' | 'chatflow' },
): Promise<WorkflowDetail> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflows')
    .insert({
      org_id: ctx.orgId,
      created_by: ctx.userId,
      name: input.name,
      type: input.type ?? 'workflow',
      status: 'draft',
    })
    .select(DETAIL_COLS)
    .single()
  if (error) throw new Error(error.message)
  const r = data as Row
  return { ...mapItem(r), graph: r.graph ?? { nodes: [], edges: [] } }
}

/** 保存工作流（图 + 名称）。草稿允许非法图（前端据校验结果提示）；RLS 兜底租户隔离。 */
export async function saveWorkflow(
  _ctx: RequestContext,
  id: string,
  patch: { name?: string; graph?: WorkflowGraph },
): Promise<WorkflowDetail | null> {
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof patch.name === 'string') fields.name = patch.name.trim()
  if (patch.graph && typeof patch.graph === 'object') fields.graph = patch.graph

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflows')
    .update(fields)
    .eq('id', id)
    .is('deleted_at', null)
    .select(DETAIL_COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const r = data as Row
  return { ...mapItem(r), graph: r.graph ?? { nodes: [], edges: [] } }
}

// ── 4.4.4：版本发布 + 运行历史 ──────────────────────────────

export type WorkflowRun = {
  id: string
  status: string
  durationMs: number | null
  input: string
  output: string
  traceCount: number
  createdAt: string
}

type RunRow = {
  id: string
  status: string
  duration_ms: number | null
  input: { text?: string } | null
  output: { text?: string } | null
  node_traces: unknown[] | null
  created_at: string | null
}

/** 某工作流的运行历史（workflow_runs，RLS 按 org 隔离）。 */
export async function listRuns(_ctx: RequestContext, workflowId: string): Promise<WorkflowRun[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('id,status,duration_ms,input,output,node_traces,created_at')
    .eq('workflow_id', workflowId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return ((data as RunRow[] | null) ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    durationMs: r.duration_ms,
    input: r.input?.text ?? '',
    output: r.output?.text ?? '',
    traceCount: Array.isArray(r.node_traces) ? r.node_traces.length : 0,
    createdAt: (r.created_at ?? '').slice(0, 19).replace('T', ' '),
  }))
}

/** 发布工作流：置 published，published_version=当前 version，version 自增（供草稿继续编辑）。
 *  图合法性由调用方（API）先校验；此处只做状态推进。RLS 兜底租户隔离。 */
export async function publishWorkflow(ctx: RequestContext, id: string): Promise<WorkflowDetail | null> {
  const supabase = await createClient()
  const { data: cur } = await supabase
    .from('workflows')
    .select('version,graph')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!cur) return null
  const version = (cur as { version: number }).version
  // 4.4.10：把当前图快照为该发布版本（workflow_id+version 唯一，重复发布同版本忽略）
  const snapGraph = (cur as { graph?: WorkflowGraph }).graph ?? { nodes: [], edges: [] }
  await supabase
    .from('workflow_versions')
    .upsert(
      { org_id: ctx.orgId, workflow_id: id, version, graph: snapGraph, created_by: ctx.userId },
      { onConflict: 'workflow_id,version', ignoreDuplicates: true },
    )
  const { data, error } = await supabase
    .from('workflows')
    .update({ status: 'published', published_version: version, version: version + 1, updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select(DETAIL_COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const r = data as Row
  return { ...mapItem(r), graph: r.graph ?? { nodes: [], edges: [] } }
}

// ── 4.4.10 版本快照 / 历史 / 回滚 ─────────────────────────────────────────
export type WorkflowVersion = {
  id: string
  version: number
  note: string | null
  createdBy: string | null
  createdAt: string
}
type VRow = { id: string; version: number; note: string | null; created_by: string | null; created_at: string | null }

/** 列出某工作流的历史版本快照（版本号倒序）。RLS 按租户隔离。 */
export async function listWorkflowVersions(_ctx: RequestContext, workflowId: string): Promise<WorkflowVersion[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflow_versions')
    .select('id,version,note,created_by,created_at')
    .eq('workflow_id', workflowId)
    .order('version', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as VRow[] | null) ?? []).map((v) => ({
    id: v.id,
    version: v.version,
    note: v.note,
    createdBy: v.created_by,
    createdAt: (v.created_at ?? '').slice(0, 19).replace('T', ' '),
  }))
}

/** 回滚：把指定版本的图写回当前工作流，并置为草稿（供继续编辑再发布）。 */
export async function restoreWorkflowVersion(_ctx: RequestContext, workflowId: string, version: number): Promise<WorkflowDetail | null> {
  const supabase = await createClient()
  const { data: v } = await supabase
    .from('workflow_versions')
    .select('graph')
    .eq('workflow_id', workflowId)
    .eq('version', version)
    .maybeSingle()
  if (!v) return null
  const graph = (v as { graph?: WorkflowGraph }).graph ?? { nodes: [], edges: [] }
  const { data, error } = await supabase
    .from('workflows')
    .update({ graph, status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', workflowId)
    .is('deleted_at', null)
    .select(DETAIL_COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const r = data as Row
  return { ...mapItem(r), graph: r.graph ?? { nodes: [], edges: [] } }
}
