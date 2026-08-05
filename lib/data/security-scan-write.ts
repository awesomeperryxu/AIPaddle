import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'
import type { AutoFixOutcome } from '@/lib/security/autofix'

// SEC-3 写侧：把自动修复结果落回资源 config。
// 单独成文件而非塞进 security-scan.ts —— 读扫描是高频只读，写回是低频高影响，
// 分开后「谁能写」这件事在文件层面就看得见。

/**
 * 读 config → 交给纯函数计算 → 写回。
 *
 * 🔴 请求级客户端（RLS 生效）+ 显式 org_id：审核者只能改本租户资源。
 * 🔴 只更新 config 一列，不碰 status —— 自动加固不等于审核通过，裁决仍走 /api/reviews/decision。
 */
export async function applySecurityAutoFix(
  ctx: RequestContext,
  resourceType: 'agent' | 'skill',
  resourceId: string,
  compute: (cfg: Record<string, unknown>) => AutoFixOutcome,
): Promise<AutoFixOutcome | null> {
  const supabase = await createClient()
  const table = resourceType === 'agent' ? 'agents' : 'skills'

  const { data: cur } = await supabase
    .from(table).select('id,config')
    .eq('id', resourceId).eq('org_id', ctx.orgId).is('deleted_at', null)
    .maybeSingle()
  if (!cur) return null

  const cfg = ((cur as { config: Record<string, unknown> | null }).config ?? {}) as Record<string, unknown>
  const outcome = compute(cfg)

  // 没有实际变更就不写库：避免 updated_at 被无谓刷新，也让审计只记录真正的改动
  if (outcome.changes.length === 0) return outcome

  const { error } = await supabase
    .from(table)
    .update({ config: outcome.config, updated_at: new Date().toISOString() })
    .eq('id', resourceId).eq('org_id', ctx.orgId).is('deleted_at', null)
  if (error) throw new Error(error.message)
  return outcome
}
