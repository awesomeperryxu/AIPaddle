import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getMcpServerById } from '@/lib/data/mcp-servers'
import { discoverMcpTools } from '@/lib/mcp/discover'
import { getCredentialPlaintext } from '@/lib/data/credentials'

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

  // 凭证：只在服务端解密，明文不进响应也不落日志（credentials 表 AC-15 铁律）。
  //
  // 🔴 之前这里写死匿名尝试，理由是「credentials 表为空」——那个临时假设一直没回填，
  // 结果即使用户配了凭证也用不上。2026-08-07 从生产服务器实测 8 个已配置端点
  // （GitHub / Notion / Linear / Stripe / Sentry / Cloudflare / Atlassian / 汇联易），
  // **全部返回 401**：官方远程 MCP 几乎都强制 OAuth 或 API Key，
  // 匿名 tools/list 一律拒绝。没有这一步，这个页面点开永远是错误提示。
  let secret: string | undefined
  if (server.credentialId) {
    secret = (await getCredentialPlaintext(ctx, server.credentialId)) ?? undefined
  }

  const result = await discoverMcpTools(server.endpoint, { authType: server.authType, secret })

  if (!result.ok) {
    // 连不上是事实，如实返回而非 500——用户要看到「为什么连不上」。
    // 401 且未绑凭证时，把「去哪配」一并说清楚，不让用户对着裸错误码猜。
    const needsCredential = result.code === 'auth_failed' && !server.credentialId
    return Response.json({
      ok: false,
      code: result.code,
      message: needsCredential
        ? `${result.message}。该 Server 尚未绑定凭证——请在本页「配置凭证」中填入 API Key / Token 后重试。`
        : result.message,
      needsCredential,
    })
  }
  return Response.json({
    ok: true,
    tools: result.tools,
    serverInfo: result.serverInfo,
    // 明示这是实时拉取的，不是库里的副本
    fetchedAt: new Date().toISOString(),
  })
}
