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

  // 每种状态取一个样本 id，供 S1-STM-02 直打 transition API 验非法流转被拒。
  // 用例一直在读 agentIdsByStatus，但这个字段**从未实现**——4 条用例因此全挂
  // 在「读 undefined」上，看起来像状态机有问题，其实是测试数据接口缺字段。
  const { data: statusRows } = await admin
    .from('agents')
    .select('id,status')
    .eq('org_id', orgA.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const agentIdsByStatus: Record<string, string> = {}
  for (const r of (statusRows as { id: string; status: string }[] | null) ?? []) {
    if (r.status && !agentIdsByStatus[r.status]) agentIdsByStatus[r.status] = r.id
  }

  return Response.json({ orgAAgentId: agent?.id ?? null, agentIdsByStatus })
}
