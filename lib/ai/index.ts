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

// 4.8.5：可解析的模型客户端（endpoint + key + 可选默认模型）。
// 租户配了自己的供应商 → 用租户的；未配 → 回退平台 env（现状零改变）。
export type ModelClient = { baseURL: string; apiKey: string; model?: string }

/** 平台默认客户端（env 单例）。租户未配时的回退。 */
export function envModelClient(): ModelClient {
  return { baseURL: BASE, apiKey: KEY ?? '', model: LLM_MODEL }
}

function headersFor(apiKey: string): HeadersInit {
  if (!apiKey) throw new Error('缺少模型 API Key（租户未配且平台默认 DASHSCOPE_API_KEY 缺失）')
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
}

async function postJson(
  path: string,
  body: unknown,
  client: ModelClient = envModelClient(),
): Promise<Record<string, unknown>> {
  const res = await fetch(`${client.baseURL}${path}`, {
    method: 'POST', headers: headersFor(client.apiKey), body: JSON.stringify(body),
  })
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
  opts: { temperature?: number; maxTokens?: number; model?: string; client?: ModelClient } = {},
): Promise<{ content: string; tokensIn: number; tokensOut: number; model: string }> {
  // 模型优先级：显式 opts.model（Agent 选择）> 客户端默认（租户槽）> 平台默认
  const model = opts.model ?? opts.client?.model ?? LLM_MODEL
  const json = await postJson('/chat/completions', {
    model,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1024,
  }, opts.client)
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
  opts: { temperature?: number; maxTokens?: number; model?: string; client?: ModelClient } = {},
): AsyncGenerator<ChatStreamChunk> {
  const client = opts.client ?? envModelClient()
  const model = opts.model ?? client.model ?? LLM_MODEL
  const res = await fetch(`${client.baseURL}/chat/completions`, {
    method: 'POST',
    headers: headersFor(client.apiKey),
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

// ── Function Calling（Path B MCP 直连） ────────────────────────
// OpenAI 兼容的工具定义格式（DashScope 支持）
export type FunctionTool = {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: {
      type: 'object'
      properties?: Record<string, unknown>
      required?: string[]
    }
  }
}

type ToolCallResponse = {
  choices: {
    message: {
      role: string
      content: string | null
      tool_calls?: {
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }[]
    }
    finish_reason: string
  }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

export type ToolCallHandler = (toolName: string, args: Record<string, unknown>) => Promise<string>

// 带工具调用的对话（ReAct 循环）：LLM 可调用 tools，调用方提供 handler 执行工具后继续对话。
// 最多循环 maxIterations 轮（防止无限递归），每轮先检查是否有 tool_call，有则执行后继续，否则返回文本。
export async function chatWithTools(
  messages: ChatMessage[],
  tools: FunctionTool[],
  handler: ToolCallHandler,
  opts: { temperature?: number; maxTokens?: number; model?: string; maxIterations?: number; client?: ModelClient } = {},
): Promise<{ content: string; tokensIn: number; tokensOut: number; model: string }> {
  const model = opts.model ?? opts.client?.model ?? LLM_MODEL
  const maxIter = opts.maxIterations ?? 5
  let totalIn = 0
  let totalOut = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history: any[] = [...messages]

  for (let i = 0; i < maxIter; i++) {
    const json = await postJson('/chat/completions', {
      model,
      messages: history,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2048,
    }, opts.client) as ToolCallResponse & Record<string, unknown>

    const usage = (json.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number }
    totalIn += usage.prompt_tokens ?? 0
    totalOut += usage.completion_tokens ?? 0

    const choice = json.choices?.[0]
    const msg = choice?.message

    if (!msg) break

    // 追加 assistant 消息到 history
    history.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })

    // 没有工具调用 → 返回最终文本
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { content: msg.content ?? '', tokensIn: totalIn, tokensOut: totalOut, model }
    }

    // 依次执行所有工具调用，将结果追加到 history
    for (const tc of msg.tool_calls) {
      let result: string
      try {
        const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>
        result = await handler(tc.function.name, args)
      } catch (e) {
        result = `工具调用失败：${e instanceof Error ? e.message : String(e)}`
      }
      history.push({ role: 'tool', tool_call_id: tc.id, content: result })
    }
  }

  return { content: '（超过最大工具调用轮次，未能得到最终回答）', tokensIn: totalIn, tokensOut: totalOut, model }
}
