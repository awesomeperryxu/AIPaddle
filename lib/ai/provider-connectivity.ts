import 'server-only'
import type { ProviderType } from '@/lib/data/model-providers'

// ADR-016 4.7.3：供应商连通性测试（通用探测）。
// 边界：本任务只做「OpenAI 兼容」通用探测（打 /models）；各供应商原生适配（Anthropic/Bedrock/Gemini）
// 属 4.7.5，此处明确返回 deferred，不伪造成功（对齐 ADR「不造假」）。

export type ConnectivityResult = {
  ok: boolean
  status?: number       // 上游 HTTP 状态（网络失败时缺省）
  message: string       // 面向用户的中文结论
  models?: string[]     // 探测到的模型 id（best-effort）
  deferred?: boolean    // 该供应商适配尚未落地（4.7.5）
}

// 走 OpenAI 兼容 /models 探测的供应商类型。
const OPENAI_COMPAT: ReadonlySet<ProviderType> = new Set<ProviderType>([
  'openai-compat', 'openai', 'custom',
])

const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1'
const TIMEOUT_MS = 10_000

function normalizeBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

/**
 * 探测供应商连通性。不抛异常——所有失败都收敛成 { ok:false, message }。
 * 仅在服务端调用；apiKey 为解密后明文，切勿把它写进返回值/日志。
 */
export async function testProviderConnectivity(input: {
  provider: ProviderType
  baseUrl: string | null
  apiKey: string
}): Promise<ConnectivityResult> {
  const { provider, apiKey } = input

  if (!OPENAI_COMPAT.has(provider)) {
    return {
      ok: false,
      deferred: true,
      message: `${provider} 原生适配将在 4.7.5 提供，暂不支持连通性测试`,
    }
  }

  const base = input.baseUrl ? normalizeBase(input.baseUrl)
    : provider === 'openai' ? OPENAI_DEFAULT_BASE
    : ''
  if (!base) {
    return { ok: false, message: '缺少 Base URL，无法测试连通性' }
  }
  if (!apiKey) {
    return { ok: false, message: '缺少 API Key，无法测试连通性' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${base}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    if (!res.ok) {
      const message = res.status === 401 || res.status === 403
        ? 'API Key 无效或无权限（上游拒绝）'
        : `上游返回 ${res.status}，连通性测试失败`
      return { ok: false, status: res.status, message }
    }
    const models = await extractModelIds(res)
    return {
      ok: true,
      status: res.status,
      message: models.length ? `连通正常，探测到 ${models.length} 个模型` : '连通正常',
      models,
    }
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return { ok: false, message: aborted ? `连接超时（>${TIMEOUT_MS / 1000}s）` : '无法连接到该端点' }
  } finally {
    clearTimeout(timer)
  }
}

// best-effort 解析 OpenAI 兼容 /models 响应，取前若干个模型 id；解析失败不影响 ok 判定。
async function extractModelIds(res: Response): Promise<string[]> {
  try {
    const json = await res.json() as { data?: Array<{ id?: unknown }> }
    if (!Array.isArray(json?.data)) return []
    return json.data
      .map((m) => (typeof m?.id === 'string' ? m.id : null))
      .filter((id): id is string => !!id)
      .slice(0, 50)
  } catch {
    return []
  }
}
