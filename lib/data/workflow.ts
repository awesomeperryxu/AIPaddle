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
  /** 展示用，已截成 YYYY-MM-DD */
  updatedAt: string
  /** 完整时间戳，乐观锁比对用（WF-28）——展示用的 updatedAt 被截过，比不出并发 */
  updatedAtIso: string | null
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
    updatedAtIso: r.updated_at,
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
/** 保存结果：冲突时不写入，调用方据此回 409（WF-28） */
export type SaveOutcome =
  | { ok: true; workflow: WorkflowDetail }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'conflict'; current: WorkflowDetail }

/**
 * 保存工作流（乐观锁版，WF-28）。
 *
 * 🔴 为什么需要锁：编辑器把图读进内存后就只认内存那份，800ms 防抖自动保存会整张覆盖回去。
 * 于是「后台修过数据 / 另一个人同时在改 / 同一账号开了两个标签页」时，
 * 旧页面随便拖一下就把新数据**静默抹掉**——2026-08-07 后台修完用户的流程后差点就这样丢掉。
 *
 * 用 updated_at 而非表里的 version 列：那个 version 是**发布版本号**（发布时 +1），
 * 草稿保存不动它，拿来当并发版本会把两种语义搅在一起。
 */
export async function saveWorkflowChecked(
  ctx: RequestContext,
  id: string,
  patch: { name?: string; graph?: WorkflowGraph },
  baseUpdatedAt?: string,
): Promise<SaveOutcome> {
  const supabase = await createClient()
  if (baseUpdatedAt) {
    const { data: cur } = await supabase
      .from('workflows').select(DETAIL_COLS).eq('id', id).is('deleted_at', null).maybeSingle()
    if (!cur) return { ok: false, reason: 'not_found' }
    const row = cur as Row
    // 毫秒级比较：时间戳字符串格式可能不同（+00 / Z / 小数位），直接比字符串会误判
    const same = new Date(row.updated_at ?? 0).getTime() === new Date(baseUpdatedAt).getTime()
    if (!same) {
      return { ok: false, reason: 'conflict', current: { ...mapItem(row), graph: row.graph ?? { nodes: [], edges: [] } } }
    }
  }
  const saved = await saveWorkflow(ctx, id, patch)
  return saved ? { ok: true, workflow: saved } : { ok: false, reason: 'not_found' }
}

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

/** 软删工作流（GX-5 补遗）：置 deleted_at=now()，不物理删除。
 *  请求级客户端 + RLS 兜底本租户隔离；Developer 仅 own 由 RLS/矩阵约束，
 *  与 saveWorkflow 一致不在此另做归属查询。幂等：已删/不存在均安全返回。 */
export async function deleteWorkflow(_ctx: RequestContext, id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('workflows')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
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

// ── GX-5：每工作流运行统计（列表页卡片用真实运行数据，非硬编码）──────────
export type WorkflowRunStats = {
  executions: number      // 总运行次数
  successRate: number     // 成功率百分比（0-100，四舍五入整数）；无运行时为 0
  lastRunAt: string | null // 最近一次运行时间（ISO），无运行为 null
}

type StatRow = { workflow_id: string; status: string; created_at: string | null }

/** 本租户各工作流的运行聚合（workflow_runs，RLS 按 org 隔离）。
 *  成功判定 = status='succeeded'（见 0001 迁移 workflow_runs.status 枚举）。
 *  返回以 workflowId 为键；从未运行的工作流不出现在结果里（前端按缺省 0 处理）。 */
export async function getWorkflowRunStats(_ctx: RequestContext): Promise<Record<string, WorkflowRunStats>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('workflow_id,status,created_at')
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  const rows = (data as StatRow[] | null) ?? []

  const acc: Record<string, { total: number; succeeded: number; lastRunAt: string | null }> = {}
  for (const r of rows) {
    const a = acc[r.workflow_id] ?? (acc[r.workflow_id] = { total: 0, succeeded: 0, lastRunAt: null })
    a.total += 1
    if (r.status === 'succeeded') a.succeeded += 1
    if (r.created_at && (a.lastRunAt === null || r.created_at > a.lastRunAt)) a.lastRunAt = r.created_at
  }

  const out: Record<string, WorkflowRunStats> = {}
  for (const [id, a] of Object.entries(acc)) {
    out[id] = {
      executions: a.total,
      successRate: a.total > 0 ? Math.round((a.succeeded / a.total) * 100) : 0,
      lastRunAt: a.lastRunAt,
    }
  }
  return out
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
