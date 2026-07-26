import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import {
  deleteKnowledgeBase,
  getKbChunkConfig,
  listKbAgents,
  setKbAgents,
  setKbChunkConfig,
  setKbVisibility,
  type KbVisibility,
} from '@/lib/data/knowledge'
import { normalizeChunkConfig } from '@/lib/kb/ingest'

// GET /api/knowledge-bases/[id] —— 该知识库当前关联的 Agent（4.2.8 权限范围面板用）
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  const [agents, chunkConfig] = await Promise.all([
    listKbAgents(ctx, id),
    getKbChunkConfig(ctx, id),
  ])
  return Response.json({ agents, chunkConfig })
}

// PATCH /api/knowledge-bases/[id] —— 设置可见性 / 覆盖关联 Agent（4.2.8）
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'knowledge:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理知识库权限范围' } }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json().catch(() => ({} as Record<string, unknown>))

  if (body?.visibility !== undefined) {
    const v = String(body.visibility)
    if (v !== 'org' && v !== 'restricted') {
      return Response.json({ error: { code: 'invalid', message: '可见性取值非法' } }, { status: 400 })
    }
    await setKbVisibility(ctx, id, v as KbVisibility)
  }

  if (body?.agentIds !== undefined) {
    if (!Array.isArray(body.agentIds) || body.agentIds.some((x: unknown) => typeof x !== 'string')) {
      return Response.json({ error: { code: 'invalid', message: 'agentIds 非法' } }, { status: 400 })
    }
    await setKbAgents(ctx, id, body.agentIds as string[])
  }

  // 4.2.7：切块参数（应用层规整后落库）
  if (body?.chunkConfig !== undefined && body.chunkConfig !== null) {
    if (typeof body.chunkConfig !== 'object') {
      return Response.json({ error: { code: 'invalid', message: 'chunkConfig 非法' } }, { status: 400 })
    }
    await setKbChunkConfig(ctx, id, normalizeChunkConfig(body.chunkConfig as Record<string, unknown>))
  }

  return Response.json({ ok: true })
}

// DELETE /api/knowledge-bases/[id] —— 软删除知识库及其文档（4.2.9）
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'knowledge:delete')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：删除知识库' } }, { status: 403 })
  }
  const { id } = await params
  await deleteKnowledgeBase(ctx, id)
  return Response.json({ ok: true })
}
