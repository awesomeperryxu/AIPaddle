import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { listTemplates } from '@/lib/data/templates'
import { TemplatesView } from '@/components/views/templates-view'

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')

  const templates = await listTemplates(ctx)
  return <TemplatesView initialTemplates={templates} />
}
