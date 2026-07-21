import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { getDashboardData } from '@/lib/data/dashboard'
import { DashboardView } from '@/components/views/dashboard-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const data = await getDashboardData(ctx)
  return <DashboardView data={data} />
}
