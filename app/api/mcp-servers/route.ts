import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listMcpServers, createMcpServer, type McpType } from '@/lib/data/mcp-servers'

// GET /api/mcp-servers —— 管理端全量清单（含 draft/pending/disabled）。权限 mcp:read（Admin/Auditor）。
// 无权限用户（User/Developer）→ 403，看不到管理清单（S3-08 的管理端一侧）。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'mcp:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看 MCP 管理清单' } }, { status: 403 })
  }
  const servers = await listMcpServers(ctx)
  return Response.json({ servers })
}

// POST /api/mcp-servers —— 注册 MCP Server。权限 mcp:create（Admin/Developer）。注册一律 draft。
export async function POST(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  if (!can(ctx, 'mcp:create')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：注册 MCP Server' } }, { status: 403 })
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const name = String(body?.name ?? '').trim()
  const endpoint = String(body?.endpoint ?? '').trim()
  if (!name) return Response.json({ error: { code: 'invalid', message: '名称不能为空' } }, { status: 400 })
  if (!endpoint) return Response.json({ error: { code: 'invalid', message: 'endpoint 不能为空' } }, { status: 400 })

  const type: McpType = ['builtin', 'enterprise', 'third_party', 'private'].includes(String(body?.type))
    ? (body.type as McpType)
    : 'enterprise'
  const server = await createMcpServer(ctx, {
    name,
    endpoint,
    type,
    description: typeof body?.description === 'string' ? body.description : undefined,
    scope: typeof body?.scope === 'string' ? body.scope : undefined,
    allowedRoles: Array.isArray(body?.allowedRoles) ? body.allowedRoles.map(String) : undefined,
    allowedDepartments: Array.isArray(body?.allowedDepartments) ? body.allowedDepartments.map(String) : undefined,
  })
  return Response.json({ server }, { status: 201 })
}
