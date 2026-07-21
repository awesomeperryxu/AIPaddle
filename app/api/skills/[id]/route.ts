import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getSkillById, updateSkill, deleteSkill, type SkillConfig, type RiskLevel } from '@/lib/data/skills'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/skills/[id] —— 详情。他租户/不存在 → 404。
export async function GET(_request: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  const { id } = await params
  const skill = await getSkillById(ctx, id)
  if (!skill) return Response.json({ error: { code: 'not_found', message: 'Skill 不存在' } }, { status: 404 })
  return Response.json({ skill })
}

// PATCH /api/skills/[id] —— 编辑。权限 skill:update。
export async function PATCH(request: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'skill:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：编辑 Skill' } }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const patch: Parameters<typeof updateSkill>[2] = {}
  if (typeof body?.name === 'string') patch.name = body.name
  if (typeof body?.description === 'string') patch.description = body.description
  if (typeof body?.documentation === 'string') patch.documentation = body.documentation
  if (['low', 'medium', 'high'].includes(String(body?.riskLevel))) patch.riskLevel = body.riskLevel as RiskLevel
  if (Array.isArray(body?.tags)) patch.tags = body.tags.map(String)
  if (body?.config && typeof body.config === 'object') patch.config = body.config as SkillConfig

  const skill = await updateSkill(ctx, id, patch)
  if (!skill) return Response.json({ error: { code: 'not_found', message: 'Skill 不存在' } }, { status: 404 })
  return Response.json({ skill })
}

// DELETE /api/skills/[id] —— 软删除。权限 skill:delete。
export async function DELETE(_request: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'skill:delete')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：删除 Skill' } }, { status: 403 })
  }
  const { id } = await params
  const ok = await deleteSkill(ctx, id)
  if (!ok) return Response.json({ error: { code: 'not_found', message: 'Skill 不存在' } }, { status: 404 })
  return Response.json({ ok: true })
}
