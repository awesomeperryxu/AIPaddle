import { z } from 'zod'

// Agent 编排配置（4.1.7）：存于 agents.config(jsonb)。前后端共用（不引 server-only / db）。
// 知识库/工具/工作流绑定走 agent_resources 中间表（4.1.9），不放本配置。

export type AgentMode = 'react' | 'function_calling'

// 用户输入表单变量（对齐 Dify「变量」）
export const AgentVariableSchema = z.object({
  key: z.string().trim().min(1, '变量名必填').max(40),
  label: z.string().trim().max(40).optional(),
  type: z.enum(['string', 'number', 'select']).default('string'),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(), // type=select 时的选项
})
export type AgentVariable = z.infer<typeof AgentVariableSchema>

// 事项路由规则（4.1.9）：无 workflow 大脑时，按关键词命中路由到指定 Skill。
export const RoutingRuleSchema = z.object({
  keyword: z.string().trim().min(1).max(60),
  skillId: z.string().trim().min(1),
})
export type RoutingRule = z.infer<typeof RoutingRuleSchema>

// Agent 大脑模式（4.1.9）：纯 LLM / 绑定工作流 / 事项路由到 Skill。
export type BrainMode = 'llm' | 'workflow' | 'routing'

// Agent 编排配置。PATCH 时按 partial 校验并合并进现有 config。
export const AgentConfigSchema = z.object({
  systemPrompt: z.string().max(4000).optional(),
  model: z.string().max(60).optional(),
  temperature: z.number().min(0).max(2).optional(),
  variables: z.array(AgentVariableSchema).max(20).optional(),
  agentMode: z.enum(['react', 'function_calling']).optional(),
  maxIterations: z.number().int().min(1).max(20).optional(),
  // 大脑（4.1.9）
  brainMode: z.enum(['llm', 'workflow', 'routing']).optional(),
  brainWorkflowId: z.string().uuid().nullish(),
  routingRules: z.array(RoutingRuleSchema).max(20).optional(),
  // Features（4.1.12，照搬 Dify）
  openingStatement: z.string().max(1000).optional(),
  suggestedQuestions: z.array(z.string().trim().max(120)).max(10).optional(),
  citationEnabled: z.boolean().optional(),
  moderationEnabled: z.boolean().optional(),
})
export type AgentConfig = z.infer<typeof AgentConfigSchema>

export const BRAIN_MODE_LABEL: Record<BrainMode, string> = {
  llm: '纯 LLM（提示词直答）',
  workflow: '绑定工作流（大脑=一条 workflow）',
  routing: '事项路由（按关键词转指定 Skill）',
}

// 可选模型（DashScope 通义系列，与 lib/ai 一致）
export const AGENT_MODELS: { value: string; label: string }[] = [
  { value: 'qwen-plus', label: 'qwen-plus（均衡）' },
  { value: 'qwen-max', label: 'qwen-max（最强）' },
  { value: 'qwen-turbo', label: 'qwen-turbo（快速）' },
  { value: 'qwen-vl-max', label: 'qwen-vl-max（多模态）' },
]

export const AGENT_MODE_LABEL: Record<AgentMode, string> = {
  react: 'ReAct（推理+行动，兼容性好）',
  function_calling: 'Function Calling（工具调用，需模型支持）',
}

export const DEFAULT_AGENT_CONFIG: Required<Pick<AgentConfig, 'model' | 'temperature' | 'agentMode' | 'maxIterations'>> = {
  model: 'qwen-plus',
  temperature: 0.7,
  agentMode: 'react',
  maxIterations: 5,
}
