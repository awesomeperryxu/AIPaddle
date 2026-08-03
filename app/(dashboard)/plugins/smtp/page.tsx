import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { PluginProviderView } from '@/components/views/plugin-provider-view'

// V12-4.9：Plugin → SMTP 页（PRD §6 一级菜单「Plugin」第四类）。
// 权限由 API 服务端强制（plugin:read/create/…），此处只挡未登录——
// 前端隐藏入口不算数（CLAUDE.md 铁律）。
export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  return <PluginProviderView providerType="smtp" />
}
