// ADR-016 4.7.4：客户端安全的供应商目录（UI 用，无 server-only）。
// 与 lib/data/model-providers 的 PROVIDER_TYPES 一一对齐；此处只补 UI 展示元数据。
// deferred=true 表示原生适配尚未落地（4.7.5），连通性测试会返回 deferred。

export type ProviderCatalogItem = {
  type: 'openai-compat' | 'openai' | 'anthropic' | 'bedrock' | 'gemini' | 'custom'
  label: string
  needsBaseUrl: boolean   // true=必须填 Base URL（openai-compat / custom）
  deferred?: boolean      // 原生适配待 4.7.5，连通性测试不可用
  hint?: string
}

export const PROVIDER_CATALOG: readonly ProviderCatalogItem[] = [
  { type: 'openai-compat', label: 'OpenAI 兼容', needsBaseUrl: true, hint: '通义千问 / 智谱 / DeepSeek / Moonshot / 本地 vLLM 等' },
  { type: 'openai', label: 'OpenAI', needsBaseUrl: false, hint: '官方端点，可留空 Base URL' },
  { type: 'custom', label: '自定义端点', needsBaseUrl: true, hint: '任意 OpenAI 兼容的 base_url + key' },
  { type: 'anthropic', label: 'Anthropic Claude', needsBaseUrl: false, deferred: true, hint: '原生 Messages 适配待 4.7.5' },
  { type: 'bedrock', label: 'AWS Bedrock', needsBaseUrl: false, deferred: true, hint: 'SigV4 适配待 4.7.5' },
  { type: 'gemini', label: 'Google Gemini', needsBaseUrl: false, deferred: true, hint: '原生适配待 4.7.5' },
] as const

const BY_TYPE = new Map(PROVIDER_CATALOG.map((p) => [p.type, p]))

export function providerLabel(type: string): string {
  return BY_TYPE.get(type as ProviderCatalogItem['type'])?.label ?? type
}
export function providerMeta(type: string): ProviderCatalogItem | undefined {
  return BY_TYPE.get(type as ProviderCatalogItem['type'])
}

// 默认模型 5 槽（与数据层 ModelSettings 键一致）。
export const MODEL_SLOTS = [
  { key: 'llm', label: 'LLM（对话）' },
  { key: 'embedding', label: 'Embedding（嵌入）' },
  { key: 'rerank', label: 'Rerank（重排）' },
  { key: 'stt', label: 'STT（语音转文字）' },
  { key: 'tts', label: 'TTS（文字转语音）' },
] as const
export type SlotKey = (typeof MODEL_SLOTS)[number]['key']
