import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getProviderApiKey } from '@/lib/data/model-providers'
import { testProviderConnectivity } from '@/lib/ai/provider-connectivity'

// ADR-016 4.7.3：供应商连通性测试。权限 provider:manage。
// 服务端解密取 Key → 通用探测；明文 Key 绝不进返回体（只回 ok/status/message/models）。

type Ctx = { params: Promise<{ id: string }> }

// POST /api/model-providers/[id]/test —— 对该供应商做一次连通性探测。
export async function POST(_request: Request, { params }: Ctx) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated', message: '未登录' } }, { status: 401 })
  if (!can(ctx, 'provider:manage')) {
    return Response.json({ error: { code: 'forbidden', message: '无权限：管理模型供应商' } }, { status: 403 })
  }
  const { id } = await params
  const cred = await getProviderApiKey(ctx, id)
  if (!cred) {
    return Response.json({ error: { code: 'not_found', message: '供应商不存在' } }, { status: 404 })
  }
  const result = await testProviderConnectivity(cred)
  return Response.json({ result })
}
