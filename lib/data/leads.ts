import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// V12-8.9：外部留资数据层（ADR-008 四层依赖，请求级客户端 → RLS 生效）。

export type LeadInput = {
  extensionId: string
  conversationId?: string | null
  name: string
  contact: string
  project?: string
  expectedTime?: string
  siteInfo?: string
  source?: string
  summary?: string
  clientIp?: string
  raw?: Record<string, unknown>
}

export type Lead = {
  id: string
  name: string
  contact: string
  project: string | null
  expectedTime: string | null
  siteInfo: string | null
  source: string
  status: string
  createdAt: string
}

export class LeadValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'LeadValidationError' }
}

const MAX = { name: 50, contact: 100, project: 200, expectedTime: 100, siteInfo: 500, summary: 2000 }

/** 截断而非拒绝：外部访客随手多打几个字不该导致留资丢失，线索比整洁重要。 */
function clip(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return s ? s.slice(0, max) : undefined
}

export async function createLead(ctx: RequestContext, input: LeadInput): Promise<Lead> {
  const name = clip(input.name, MAX.name)
  const contact = clip(input.contact, MAX.contact)
  // 只有这两项必填——问得越多留资率越低，其余靠销售电话里补
  if (!name) throw new LeadValidationError('请留下称呼')
  if (!contact) throw new LeadValidationError('请留下联系方式')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leads')
    .insert({
      org_id: ctx.orgId,
      extension_id: input.extensionId,
      conversation_id: input.conversationId ?? null,
      name,
      contact,
      project: clip(input.project, MAX.project) ?? null,
      expected_time: clip(input.expectedTime, MAX.expectedTime) ?? null,
      site_info: clip(input.siteInfo, MAX.siteInfo) ?? null,
      source: clip(input.source, 50) ?? 'website',
      summary: clip(input.summary, MAX.summary) ?? null,
      client_ip: input.clientIp ?? null,
      raw: input.raw ?? {},
      status: 'new',
    })
    .select('id,name,contact,project,expected_time,site_info,source,status,created_at')
    .single()
  if (error) throw new Error(error.message)

  const r = data as Record<string, unknown>
  return {
    id: r.id as string,
    name: r.name as string,
    contact: r.contact as string,
    project: (r.project as string) ?? null,
    expectedTime: (r.expected_time as string) ?? null,
    siteInfo: (r.site_info as string) ?? null,
    source: r.source as string,
    status: r.status as string,
    createdAt: (r.created_at as string) ?? '',
  }
}
