import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getMcpServerById, updateMcpServer, deleteMcpServer } from '@/lib/data/mcp-servers'
import type { McpSecurityLevel } from '@/lib/data/mcp-servers'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/mcp-servers/[id] —— 单个 Server 详情。权限 mcp:read。他租户/不存在 → 404。
export async function GET(_request: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'mcp:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限' } }, { status: 403 })
  }
  const { id } = await params
  const server = await getMcpServerById(ctx, id)
  if (!server) return Response.json({ error: { code: 'not_found', message: 'MCP Server 不存在' } }, { status: 404 })
  return Response.json({ server })
}

// PATCH /api/mcp-servers/[id] —— 编辑。权限 mcp:update。
export async function PATCH(request: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'mcp:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：编辑 MCP Server' } }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const patch: Parameters<typeof updateMcpServer>[2] = {}
  if (typeof body?.name === 'string') patch.name = body.name
  if (typeof body?.description === 'string') patch.description = body.description
  if (typeof body?.endpoint === 'string') patch.endpoint = body.endpoint
  if (typeof body?.scope === 'string') patch.scope = body.scope
  if (['low', 'medium', 'high'].includes(String(body?.securityLevel)))
    patch.securityLevel = body.securityLevel as McpSecurityLevel
  if (Array.isArray(body?.allowedRoles)) patch.allowedRoles = body.allowedRoles.map(String)
  if (Array.isArray(body?.allowedDepartments)) patch.allowedDepartments = body.allowedDepartments.map(String)

  const server = await updateMcpServer(ctx, id, patch)
  if (!server) return Response.json({ error: { code: 'not_found', message: 'MCP Server 不存在' } }, { status: 404 })
  return Response.json({ server })
}

// DELETE /api/mcp-servers/[id] —— 软删除。权限 mcp:delete（Admin）。
export async function DELETE(_request: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'mcp:delete')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：删除 MCP Server' } }, { status: 403 })
  }
  const { id } = await params
  const ok = await deleteMcpServer(ctx, id)
  if (!ok) return Response.json({ error: { code: 'not_found', message: 'MCP Server 不存在' } }, { status: 404 })
  return Response.json({ ok: true })
}
