import { getRequestContext } from '@/lib/context'
import { getTemplate } from '@/lib/data/templates'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: '未登录' }, { status: 401 })

  const { id } = await params
  const template = await getTemplate(ctx, id)
  if (!template) return Response.json({ error: '模板不存在' }, { status: 404 })

  return Response.json({ template })
}
