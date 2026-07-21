import { getRequestContext } from '@/lib/context'
import { listMyMcpServers } from '@/lib/data/mcp-servers'

// GET /api/mcp-servers/mine —— 当前用户按角色+部门可见的已审批 MCP 清单（S3-08）。
// 供 Skill 创建表单 Server 下拉。过滤在 my_mcp_servers 视图内完成：无权限角色/部门
// 天然查不到（列表不出现）。任意登录用户可调，但只会看到自己有权的 Server。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) {
    return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  }
  const servers = await listMyMcpServers(ctx)
  return Response.json({ servers })
}
