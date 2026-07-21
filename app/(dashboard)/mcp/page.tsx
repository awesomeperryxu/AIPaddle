import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listMcpServers } from '@/lib/data/mcp-servers'
import { McpView } from '@/components/views/mcp-view'

// MCP 管理中心（4.3.0b）：仅 mcp:read（Admin/Auditor）可见管理端全量清单；其余重定向。
export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  if (!can(ctx, 'mcp:read')) redirect('/dashboard')
  const servers = await listMcpServers(ctx)
  return (
    <McpView
      servers={servers}
      canCreate={can(ctx, 'mcp:create')}
      canReview={can(ctx, 'mcp:review')}
    />
  )
}
