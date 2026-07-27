import 'server-only'
import type { RequestContext } from '@/lib/context'
import { getModelSettings, getProviderApiKey } from '@/lib/data/model-providers'
import { envModelClient, type ModelClient } from '@/lib/ai'

// ADR-016 4.8.5：运行时按 ctx.orgId 解析租户模型客户端。
// 规则（ADR-003 决策②）：租户配了对应能力的供应商 → 用租户的（解密 Key）；
// 未配 / 解析异常 / 非 OpenAI 兼容供应商 → 回退平台 env（现状不破，平滑迁移，不停服）。
// 首版只接 LLM 对话路径（分批改造，ADR-016 决策③）；embedding/rerank 后置。

export type ResolvedClient = ModelClient & { source: 'tenant' | 'platform' }

// 仅 OpenAI 兼容类可走现有 /chat/completions 路径；原生适配（anthropic/bedrock/gemini）属 4.7.5，回退平台。
const OPENAI_COMPAT = new Set(['openai-compat', 'openai', 'custom'])

export async function resolveModelClient(
  ctx: RequestContext,
  capability: 'llm' | 'embedding' | 'rerank',
): Promise<ResolvedClient> {
  try {
    const settings = await getModelSettings(ctx)
    const slot = settings[capability]
    if (slot?.providerId && slot.model) {
      const cred = await getProviderApiKey(ctx, slot.providerId) // 服务端解密
      if (cred && OPENAI_COMPAT.has(cred.provider) && cred.apiKey) {
        const baseURL = cred.baseUrl
          ? cred.baseUrl.replace(/\/+$/, '')
          : cred.provider === 'openai' ? 'https://api.openai.com/v1' : null
        if (baseURL) {
          return { baseURL, apiKey: cred.apiKey, model: slot.model, source: 'tenant' }
        }
      }
    }
  } catch {
    // 租户配置异常绝不影响调用：静默回退平台默认。
  }
  return { ...envModelClient(), source: 'platform' }
}
