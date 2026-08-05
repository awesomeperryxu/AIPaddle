import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { listAllApiKeys } from '@/lib/data/platform-keys'
import { KeysView } from '@/components/views/keys-view'
import { PlatformKeysView } from '@/components/views/platform-keys-view'

// Key-2：Key 管理单一入口，服务端按身份分流——
//   平台超管   → 全平台跨租户视图（清点 / 审计 / 吊销）
//   租户 Admin → 本租户视图（签发 / 吊销）
// 🔴 分流在服务端做，不靠前端隐藏；两条分支背后的 API 各自门控，越权路径走不通。
export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')

  if (await isPlatformAdmin(ctx)) {
    return <PlatformKeysView initialKeys={await listAllApiKeys()} />
  }

  if (!can(ctx, 'apikey:manage')) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">无访问权限</h2>
          <p className="text-sm text-muted-foreground">仅 Admin 可管理对外 API Key</p>
        </div>
      </div>
    )
  }

  return <KeysView />
}
