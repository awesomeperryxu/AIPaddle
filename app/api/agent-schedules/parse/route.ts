import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { chat } from '@/lib/ai'
import { extractJson } from '@/lib/agents/copilot'

// 计算接下来 N 次执行时间（简单实现：只支持标准 5 段 cron，精度到分钟）
function nextNRuns(cronExpr: string, n = 5): string[] {
  // 不在前端算，由 AI 直接给出示例时间文字更友好
  // 这里提供占位，前端可二次调用或直接展示 AI 给出的文字
  return []
}

const PARSE_SYSTEM = `你是一个定时任务配置助手。用户会用自然语言描述定时执行的任务。
你需要解析并返回 JSON（无代码块），字段：
- cronExpr：标准 cron 表达式（5 段，minute hour dom month dow，不含年份，UTC+8）
- triggerPrompt：发给 Agent 的触发指令（精确、可执行的中文提示词，描述 Agent 应执行的任务内容）
- summary：人类可读的计划摘要（中文，如"每个工作日早上9点"）
- nextRuns：接下来5次执行时间的中文描述数组（如 ["2026-07-28 09:00（周一）", ...]）
- question：若信息不足需要澄清，则填此字段（字符串）；信息充分时省略或为 null

示例输入：每天早上 9 点，汇总昨日的销售数据并生成一份简报
示例输出：
{
  "cronExpr": "0 9 * * *",
  "triggerPrompt": "请汇总昨天的销售数据，生成一份简洁的日销售简报，包含总销售额、环比变化、Top 3 商品。",
  "summary": "每天早上 9:00",
  "nextRuns": ["明天 09:00（周一）", "后天 09:00（周二）", "7月30日 09:00（周三）", "7月31日 09:00（周四）", "8月1日 09:00（周五）"]
}

注意：
- cron 基于 UTC+8（中国标准时间）
- triggerPrompt 要精确、可直接执行，是对 Agent 说的话
- 如用户说"工作日"，cron 的 dow 用 1-5`

// POST /api/agent-schedules/parse
// body: { message, history?, agentName? }
// 多轮对话：history 是之前轮次的 [{ role, content }]
export async function POST(req: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: { code: 'unauthenticated' } }, { status: 401 })
  if (!can(ctx, 'agent:update'))
    return Response.json({ error: { code: 'forbidden' } }, { status: 403 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const message = String(body?.message ?? '').trim()
  const agentName = String(body?.agentName ?? 'Agent').trim()
  const history = Array.isArray(body?.history)
    ? (body.history as Array<{ role: 'user' | 'assistant'; content: string }>)
    : []

  if (!message)
    return Response.json({ error: { code: 'invalid', message: '消息不能为空' } }, { status: 400 })

  const messages = [
    { role: 'system' as const, content: PARSE_SYSTEM + `\n\n当前 Agent 名称：${agentName}` },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: message },
  ]

  try {
    const raw = await chat(messages, { temperature: 0.2, maxTokens: 800 })
    let parsed: Record<string, unknown>
    try {
      parsed = extractJson(raw) as Record<string, unknown>
    } catch {
      return Response.json({
        reply: raw,
        parsed: null,
      })
    }
    return Response.json({
      reply: parsed.question
        ? String(parsed.question)
        : `好的，我已理解你的需求。\n\n**计划：** ${parsed.summary ?? ''}\n**Cron：** \`${parsed.cronExpr ?? ''}\`\n**触发指令：** ${parsed.triggerPrompt ?? ''}\n\n**接下来 5 次执行：**\n${(parsed.nextRuns as string[] | undefined ?? []).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n确认保存这个配置吗？`,
      parsed: parsed.question ? null : {
        cronExpr: parsed.cronExpr,
        triggerPrompt: parsed.triggerPrompt,
        summary: parsed.summary,
        nextRuns: parsed.nextRuns,
      },
    })
  } catch {
    return Response.json({ error: { code: 'llm_error', message: 'AI 解析失败，请重试' } }, { status: 502 })
  }
}
