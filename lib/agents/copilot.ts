import 'server-only'
import { z } from 'zod'
import { chat } from '@/lib/ai'
import { AgentConfigSchema, AGENT_MODELS } from '@/lib/agents/config'

// Agent Copilot（4.1.6，ADR-005）：描述 → LLM 生成配置草稿 → Schema 校验 → 落 draft。
// AI 只产出配置，绝不含发布/上线动作（发布须走 4.1.2/4.1.3 审核）。
export const AgentDraftSchema = z.object({
  name: z.string().trim().min(1).max(40),
  department: z.string().trim().max(40).optional().default(''),
  description: z.string().trim().max(300).optional().default(''),
  systemPrompt: z.string().trim().min(1).max(2000),
})
export type AgentDraft = z.infer<typeof AgentDraftSchema>

const GEN_SYSTEM = `你是企业 AI 平台的 Agent 配置助手。根据用户一句话需求，生成一个 Agent 配置草稿。
只输出 JSON（无代码块围栏、无多余文字），字段：
- name：Agent 名称（简洁，≤20 字）
- department：建议归属部门
- description：一句话职责描述
- systemPrompt：该 Agent 的系统提示词（中文，写明角色、职责边界、语气）
不得包含任何发布、上线、审批相关指令。`

// 从 LLM 文本里稳健提取 JSON（容忍 ```json 围栏与前后噪声）。
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('AI 未返回有效 JSON')
  return JSON.parse(cleaned.slice(start, end + 1))
}

// 生成并校验草稿。校验失败抛错（路由转 422）。
export async function generateAgentDraft(description: string): Promise<AgentDraft> {
  const raw = await chat(
    [
      { role: 'system', content: GEN_SYSTEM },
      { role: 'user', content: description },
    ],
    { temperature: 0.4, maxTokens: 800 },
  )
  return AgentDraftSchema.parse(extractJson(raw))
}

// ── 4.1.13/4.1.14 · 生成主控 + 权限门控资源匹配 ──────────────────────
// Copilot 按自然语言产出「结构化配置补丁 + 建议绑定的资源」，服务端做 Zod 裁剪 + 越权拦截。
// 纯逻辑（清单裁剪 / Zod / 越权过滤）抽在此文件，便于单测（不碰 DB / 网络）。

// 授权可选资源项（喂给 LLM 的清单：只含 id/name/简介）。
export type ResourceItem = { id: string; name: string; description?: string }

// 补丁只覆盖 config 的可生成字段（对齐 AgentConfigSchema 子集，全部可选）。
// 不含知识库/工具绑定——绑定意图走 suggestKbIds/suggestSkillIds 单独门控。
export const CopilotPatchSchema = AgentConfigSchema.pick({
  systemPrompt: true,
  variables: true,
  model: true,
  agentMode: true,
  brainMode: true,
  openingStatement: true,
  suggestedQuestions: true,
}).partial()
export type CopilotPatch = z.infer<typeof CopilotPatchSchema>

export type CopilotResult = {
  patch: CopilotPatch
  suggestKbIds: string[]
  suggestSkillIds: string[]
  deniedNotes: string[]
  reply: string
}

// 逐字段裁剪：只保留 CopilotPatchSchema 中「校验通过」的键；单个非法字段被丢弃而非整体失败。
export function coercePatch(raw: unknown): CopilotPatch {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const shape = CopilotPatchSchema.shape
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    if (!(key in obj)) continue
    const parsed = shape[key].safeParse(obj[key])
    if (parsed.success && parsed.data !== undefined) out[key] = parsed.data
  }
  // model 必须是平台允许模型，否则丢弃（防前端 Select 显示空值）。
  if (typeof out.model === 'string' && !AGENT_MODELS.some((m) => m.value === out.model)) delete out.model
  return out as CopilotPatch
}

// 越权拦截：建议 id 只保留在「授权集合」内的；集合外的（含幻觉 id）生成自然语言拒绝提示。
export function filterAuthorizedIds(
  suggested: unknown,
  authorized: ResourceItem[],
  label: string,
): { allowed: string[]; deniedNotes: string[] } {
  const ids = Array.isArray(suggested) ? suggested.filter((x): x is string => typeof x === 'string') : []
  const authMap = new Map(authorized.map((r) => [r.id, r.name]))
  const allowed: string[] = []
  const deniedNotes: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id) || !id.trim()) continue
    seen.add(id)
    if (authMap.has(id)) allowed.push(id)
    else deniedNotes.push(`「${id}」不在你可用的${label}授权范围内（未发布或无权限），已跳过`)
  }
  return { allowed, deniedNotes }
}

// 把 LLM 原始 JSON 裁剪成安全结果：config 逐字段校验 + 资源建议越权过滤 + 汇总拒绝提示。
export function sanitizeCopilotResult(
  raw: unknown,
  authorizedKbs: ResourceItem[],
  authorizedSkills: ResourceItem[],
): CopilotResult {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const patch = coercePatch(obj)
  const kb = filterAuthorizedIds(obj.suggestKbIds, authorizedKbs, '知识库')
  const sk = filterAuthorizedIds(obj.suggestSkillIds, authorizedSkills, '工具')
  const reply = typeof obj.reply === 'string' ? obj.reply.trim() : ''
  return {
    patch,
    suggestKbIds: kb.allowed,
    suggestSkillIds: sk.allowed,
    deniedNotes: [...kb.deniedNotes, ...sk.deniedNotes],
    reply,
  }
}

// 授权清单渲染成提示词片段（id + 名称 + 简介）；空清单显式说明「无可用项」。
function renderCatalog(items: ResourceItem[]): string {
  if (items.length === 0) return '（无可用项）'
  return items
    .map((r) => `- id=${r.id} · ${r.name}${r.description ? `：${r.description.slice(0, 60)}` : ''}`)
    .join('\n')
}

// 生成主控 system 提示词：给出授权可选资源清单，强约束「只能从清单里选 id」。
export function buildCopilotSystemPrompt(authorizedKbs: ResourceItem[], authorizedSkills: ResourceItem[]): string {
  const models = AGENT_MODELS.map((m) => m.value).join(' / ')
  return `你是企业 AI 平台的「Agent 生成主控」。用户用自然语言描述需求，你据此产出该 Agent 的配置补丁与资源绑定建议。
只输出一个 JSON 对象（无代码块围栏、无多余文字），字段（均可选，reply 必填）：
- systemPrompt：系统提示词（中文，写明角色、职责边界、语气、输出规范）
- variables：变量数组，元素形如 {"key":"变量名","label":"显示名","type":"string|number|select"}
- model：模型，必须是以下之一：${models}
- agentMode：推理模式，"react" 或 "function_calling"
- brainMode：大脑模式，"llm" | "workflow" | "routing"
- openingStatement：开场白
- suggestedQuestions：建议问题字符串数组
- suggestKbIds：建议绑定的知识库 id 数组
- suggestSkillIds：建议绑定的工具(Skill/MCP) id 数组
- reply：给用户的一句话中文说明，讲清你改了哪些配置、绑定了哪些资源

【硬约束】suggestKbIds / suggestSkillIds 只能从下面「可用资源清单」里挑选 id，禁止编造清单外的 id；清单里没有合适的就留空数组。

可用知识库清单：
${renderCatalog(authorizedKbs)}

可用工具(Skill/MCP)清单：
${renderCatalog(authorizedSkills)}`
}

// 调 LLM 产出原始 JSON（路由负责鉴权/取授权清单/裁剪）。LLM 或解析失败向上抛（路由转 502）。
export async function generateCopilotRaw(
  instruction: string,
  authorizedKbs: ResourceItem[],
  authorizedSkills: ResourceItem[],
  current?: unknown,
): Promise<unknown> {
  const userMsg = current
    ? `需求：${instruction}\n\n当前配置摘要（供参考，可在此基础上增量修改）：${JSON.stringify(current)}`
    : `需求：${instruction}`
  const raw = await chat(
    [
      { role: 'system', content: buildCopilotSystemPrompt(authorizedKbs, authorizedSkills) },
      { role: 'user', content: userMsg },
    ],
    { temperature: 0.4, maxTokens: 1200 },
  )
  return extractJson(raw)
}
