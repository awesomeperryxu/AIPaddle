import 'server-only'

/**
 * 4.8.17c：Token 定价的**唯一取价入口**。
 *
 * 为什么是一层抽象而不是直接查表：DashScope 目前没有公开的价格查询 API，价格只在
 * 文档页公示，所以现阶段只能靠 `model_pricing` 表人工维护。将来若供应商提供实时
 * 价格接口（或接入多供应商各自的计价），换掉这里的实现即可，调用方（监控看板 /
 * 账单页 / 租户管理页）一行都不用改。
 *
 * 两条硬规则：
 * 1. **按调用发生当时生效的单价计费**——改价绝不篡改历史成本；
 * 2. **只对平台 Key 的调用计成本**——BYO 是租户自己付钱，平台零成本（4.8.17a/b）。
 */

export type PriceRow = {
  provider: string
  model: string
  inputPer1k: number
  outputPer1k: number
  effectiveFrom: string
}

/** 定价表快照：一次取全量（行数很少），供批量聚合时按时间点反复查询，避免 N+1。 */
export class PricingTable {
  // key = `${provider}::${model}`，值按 effectiveFrom 升序
  private readonly byKey = new Map<string, PriceRow[]>()

  constructor(rows: PriceRow[]) {
    for (const r of rows) {
      const k = `${r.provider}::${r.model}`
      const list = this.byKey.get(k) ?? []
      list.push(r)
      this.byKey.set(k, list)
    }
    for (const list of this.byKey.values()) {
      list.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    }
  }

  /**
   * 取 at 时刻生效的单价。查找顺序：
   *   (provider, model) → (provider, '*') → ('*', '*')
   * 全都命不中返回 null——调用方应把这类调用算作「无定价」而不是悄悄按 0 计。
   */
  priceAt(provider: string | null, model: string | null, at: string): PriceRow | null {
    const candidates = [
      `${provider ?? ''}::${model ?? ''}`,
      `${provider ?? ''}::*`,
      `*::*`,
    ]
    for (const key of candidates) {
      const list = this.byKey.get(key)
      if (!list?.length) continue
      // 取最后一条 effectiveFrom <= at
      let hit: PriceRow | null = null
      for (const r of list) {
        if (r.effectiveFrom <= at) hit = r
        else break
      }
      if (hit) return hit
    }
    return null
  }

  /** 单次调用成本（元）。无定价返回 null，由调用方决定如何呈现（不静默按 0）。 */
  costOf(
    log: { provider?: string | null; model?: string | null; tokens_in?: number | null; tokens_out?: number | null; created_at?: string | null },
  ): number | null {
    const at = log.created_at ?? new Date().toISOString()
    const p = this.priceAt(log.provider ?? null, log.model ?? null, at)
    if (!p) return null
    return ((log.tokens_in ?? 0) / 1000) * p.inputPer1k + ((log.tokens_out ?? 0) / 1000) * p.outputPer1k
  }

  get size(): number {
    return [...this.byKey.values()].reduce((s, l) => s + l.length, 0)
  }

  /** 4.8.17d：最近一次定价更新时间，用于「单价是否陈旧」告警。 */
  get latestEffectiveFrom(): string | null {
    let latest: string | null = null
    for (const list of this.byKey.values()) {
      const last = list[list.length - 1]
      if (last && (!latest || last.effectiveFrom > latest)) latest = last.effectiveFrom
    }
    return latest
  }
}

/** 定价陈旧判定（4.8.17d）：没有实时价格 API，只能靠「多久没人维护」提醒。 */
export const PRICING_STALE_DAYS = 90

export function isPricingStale(latestEffectiveFrom: string | null, now = Date.now()): boolean {
  if (!latestEffectiveFrom) return true
  return now - new Date(latestEffectiveFrom).getTime() > PRICING_STALE_DAYS * 24 * 3600 * 1000
}
