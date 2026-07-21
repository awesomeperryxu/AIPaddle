import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { listReviews } from '@/lib/data/reviews'
import { SecurityView } from '@/components/views/security-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  const reviews = await listReviews(ctx)
  return <SecurityView reviews={reviews} />
}
