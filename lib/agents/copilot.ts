import 'server-only'
import { z } from 'zod'
import { chat } from '@/lib/ai'

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
