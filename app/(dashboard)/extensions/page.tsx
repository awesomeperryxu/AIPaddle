import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { ExtensionsView } from '@/components/views/extensions-view'

// V12-8.10：扩展能力管理页（PRD §6 一级菜单「扩展能力」）。
// 权限由 API 服务端强制（ext:read/create/...），此处只挡未登录——
// 前端隐藏入口不算数（CLAUDE.md 铁律）。
export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  return <ExtensionsView />
}
