// 运行时上下文（WF-20）：把「现在是什么时候」交给流程。纯函数、零依赖、可单测。
//
// 🔴 为什么必须注入：用户实测「查全网当天 AI 大事件、看前一天的内容」，
// 跑出来的报告通篇在讲 **2024 年 8 月 5 日**——模型按训练语料里的「今天」作答，
// 而它的今天停在知识截止那一刻。于是产生两个连锁问题：
//   ① 流程结果整段是错的年份，且看上去像模像样；
//   ② 用户被迫在运行时手填一个「今天日期」参数——这本该由系统给出，
//      「当天/昨天」是运行时事实，不是业务输入。
//
// 所以：每次运行都按租户时区算出当天/昨天，既暴露成 {{today}} 这类占位符供提示词引用，
// 也作为 system 消息直接告诉模型——用户没写占位符时同样不会跑偏。

export type RuntimeVars = {
  timezone: string
  /** YYYY-MM-DD */
  today: string
  yesterday: string
  tomorrow: string
  /** YYYY-MM-DD HH:mm */
  now: string
  /** 星期三 */
  weekday: string
}

const WEEKDAY_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

/** 按目标时区取 YYYY-MM-DD（en-CA 的日期格式天然就是这个形状，免手拼） */
function ymd(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

function hm(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

/** 目标时区里的星期几。Intl 的 weekday=short(en) 再映射，避免依赖本机 locale */
function weekdayCn(date: Date, timeZone: string): string {
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date)
  const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short)
  return idx >= 0 ? WEEKDAY_CN[idx] : ''
}

const DAY_MS = 86_400_000

/**
 * 算出本次运行的时间事实。
 * @param timezone 租户时区，默认 Asia/Shanghai（本平台用户都在 GMT+8）
 * @param at       现在（可注入，便于测试）
 */
export function buildRuntimeVars(timezone = 'Asia/Shanghai', at: Date = new Date()): RuntimeVars {
  return {
    timezone,
    today: ymd(at, timezone),
    yesterday: ymd(new Date(at.getTime() - DAY_MS), timezone),
    tomorrow: ymd(new Date(at.getTime() + DAY_MS), timezone),
    now: `${ymd(at, timezone)} ${hm(at, timezone)}`,
    weekday: weekdayCn(at, timezone),
  }
}

// 提示词里可用的占位符。故意只认这几个固定名字：
// 放开成任意表达式就得引入一套求值器，而变量池（lib/workflow/variables.ts）已经在做那件事。
const PLACEHOLDER_RE = /\{\{\s*(today|yesterday|tomorrow|now|weekday|timezone)\s*\}\}/g

/** 把提示词里的 {{today}} / {{yesterday}} 等替换成真实值 */
export function renderRuntimeVars(text: string, vars: RuntimeVars): string {
  if (!text) return text
  return text.replace(PLACEHOLDER_RE, (_m, key: keyof RuntimeVars) => String(vars[key] ?? ''))
}

/**
 * 这张图跑起来到底需不需要外部输入（WF-20）。
 *
 * 🔴 之前测试运行抽屉不管三七二十一都摆一个「起始输入」文本框，
 * 于是用户为一条「查当天 AI 大事件」的定时流程手填了一个日期当参数——
 * 那既不是业务输入，也不该由人填。判据只认两处显式声明：
 *   ① start 节点在配置面板里定义了输入变量（config.variables）；
 *   ② 任何节点引用了系统变量 sys.query（= 本次运行输入）。
 * 都没有 → 这条流程自给自足，输入框纯属噪音。
 */
export function graphNeedsInput(graph: unknown): boolean {
  const g = graph as { nodes?: { type?: string; data?: { config?: Record<string, unknown> } }[] } | null
  const nodes = Array.isArray(g?.nodes) ? g!.nodes! : []
  for (const n of nodes) {
    const cfg = n?.data?.config ?? {}
    if (n?.type === 'start' && Array.isArray(cfg.variables) && cfg.variables.length > 0) return true
    // 提示词/条件里引用了 sys.query 就说明它等着运行输入
    if (/sys\.query/.test(JSON.stringify(cfg ?? {}))) return true
  }
  return false
}

/**
 * 给模型的时间锚点（system 消息）。
 *
 * 🔴 光替换占位符不够：用户的提示词多半只写「查昨天的 AI 大事件」，一个占位符都没有。
 * 不把当前日期直接告诉模型，它照样会拿训练语料里的年份作答。
 */
export function runtimeSystemPrompt(vars: RuntimeVars): string {
  return [
    `当前时间：${vars.now}（${vars.weekday}），时区 ${vars.timezone}。`,
    `今天是 ${vars.today}，昨天是 ${vars.yesterday}。`,
    '涉及「今天/当天/昨天/前一天/最近」等相对时间时，一律以上述日期为准，不要使用你训练数据里的日期。',
  ].join('\n')
}
