import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 文档数据层（ADR-008）：元数据行走请求级客户端（RLS 隔离）；
// 文件对象存 Supabase Storage 私有桶，路径以 org_id 前缀隔离，存取用服务级客户端（系统级文件操作）。
export const DOC_BUCKET = 'kb-documents'

export type DocumentItem = {
  id: string
  kbId: string
  filename: string
  sizeBytes: number
  status: string
  createdAt: string
}

type DocRow = {
  id: string
  kb_id: string
  filename: string
  size_bytes: number | null
  status: string
  created_at: string | null
}

function mapRow(r: DocRow): DocumentItem {
  return {
    id: r.id,
    kbId: r.kb_id,
    filename: r.filename,
    sizeBytes: r.size_bytes ?? 0,
    status: r.status,
    createdAt: (r.created_at ?? '').slice(0, 10),
  }
}

const COLS = 'id,kb_id,filename,size_bytes,status,created_at'

export async function listDocuments(_ctx: RequestContext, kbId?: string): Promise<DocumentItem[]> {
  const supabase = await createClient()
  let q = supabase.from('documents').select(COLS).is('deleted_at', null)
  if (kbId) q = q.eq('kb_id', kbId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as DocRow[] | null) ?? []).map(mapRow)
}

export async function uploadDocument(
  ctx: RequestContext,
  input: { kbId: string; filename: string; bytes: ArrayBuffer; size: number; contentType: string },
): Promise<DocumentItem> {
  const admin = createAdminClient()
  // 存储 key 必须 ASCII 安全（中文文件名会被 Storage 拒为 Invalid key）；
  // 只用 uuid+扩展名做 key，真实文件名（含中文）保留在 DB filename 列。
  const path = `${ctx.orgId}/${crypto.randomUUID()}.pdf`
  const { error: upErr } = await admin.storage
    .from(DOC_BUCKET)
    .upload(path, input.bytes, { contentType: input.contentType, upsert: false })
  if (upErr) throw new Error(`存储上传失败：${upErr.message}`)

  // 元数据行走请求级客户端 → RLS 保证只能写本租户
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .insert({
      org_id: ctx.orgId,
      kb_id: input.kbId,
      filename: input.filename,
      storage_path: path,
      size_bytes: input.size,
      status: 'active', // 向量化在 4.2.2 接入后改为 parsing→active 流转
    })
    .select(COLS)
    .single()
  if (error) {
    // 回滚已上传的对象，避免孤儿文件
    await admin.storage.from(DOC_BUCKET).remove([path])
    throw new Error(error.message)
  }
  return mapRow(data as DocRow)
}

export async function deleteDocument(ctx: RequestContext, id: string): Promise<void> {
  const supabase = await createClient()
  // 先取 storage_path（请求级 → RLS 只能取到本租户的）
  const { data: row, error: selErr } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (selErr) throw new Error(selErr.message)
  if (!row) throw new Error('文档不存在或无权访问')

  // 软删除元数据（C6：禁物理 delete，写 deleted_at）
  const { error: updErr } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) throw new Error(updErr.message)

  // 移除存储对象（系统级）
  const admin = createAdminClient()
  await admin.storage.from(DOC_BUCKET).remove([(row as { storage_path: string }).storage_path])
}
