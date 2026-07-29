import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { OfficeToolsView } from '@/components/views/office-tools-view'

// 办公文件处理（4.2.4 通道①）：上传 PDF → AI 处理 → 生成文件下载。knowledge:read 门控。
export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  if (!can(ctx, 'knowledge:read')) {
    return (
      <div className="p-8 text-sm text-muted-foreground">无权限访问办公文件处理。</div>
    )
  }
  return <OfficeToolsView />
}
