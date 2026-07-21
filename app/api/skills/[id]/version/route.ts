import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { bumpSkillVersion } from '@/lib/data/skills'
import { writeAudit } from '@/lib/data/audit'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/skills/[id]/version  body: { version }
// 升版本（S3-05）：当前版本快照进 config.versions（旧版本仍可查），version 置新值。权限 skill:update。
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'skill:update')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：升版本' } }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const version = String(body?.version ?? '').trim()
  if (!version) return Response.json({ error: { code: 'invalid', message: '版本号不能为空' } }, { status: 400 })

  const skill = await bumpSkillVersion(ctx, id, version)
  if (!skill) return Response.json({ error: { code: 'not_found', message: 'Skill 不存在' } }, { status: 404 })
  await writeAudit(ctx, 'skill.version', 'skill', id, { version })
  return Response.json({ skill })
}
