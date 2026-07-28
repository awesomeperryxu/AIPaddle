import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { PricingTable, type PriceRow } from '@/lib/pricing'

// 4.8.17c 定价数据层。定价是**平台级**数据（非租户数据）：读放开给已登录用户
// （成本展示要用），写只走 admin client 且 API 入口必须 isPlatformAdmin 兜住。

type Row = {
  id: string
  provider: string
  model: string
  input_per_1k: string | number
  output_per_1k: string | number
  currency: string
  effective_from: string
  source_note: string | null
}

export type ModelPrice = {
  id: string
  provider: string
  model: string
  inputPer1k: number
  outputPer1k: number
  currency: string
  effectiveFrom: string
  sourceNote: string | null
}

// numeric 经 PostgREST 回来是字符串，统一转数字
const num = (v: string | number) => (typeof v === 'number' ? v : Number(v))

function map(r: Row): ModelPrice {
  return {
    id: r.id, provider: r.provider, model: r.model,
    inputPer1k: num(r.input_per_1k), outputPer1k: num(r.output_per_1k),
    currency: r.currency, effectiveFrom: r.effective_from, sourceNote: r.source_note,
  }
}

const COLS = 'id,provider,model,input_per_1k,output_per_1k,currency,effective_from,source_note'

/** 全量定价（按 provider/model/生效时间排序），供管理界面展示。 */
export async function listModelPricing(): Promise<ModelPrice[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('model_pricing').select(COLS).is('deleted_at', null)
    .order('provider').order('model').order('effective_from', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as Row[] | null) ?? []).map(map)
}

/** 取定价快照供批量成本聚合使用（一次读全量，避免 N+1）。 */
export async function loadPricingTable(): Promise<PricingTable> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('model_pricing').select('provider,model,input_per_1k,output_per_1k,effective_from')
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  const rows: PriceRow[] = ((data as Row[] | null) ?? []).map((r) => ({
    provider: r.provider, model: r.model,
    inputPer1k: num(r.input_per_1k), outputPer1k: num(r.output_per_1k),
    effectiveFrom: r.effective_from,
  }))
  return new PricingTable(rows)
}

export type PricingInput = {
  provider: string
  model: string
  inputPer1k: number
  outputPer1k: number
  effectiveFrom?: string
  sourceNote?: string | null
  currency?: string
}

function assertPricing(input: PricingInput) {
  if (!input.provider?.trim()) throw new Error('供应商不能为空')
  if (!input.model?.trim()) throw new Error('模型不能为空')
  for (const [v, label] of [[input.inputPer1k, '输入单价'], [input.outputPer1k, '输出单价']] as const) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(`${label}必须为非负数`)
  }
}

/**
 * 新增一条定价。**不修改既有行**——改价=插入一条新的 effective_from，
 * 这样历史成本仍按当时单价计算，趋势图不会因为改价而整体变形。
 */
export async function addModelPricing(actorId: string, input: PricingInput): Promise<ModelPrice> {
  assertPricing(input)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('model_pricing')
    .insert({
      provider: input.provider.trim(),
      model: input.model.trim(),
      input_per_1k: input.inputPer1k,
      output_per_1k: input.outputPer1k,
      currency: input.currency ?? 'CNY',
      effective_from: input.effectiveFrom ?? new Date().toISOString(),
      source_note: input.sourceNote ?? null,
      created_by: actorId,
    })
    .select(COLS).single()
  if (error) {
    if (error.code === '23505') throw new Error('该供应商+模型在此生效时间已有定价，请换一个生效时间')
    throw new Error(error.message)
  }
  return map(data as Row)
}

/** 软删一条定价（下架某个历史价位；不影响更早/更晚的档）。 */
export async function deleteModelPricing(id: string): Promise<boolean> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('model_pricing').update({ deleted_at: now, updated_at: now })
    .eq('id', id).is('deleted_at', null).select('id')
  if (error) throw new Error(error.message)
  return ((data as { id: string }[] | null) ?? []).length > 0
}
