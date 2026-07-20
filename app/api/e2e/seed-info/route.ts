import { createAdminClient } from '@/lib/supabase/admin'

// ⚠️ 测试专用端点：仅供 E2E 隔离用例获取 orgA 的已知资源 id（S0-ISO-01/03/04）。
// 生产环境（NODE_ENV=production，服务器 pnpm start）直接 404，绝不暴露。
// 用 service 客户端跨租户读取，只回一个 id，不回业务内容。
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: { code: 'not_found', message: 'not found' } }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: orgA } = await admin
    .from('tenants')
    .select('id')
    .eq('code', 'aipaddle-demo')
    .maybeSingle()
  if (!orgA) {
    return Response.json({ error: { code: 'no_seed', message: 'orgA 未 seed' } }, { status: 404 })
  }

  const { data: agent } = await admin
    .from('agents')
    .select('id')
    .eq('org_id', orgA.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return Response.json({ orgAAgentId: agent?.id ?? null })
}
