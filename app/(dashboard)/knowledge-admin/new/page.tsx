import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { KnowledgeAdminNewView } from '@/components/views/knowledge-admin-new-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  if (!can(ctx, 'knowledge:create')) redirect('/knowledge-admin')

  return <KnowledgeAdminNewView />
}
