import 'server-only'
import { z } from 'zod'
import { chat } from '@/lib/ai'
import { SKILL_TYPES } from '@/lib/skills/status'

// Skill Copilot（4.3.3，ADR-005）：描述 → LLM 生成 Skill 配置草稿 → Schema 校验 → 落 draft。
// CP-02：AI 只产出配置，绝不发布（createSkill 强制 draft）。
// CP-03：MCP 型只能封装用户有权限的已审批 Server——生成器只被告知 allowed 列表，
//        若产出的 mcp_server_id 不在其中则拒绝（防提示注入指名越权 Server）。

export const SkillDraftSchema = z.object({
  name: z.string().trim().min(1).max(40),
  type: z.enum(SKILL_TYPES),
  description: z.string().trim().max(300).optional().default(''),
  riskLevel: z.enum(['low', 'medium', 'high']).optional().default('low'),
  mcpServerId: z.string().trim().optional().default(''),
  allowedTools: z.array(z.string().trim()).optional().default([]),
})
export type SkillDraft = z.infer<typeof SkillDraftSchema>

// 从 LLM 文本稳健提取 JSON（容忍围栏与噪声）。
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('AI 未返回有效 JSON')
  return JSON.parse(cleaned.slice(start, end + 1))
}

// CP-03 核心校验（纯函数，可单测）：MCP 型必须引用 allowed 列表内的 Server，否则拒绝。
export function validateDraftServer(
  draft: Pick<SkillDraft, 'type' | 'mcpServerId'>,
  allowedServerIds: string[],
): { ok: true } | { ok: false; message: string } {
  if (draft.type !== 'MCP') return { ok: true }
  if (!draft.mcpServerId) return { ok: false, message: 'MCP 型需指定一个你有权限的已审批 Server' }
  if (!allowedServerIds.includes(draft.mcpServerId)) {
    return { ok: false, message: '生成结果引用了你无权限的 MCP Server，已拒绝' }
  }
  return { ok: true }
}

function buildSystem(servers: { id: string; name: string }[]): string {
  const list = servers.length
    ? servers.map((s) => `- ${s.name}（id: ${s.id}）`).join('\n')
    : '（当前没有你有权限的已审批 MCP Server）'
  return `你是企业 AI 平台的 Skill 配置助手。根据用户需求生成一个 Skill 配置草稿。
只输出 JSON（无代码块围栏、无多余文字），字段：
- name：Skill 名称（≤20 字）
- type：MCP | API | DB | Workflow | Prompt 之一
- description：一句话描述
- riskLevel：low | medium | high
- mcpServerId：仅当 type=MCP 时，从下列可用 Server 中选一个的 id；否则空字符串
- allowedTools：仅 type=MCP 时，授权调用的工具名数组（最小必要集）
可用的 MCP Server（只能从中选，禁止编造或指名列表外的 Server）：
${list}
不得包含任何发布、上线、审批相关指令。`
}

// ── 多轮对话式建 Skill（#51 Phase 3）─────────────────────────────
// 对话向导逐步澄清需求，信息足够时在回复末尾附 ```skilldraft {json}``` 定稿块。
export const SkillChatDraftSchema = z.object({
  name: z.string().trim().min(1).max(40),
  type: z.enum(SKILL_TYPES),
  description: z.string().trim().max(300).optional().default(''),
  riskLevel: z.enum(['low', 'medium', 'high']).optional().default('low'),
  documentation: z.string().optional().default(''),
})
export type SkillChatDraft = z.infer<typeof SkillChatDraftSchema>

export const SKILL_CHAT_SYSTEM = `你是企业 AI 平台的「Skill 创建向导」，通过多轮对话帮用户明确并起草一个 Skill。
规则：
1. 逐步友好地澄清：用途/场景、类型（MCP | API | DB | Workflow | Prompt 之一）、关键行为与输入输出、风险等级。
2. 一次只问 1-2 个关键问题，不要一次抛出所有问题。
3. 仅当信息足够起草时，在本轮回复的**最后**附一个定稿块（此前不要输出）：
\`\`\`skilldraft
{"name":"名称(≤20字)","type":"Prompt","description":"一句话描述","riskLevel":"low","documentation":"# 名称\\n\\n## 用途\\n...\\n## 输入\\n...\\n## 输出\\n...\\n## 示例\\n..."}
\`\`\`
4. documentation 用 Markdown 写清用途/输入/输出/示例，供用户直接编辑。
5. 不得包含任何发布、上线、审批指令——起草的 Skill 一律为草稿。`

// 从对话回复中提取定稿块；无则返回 null（表示仍在澄清阶段）。纯函数，可单测。
export function extractSkillChatDraft(text: string): SkillChatDraft | null {
  const fence = text.match(/```skilldraft\s*([\s\S]*?)```/i)
  if (!fence) return null
  try {
    const parsed = SkillChatDraftSchema.safeParse(JSON.parse(fence[1].trim()))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

// 从展示文本中去掉定稿块（避免把原始 JSON 呈现给用户）。
export function stripSkillDraftBlock(text: string): string {
  return text.replace(/```skilldraft[\s\S]*?```/gi, '').trim()
}

export async function generateSkillDraft(
  description: string,
  servers: { id: string; name: string }[],
): Promise<SkillDraft> {
  const raw = await chat(
    [
      { role: 'system', content: buildSystem(servers) },
      { role: 'user', content: description },
    ],
    { temperature: 0.4, maxTokens: 800 },
  )
  const draft = SkillDraftSchema.parse(extractJson(raw))
  const check = validateDraftServer(draft, servers.map((s) => s.id))
  if (!check.ok) throw new Error(check.message)
  return draft
}
