import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { chat } from '@/lib/ai'

// Cron 调用 Agent（4.1.26）：绕过 HTTP + RLS，用 admin client 直读 agent config，再调 LLM。
// 只做最简对话（system prompt + trigger prompt），不支持 RAG/Skill/MCP（cron 场景不需要）。
type AgentConfig = {
  systemPrompt?: string
  model?: string
  temperature?: number
}

export async function invokeCronAgent(params: {
  agentId: string
  orgId: string
  triggerPrompt: string
}): Promise<{ reply: string }> {
  const admin = createAdminClient()

  // 读 agent config（admin client，绕过 RLS，但按 org_id 过滤防越权）
  const { data, error } = await admin
    .from('agents')
    .select('id,name,status,config')
    .eq('id', params.agentId)
    .eq('org_id', params.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(`查询 Agent 失败：${error.message}`)
  if (!data) throw new Error('Agent 不存在或不属于当前租户')

  const row = data as { id: string; name: string; status: string; config: AgentConfig | null }
  if (row.status !== 'published') throw new Error(`Agent 状态为 ${row.status}，不可调用`)

  const cfg = row.config ?? {}
  const systemPrompt = cfg.systemPrompt ?? `你是 ${row.name}，请执行以下任务。`
  const model = cfg.model
  const temperature = cfg.temperature ?? 0.5

  const reply = await chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: params.triggerPrompt },
    ],
    { model, temperature, maxTokens: 1500 },
  )

  return { reply }
}
