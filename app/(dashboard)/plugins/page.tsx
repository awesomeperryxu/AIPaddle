import { redirect } from 'next/navigation'

// Plugin 根路径重定向到 MCP —— 它是三类里存量最多的（迁移后 33 个 Plugin 中绝大多数是 MCP）
export default function Page() {
  redirect('/plugins/mcp')
}
