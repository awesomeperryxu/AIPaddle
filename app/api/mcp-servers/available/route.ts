import { getRequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// GET /api/mcp-servers/available
// 返回当前用户（按角色+部门）可见的已审批 MCP Server 列表，用于 Agent 编排页工具绑定 UI。
// 安全边界：仅返回 status='approved' 的 Server；auth_config 等敏感字段不返回给前端。
export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })

  const supabase = await createClient()
  // 使用 my_mcp_servers 视图（已按 approved + 角色+部门过滤，ADR-004）
  const { data, error } = await supabase
    .from('my_mcp_servers')
    .select('id,name,description,type,security_level,scope,endpoint')
    .is('deleted_at', null)
    .order('name')
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })

  // 不向前端暴露 auth_config/auth_type（凭据引用）
  return Response.json({ mcpServers: data ?? [] })
}
