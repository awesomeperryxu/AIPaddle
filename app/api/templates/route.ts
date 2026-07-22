import { getRequestContext } from '@/lib/context'
import { listTemplates } from '@/lib/data/templates'
import type { TemplateType } from '@/lib/data/templates'

export async function GET(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type     = searchParams.get('type') as TemplateType | null
  const category = searchParams.get('category') ?? undefined
  const search   = searchParams.get('search') ?? undefined

  const templates = await listTemplates(ctx, {
    type: type ?? undefined,
    category,
    search,
  })

  return Response.json({ templates })
}
