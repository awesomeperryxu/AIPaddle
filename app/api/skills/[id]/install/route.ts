import { getRequestContext } from '@/lib/context'
import { installSkill, uninstallSkill } from '@/lib/data/skills'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/skills/[id]/install —— 安装（S3-03）。只能装已发布；幂等（重复安装计数不变）。
// 任意登录用户可安装本租户已发布 Skill；他租户 → 404（RLS）。
export async function POST(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  const r = await installSkill(ctx, id)
  if (!r.ok) {
    if (r.reason === 'not_found')
      return Response.json({ error: { code: 'not_found', message: 'Skill 不存在' } }, { status: 404 })
    return Response.json({ error: { code: 'not_published', message: '仅已发布 Skill 可安装' } }, { status: 409 })
  }
  return Response.json({ ok: true, installs: r.installs })
}

// DELETE /api/skills/[id]/install —— 卸载（S3-03，幂等）。
export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  const r = await uninstallSkill(ctx, id)
  if (!r.ok) return Response.json({ error: { code: 'not_found', message: 'Skill 不存在' } }, { status: 404 })
  return Response.json({ ok: true, installs: r.installs })
}
