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

// 🔴 字段标签与顺序**对齐官网既有留资通知**（royalblack 官网 src/app/api/lead/route.js）。
// 高润收到的两种通知（官网表单 / AI 客服）必须长得一样，只有「来源渠道」不同——
// 否则同一件事两种版式，跟进时得先分辨这是哪来的。
// 期望时间与场地情况是 AI 客服能问出、而官网表单没有的，故置于所需服务之后。
export const LEAD_FIELDS: Array<{ key: keyof LeadPayload; label: string }> = [
  { key: 'name', label: '姓名' },
  { key: 'contact', label: '联系方式' },
  { key: 'project', label: '所需服务' },
  { key: 'expectedTime', label: '期望时间' },
  { key: 'siteInfo', label: '场地情况' },
  { key: 'conversationSummary', label: '备注' },
]

/** 官网模板用「未填写」占位，此处保持一致，不留空白格。 */
export const EMPTY_PLACEHOLDER = '未填写'

/** 提交时间：官网用 zh-CN + Asia/Shanghai，照抄以免两种通知时间格式不一。 */
export function submittedAt(now: Date = new Date()): string {
  return now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

// 来源渠道取值。两种通知版式完全相同，**只有这一行不同**——
// 高润扫一眼就知道该按哪种方式跟进（表单客户已明确需求，客服客户可能还在比价）。
export const LEAD_SOURCE = {
  /** 官网留资表单（官网 /api/lead 自己发，此处仅登记以免两边取值漂移） */
  form: '官网留资表单',
  /** 官网在线客服对话中留下的信息 */
  chat: '在线客服咨询',
  /** 对话中主动点「转人工顾问」 */
  handoff: '在线客服转人工',
} as const
