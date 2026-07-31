import 'server-only'

// V12-4.8（邮件道）：通知能力的公共契约。
// 🔴 文件边界（PARALLEL_COORDINATION_v113 §5）：发信逻辑只允许出现在 lib/notify/**，
// app/api/ext/** 只负责调用。即便两道当前由同一会话承担，边界也照旧执行——
// 日后拆回独立道时不需要重构。

/** 留资五项（2026-07-31 用户指定）+ 上下文。 */
export type LeadPayload = {
  name: string
  contact: string
  project?: string
  expectedTime?: string
  siteInfo?: string
  source?: string
  conversationSummary?: string
}

export type ChannelResult = {
  success: boolean
  target?: string
  errorCode?: string
  errorDetail?: string
  latencyMs: number
}

export type NotifyResult = {
  email: boolean
  wecom: boolean
  /** 逐条投递明细，供落 notification_deliveries 表 */
  deliveries: Array<ChannelResult & { channel: 'wecom' | 'email' }>
}

/** 字段标签统一在一处定义，避免企微与邮件两处文案漂移。 */
export const LEAD_FIELDS: Array<{ key: keyof LeadPayload; label: string }> = [
  { key: 'name', label: '称呼' },
  { key: 'contact', label: '联系方式' },
  { key: 'project', label: '需求项目' },
  { key: 'expectedTime', label: '期望时间' },
  { key: 'siteInfo', label: '场地情况' },
]
