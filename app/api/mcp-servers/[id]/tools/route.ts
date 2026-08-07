import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getMcpServerById } from '@/lib/data/mcp-servers'
import { discoverMcpTools } from '@/lib/mcp/discover'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/mcp-servers/[id]/tools —— 连接 Server 并拉取其 tools 清单（ADR-024）。
//
// 🔴 不缓存到数据库：MCP 规范里 tools 由 Server 动态提供、可随时变更
// （notifications/tools/list_changed）。落静态副本的下场是本项目已有的教训——
// 164 条手工维护的 Tool 记录，既无来源也跑不通。
// 前端按需拉取并在会话内缓存即可；要看最新的就重新点一次。
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'mcp:read')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：查看 MCP Server' } }, { status: 403 })
  }

  const { id } = await params
  const server = await getMcpServerById(ctx, id)
  if (!server) return Response.json({ error: { code: 'not_found', message: '不存在或无权访问' } }, { status: 404 })

  if (!server.endpoint) {
    return Response.json({
      ok: false, code: 'no_endpoint',
      message: '该 Server 尚未配置 Endpoint，请先填写服务地址',
    })
  }

  // 凭证：auth_config 不出现在 SELECT（数据层刻意如此），此处按需另取。
  // 当前 credentials 表为空，未配凭证时以匿名尝试——多数公开 MCP 允许匿名 tools/list，
  // 需要授权的会返回 401，前端据此提示填 Key。
  const result = await discoverMcpTools(server.endpoint, { authType: server.authType })

  if (!result.ok) {
    // 连不上是事实，如实返回而非 500——用户要看到「为什么连不上」
    return Response.json({ ok: false, code: result.code, message: result.message })
  }
  return Response.json({
    ok: true,
    tools: result.tools,
    serverInfo: result.serverInfo,
    // 明示这是实时拉取的，不是库里的副本
    fetchedAt: new Date().toISOString(),
  })
}
