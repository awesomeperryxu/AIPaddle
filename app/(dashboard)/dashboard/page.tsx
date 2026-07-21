import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { getDashboardStats } from '@/lib/data/dashboard'
import { DashboardView } from '@/components/views/dashboard-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const stats = await getDashboardStats(ctx)
  return <DashboardView stats={stats} />
}
