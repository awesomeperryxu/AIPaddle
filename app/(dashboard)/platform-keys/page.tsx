import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { isPlatformAdmin } from '@/lib/auth/platform'
import { listAllApiKeys } from '@/lib/data/platform-keys'
import { PlatformKeysView } from '@/components/views/platform-keys-view'

// Key-2：全平台 Key 总览。ADR-008 server 组件只调 lib/data/*，把真实数据交给 client 视图。
// ADR-010：平台超管门控在服务端强制，前端隐藏菜单不算数。
export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')

  if (!(await isPlatformAdmin(ctx))) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">无访问权限</h2>
          <p className="text-sm text-muted-foreground">
            全平台 Key 总览仅平台超管可用；租户管理员请在「Key 管理」查看本租户 Key
          </p>
        </div>
      </div>
    )
  }

  return <PlatformKeysView initialKeys={await listAllApiKeys()} />
}
