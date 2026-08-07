import { notFound, redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getDigitalEmployeeDetail } from '@/lib/data/digital-employee'
import { DigitalEmployeeDetailView } from '@/components/views/digital-employee-detail-view'

// DE-4/DE-5：数字员工详情页。此前点数字员工只会打开对话，
// 既看不到它由哪些下级 Agent 组成，也无从知道是谁什么时候建的、现在还能不能用。
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const detail = await getDigitalEmployeeDetail(ctx, id)
  if (!detail) notFound()

  return <DigitalEmployeeDetailView detail={detail} canEdit={can(ctx, 'agent:update')} />
}
