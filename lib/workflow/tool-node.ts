import 'server-only'
import { chat } from '@/lib/ai'
import type { RequestContext } from '@/lib/context'
import { getSkillById } from '@/lib/data/skills'
import { listSkillPluginDeps, checkSkillRunnable } from '@/lib/data/skill-dependencies'
import { listAgentTools, runToolVersion, type RunnableTool } from '@/lib/tools/run'
import { runtimeSystemPrompt, type RuntimeVars } from '@/lib/workflow/runtime-context'

// Workflow 的 tool 节点执行器（WF-22）。
//
// 🔴 补的是「生成端做了、执行端没接」的那一段：WF-3 已经能把已发布 Skill 编排成
// tool 节点，但执行引擎的 SUPPORTED 白名单里没有 'tool'，跑到这里一律 skipped 透传。
// 于是用户那条「查全网 AI 大事件」即便挂上了检索能力，运行时也等于没有——
// 数据没进来，下游 LLM 只能编。
//
// 调用链沿用既有治理路径，不开特例：
//   tool 节点 config.tool_id（Skill）
//     → skill_plugin_dependencies（object_type='tool'）
//     → tools / tool_versions（只取 published）
//     → runToolVersion()（凭证解密 + SSRF 防护 + 调用期重校验，与 Agent 对话同一套）

export type ToolNodeResult =
  | { ok: true; output: string; toolName: string }
  | { ok: false; error: string }

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** 取 tool 节点绑定的 Skill id。历史上写过 skill_id，两种都收 */
export function pickSkillId(cfg: Record<string, unknown>): string {
  return str(cfg.tool_id) || str(cfg.skill_id)
}

type JsonSchema = { type?: string; properties?: Record<string, { type?: string; description?: string }>; required?: string[] }

/**
 * 定出调用参数。
 *
 * 三档，越确定的越优先——能不问模型就不问，省一次调用也少一次跑偏：
 *   ① 节点面板里固定填的参数（config.args）始终最优先，用户填了就照用；
 *   ② schema 只有一个字符串参数（绝大多数检索类 Tool 就是个 query）→ 直接喂节点输入；
 *   ③ 其余情况才让模型按 schema 生成 JSON。
 */
export async function buildToolArgs(
  schema: JsonSchema,
  nodeInput: string,
  fixedArgs: Record<string, unknown>,
  tool: { name: string; description: string },
  runtime?: RuntimeVars,
): Promise<Record<string, unknown>> {
  const props = schema?.properties ?? {}
  const keys = Object.keys(props)
  if (keys.length === 0) return { ...fixedArgs }

  const missing = keys.filter((k) => !(k in fixedArgs))
  if (missing.length === 0) return { ...fixedArgs }

  if (missing.length === 1 && (props[missing[0]].type ?? 'string') === 'string') {
    return { ...fixedArgs, [missing[0]]: nodeInput }
  }

  // 让模型按 schema 填参。失败不抛——退回「单参数塞输入」，宁可参数糙一点也别整条流程断掉
  const sys = [
    runtime ? runtimeSystemPrompt(runtime) : '',
    '你在为一次工具调用准备参数。只输出一个 JSON 对象，不要解释、不要 markdown 代码块。',
    `工具：${tool.name}${tool.description ? `（${tool.description}）` : ''}`,
    `参数结构：${JSON.stringify({ properties: props, required: schema.required ?? [] })}`,
    '未提及的可选参数省略不填，不要编造取值。',
  ].filter(Boolean).join('\n')
  // 🔴 兜底要覆盖两种失败，别只 catch 异常：模型答「抱歉我无法……」时不会抛，
  // JSON.parse 压根不会被调用，静默返回空参数——下游 Tool 收到 {} 直接失败，
  // 而日志上看不出是参数没填出来。
  const fallback = { ...fixedArgs, [missing[0]]: nodeInput }
  try {
    const raw = await chat(
      [{ role: 'system', content: sys }, { role: 'user', content: `输入内容：\n${nodeInput}` }],
      { temperature: 0, maxTokens: 400 },
    )
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return fallback
    const parsed = JSON.parse(m[0]) as Record<string, unknown>
    // 只保留 schema 里声明过的键：模型爱自作主张加字段，多余的键会被下游接口拒掉
    const cleaned: Record<string, unknown> = {}
    for (const k of keys) if (k in parsed) cleaned[k] = parsed[k]
    // 一个都没填出来同样算失败，别把空参数当成「模型认为不需要参数」
    if (Object.keys(cleaned).length === 0) return fallback
    return { ...cleaned, ...fixedArgs }
  } catch {
    return fallback
  }
}

/** 执行一个 tool 节点。任何一步不满足都返回可读原因，由引擎记进 trace。 */
export async function runToolNode(
  ctx: RequestContext,
  cfg: Record<string, unknown>,
  nodeInput: string,
  runtime?: RuntimeVars,
): Promise<ToolNodeResult> {
  const skillId = pickSkillId(cfg)
  if (!skillId) return { ok: false, error: 'Tool 节点未绑定 Skill' }

  const skill = await getSkillById(ctx, skillId)
  if (!skill) return { ok: false, error: '绑定的 Skill 不存在或无权访问' }
  // 🔴 只跑已发布：草稿/待审的 Skill 没经过上架审核，运行期放行等于绕开 SEC-1/2/3
  if (skill.status !== 'published') {
    return { ok: false, error: `绑定的 Skill「${skill.name}」未发布（当前 ${skill.status}），不能调用` }
  }

  const runnable = await checkSkillRunnable(ctx, skillId)
  if (!runnable.runnable) {
    return { ok: false, error: `Skill「${skill.name}」当前不可用：${runnable.blockedBy.map((b) => `${b.name} ${b.reason}`).join('；')}` }
  }

  const deps = await listSkillPluginDeps(ctx, skillId)
  const toolDeps = deps.filter((d) => d.objectType === 'tool')
  if (toolDeps.length === 0) {
    return { ok: false, error: `Skill「${skill.name}」没有绑定任何 Tool，无法执行` }
  }

  const tools = await listAgentTools(ctx, toolDeps.map((d) => d.objectId))
  if (tools.length === 0) {
    return { ok: false, error: `Skill「${skill.name}」依赖的 Tool 没有已发布版本` }
  }
  // 节点可指定用哪个 Tool（一个 Skill 可能挂多个）；没指定就取必需依赖里的第一个
  const wanted = str(cfg.tool_object_id)
  const tool: RunnableTool = tools.find((t) => t.toolId === wanted) ?? tools[0]

  const fixedArgs = cfg.args && typeof cfg.args === 'object' && !Array.isArray(cfg.args)
    ? (cfg.args as Record<string, unknown>)
    : {}
  const args = await buildToolArgs(tool.inputSchema as JsonSchema, nodeInput, fixedArgs, tool, runtime)

  const r = await runToolVersion(ctx, tool.versionId, args)
  if (!r.ok) return { ok: false, error: `调用「${tool.name}」失败：${r.content}` }
  return { ok: true, output: r.content, toolName: tool.name }
}
