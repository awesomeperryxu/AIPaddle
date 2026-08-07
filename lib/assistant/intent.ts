import 'server-only'
import { chat } from '@/lib/ai'

// 意图分类（个人助理切片2）：判断用户输入是否是"创建 agent/skill/workflow/chatflow"意图。
// 命中创建意图 → 前端整页跳转对应创建页并预填描述；否则走普通 RAG 对话。

// WF-6：新增组合意图 create-scheduled-workflow——「建流程 + 定时跑」是一次表达，
// 拆成两次交互（先去建流程、回头再配定时）用户体验断裂，且中间容易漏掉定时。
export type IntentKind =
  | 'chat' | 'create-agent' | 'create-skill' | 'create-workflow' | 'create-chatflow'
  | 'create-scheduled-workflow'
export type Intent = { kind: IntentKind; description: string }

const KINDS: IntentKind[] = [
  'chat', 'create-agent', 'create-skill', 'create-workflow', 'create-chatflow',
  'create-scheduled-workflow',
]

const SYSTEM = `你是意图分类器。判断用户输入属于哪类，只输出一行 JSON，不要多余文字：
{"kind":"chat|create-agent|create-skill|create-workflow|create-chatflow|create-scheduled-workflow","description":"若为创建意图，用一句话概括要创建什么；否则空字符串"}
判定规则：
- 想创建 工作流/流程/自动化，**并且**要求周期性执行（每天/每周/每小时/定时/几点跑）→ create-scheduled-workflow
- 想创建/搭建/做一个 数字员工 或 Agent → create-agent
- 想创建/做一个 Skill / 工具 / 能力 / 插件 → create-skill
- 想创建 工作流 / workflow / 批处理流程 / 自动化流程（无周期性要求）→ create-workflow
- 想创建 对话流 / chatflow / 多轮对话应用 / 聊天机器人流程 → create-chatflow
- 其它（提问、查资料、闲聊、让你直接回答）→ chat
只有明确表达"要创建/搭建/新建"某物时才归为 create-*，含糊则归 chat。
description 要**完整保留**用户对时间的要求（如"每天早上8点"），后续要据此解析执行计划。`

/** 分类用户输入意图（LLM few-shot，失败或非创建则回退 chat）。 */
export async function classifyIntent(message: string): Promise<Intent> {
  const text = message.trim()
  if (!text) return { kind: 'chat', description: '' }
  try {
    const raw = await chat(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text },
      ],
      { temperature: 0, maxTokens: 120 },
    )
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return { kind: 'chat', description: '' }
    const parsed = JSON.parse(m[0]) as { kind?: string; description?: string }
    const kind = (KINDS.includes(parsed.kind as IntentKind) ? parsed.kind : 'chat') as IntentKind
    return { kind, description: typeof parsed.description === 'string' ? parsed.description.trim() : '' }
  } catch {
    return { kind: 'chat', description: '' }
  }
}

// 意图 → 创建页路由（切片2）
export const INTENT_ROUTE: Record<Exclude<IntentKind, 'chat'>, string> = {
  'create-agent': '/agents-admin',
  'create-skill': '/skill-hub',
  'create-workflow': '/workflows',
  'create-chatflow': '/workflows',
  // 组合意图不跳转——在助理页内直接编排并弹确认框，见 /api/assistant/orchestrate
  'create-scheduled-workflow': '',
}

export const INTENT_LABEL: Record<Exclude<IntentKind, 'chat'>, string> = {
  'create-agent': '数字员工 / Agent',
  'create-skill': 'Skill',
  'create-workflow': '工作流',
  'create-chatflow': 'Chatflow 对话流',
  'create-scheduled-workflow': '定时执行的工作流',
}
