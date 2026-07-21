import 'server-only'

// 共享 AI 客户端（Gate 0.4）：全项目唯一的 LLM + 嵌入入口，A 道的 RAG 与 B 道的 Agent 调用都经此。
// 后端：DashScope（阿里灵积）OpenAI 兼容接口，一套 DASHSCOPE_API_KEY 同供对话与嵌入。
// Key 只在服务端（server-only），绝不进浏览器。

const BASE = (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')
const KEY = process.env.DASHSCOPE_API_KEY
const LLM_MODEL = process.env.LLM_MODEL || 'qwen-plus'
// 多模态视觉模型（#55 · Block C）：含图片附件的消息改走 qwen-vl（DashScope 兼容多模态 content 数组）。
export const VL_MODEL = process.env.VL_MODEL || 'qwen-vl-max'
const EMBED_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-v4'
export const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM || 1536)

// DashScope 嵌入单次批量上限（compatible-mode text-embedding-v4）
const EMBED_BATCH = 10

function headers(): HeadersInit {
  if (!KEY) throw new Error('缺少 DASHSCOPE_API_KEY')
  return { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
}

async function postJson(path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const err = json?.error as { message?: string } | undefined
    throw new Error(`AI 调用失败 ${res.status}：${err?.message ?? JSON.stringify(json).slice(0, 200)}`)
  }
  return json
}

// ── 嵌入 ─────────────────────────────────────────────────────
// 返回与 inputs 顺序一致的向量数组；每个向量维度 = EMBEDDING_DIM（1536，匹配 DB vector 列）。
export async function embed(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return []
  const out: number[][] = []
  for (let i = 0; i < inputs.length; i += EMBED_BATCH) {
    const batch = inputs.slice(i, i + EMBED_BATCH)
    const json = await postJson('/embeddings', {
      model: EMBED_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIM, // v4 必须显式指定才输出 1536；v3 不支持 1536
      encoding_format: 'float',
    })
    const data = (json.data as { index: number; embedding: number[] }[]) ?? []
    data.sort((a, b) => a.index - b.index)
    for (const d of data) out.push(d.embedding)
  }
  return out
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embed([text]))[0]
}

// ── 对话 ─────────────────────────────────────────────────────
// content 支持纯字符串或多模态数组（DashScope OpenAI 兼容：text + image_url）。
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] }

export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; model?: string } = {},
): Promise<string> {
  const json = await postJson('/chat/completions', {
    model: opts.model ?? LLM_MODEL,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1024,
  })
  const choices = json.choices as { message?: { content?: string } }[] | undefined
  return choices?.[0]?.message?.content ?? ''
}

// 带用量的对话（4.1.5 调用日志）：返回内容 + token 用量 + 实际模型，用于落 call_logs。
export async function chatWithUsage(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; model?: string } = {},
): Promise<{ content: string; tokensIn: number; tokensOut: number; model: string }> {
  const model = opts.model ?? LLM_MODEL
  const json = await postJson('/chat/completions', {
    model,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1024,
  })
  const choices = json.choices as { message?: { content?: string } }[] | undefined
  const usage = (json.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number }
  return {
    content: choices?.[0]?.message?.content ?? '',
    tokensIn: usage.prompt_tokens ?? 0,
    tokensOut: usage.completion_tokens ?? 0,
    model,
  }
}

// 流式对话（个人助理切片1）：DashScope OpenAI 兼容 stream:true，逐块产出 delta；
// 末尾产出 usage（include_usage）。调用方 for-await 消费 delta 转发给浏览器 SSE，并累计全文入库。
export type ChatStreamChunk =
  | { delta: string; usage?: undefined; model: string }
  | { delta?: undefined; usage: { tokensIn: number; tokensOut: number }; model: string }

export async function* chatStream(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; model?: string } = {},
): AsyncGenerator<ChatStreamChunk> {
  const model = opts.model ?? LLM_MODEL
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1024,
      stream: true,
      stream_options: { include_usage: true },
    }),
  })
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '')
    throw new Error(`AI 流式调用失败 ${res.status}：${t.slice(0, 200)}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const s = line.trim()
      if (!s.startsWith('data:')) continue
      const payload = s.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const j = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[]
          usage?: { prompt_tokens?: number; completion_tokens?: number }
        }
        const delta = j.choices?.[0]?.delta?.content
        if (delta) yield { delta, model }
        if (j.usage) yield { usage: { tokensIn: j.usage.prompt_tokens ?? 0, tokensOut: j.usage.completion_tokens ?? 0 }, model }
      } catch { /* 忽略非 JSON/心跳行 */ }
    }
  }
}

export const AI_MODELS = { llm: LLM_MODEL, embedding: EMBED_MODEL, embeddingDim: EMBEDDING_DIM }
