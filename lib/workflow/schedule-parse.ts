// 中文时间短语 → cron（WF-13）。纯函数、零依赖、可单测。
//
// 🔴 为什么不交给模型：实测同一句「每天早上8点运行」，qwen-plus 连续两次都**没有**
// 输出 schedule 字段——prompt 里写成硬性要求、标红、举例都压不住。
// 定时是用户明确说出口的需求，丢了就是功能缺失，不能押在模型的指令遵循上。
// 模型给了就用模型的（它能处理复杂表述），没给就用这里的规则兜底。
//
// 覆盖的是中文里高频、无歧义的说法；拿不准一律返回 undefined——
// 猜错时间比不设更糟：用户以为设好了，实际在错误的点跑。

const CN_NUM: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  十一: 11, 十二: 12,
}

/** 「8」「八」「十一」→ 数字；识别不了返回 null */
function toNum(raw: string): number | null {
  const s = raw.trim()
  if (/^\d{1,2}$/.test(s)) return Number(s)
  if (s in CN_NUM) return CN_NUM[s]
  // 十三～十九、二十～二十三
  const m = /^(十)([一二三四五六七八九])$|^(二十)([一二三])?$/.exec(s)
  if (m) {
    if (m[1]) return 10 + CN_NUM[m[2]]
    return 20 + (m[4] ? CN_NUM[m[4]] : 0)
  }
  return null
}

const WEEKDAY: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 0,
}

/** 按「上午/下午/晚上/凌晨」把 12 小时制换算成 24 小时制 */
function applyMeridiem(hour: number, meridiem: string | undefined): number {
  if (!meridiem) return hour
  if (/下午|晚上|傍晚/.test(meridiem) && hour < 12) return hour + 12
  if (/中午/.test(meridiem) && hour < 12) return 12
  if (/凌晨|早上|上午|早晨/.test(meridiem) && hour === 12) return 0
  return hour
}

/** 抽出「X点Y分」里的时分；没写时间返回 null */
function parseTimeOfDay(text: string): { hour: number; minute: number } | null {
  const m = /(凌晨|早上|早晨|上午|中午|下午|晚上|傍晚)?\s*(\d{1,2}|[零一两二三四五六七八九十]{1,3})\s*[点时]\s*(半|(\d{1,2}|[零一两二三四五六七八九十]{1,3})\s*分?)?/.exec(text)
  if (!m) return null
  const h0 = toNum(m[2])
  if (h0 === null || h0 > 23) return null
  const hour = applyMeridiem(h0, m[1])
  if (hour > 23) return null
  let minute = 0
  if (m[3]) {
    if (m[3].trim() === '半') minute = 30
    else {
      const mi = toNum(m[4] ?? '')
      if (mi === null || mi > 59) return null
      minute = mi
    }
  }
  return { hour, minute }
}

/**
 * 从需求描述里解析出 cron。识别不到返回 undefined。
 *
 * 支持：每分钟 / 每 N 分钟 / 每小时 / 每天X点 / 每个工作日X点 /
 *       每周X（几点）/ 每月N日（几点）。默认时间为 9:00。
 */
export function parseCronFromText(text: string): string | undefined {
  if (!text) return undefined
  const s = text.replace(/\s+/g, '')

  // 「每N分钟」「每隔N分钟」
  const perMin = /每(?:隔)?(\d{1,2})分钟/.exec(s)
  if (perMin) {
    const n = Number(perMin[1])
    return n >= 1 && n <= 59 ? `*/${n} * * * *` : undefined
  }
  if (/每分钟/.test(s)) return '* * * * *'

  // 「每N小时」「每小时」
  const perHour = /每(?:隔)?(\d{1,2})(?:个)?小时/.exec(s)
  if (perHour) {
    const n = Number(perHour[1])
    return n >= 1 && n <= 23 ? `0 */${n} * * *` : undefined
  }
  if (/每(?:个)?小时/.test(s)) return '0 * * * *'

  const time = parseTimeOfDay(s)
  const hh = time?.hour ?? 9
  const mm = time?.minute ?? 0

  // 「每月N日/号」
  const monthly = /每(?:个)?月(?:的)?(\d{1,2}|[零一两二三四五六七八九十]{1,3})[日号]/.exec(s)
  if (monthly) {
    const d = toNum(monthly[1])
    if (d !== null && d >= 1 && d <= 31) return `${mm} ${hh} ${d} * *`
  }

  // 「每周X」「每星期X」「每礼拜X」
  const weekly = /每(?:个)?(?:周|星期|礼拜)([一二三四五六日天1-7])/.exec(s)
  if (weekly) {
    const dow = WEEKDAY[weekly[1]]
    if (dow !== undefined) return `${mm} ${hh} * * ${dow}`
  }

  // 「每个工作日」
  if (/每(?:个)?工作日|工作日(?:的)?每天/.test(s)) return `${mm} ${hh} * * 1-5`

  // 「每天」「每日」「每晚」——必须有「每」，否则「昨天8点的数据」会被误判成定时
  if (/每(?:天|日|晚)|天天/.test(s)) return `${mm} ${hh} * * *`

  // 「定时/每日定时」类只说定时没说频率：不猜，交回 undefined
  return undefined
}

/** 描述里是否明确提到了周期性运行（用于决定要不要兜底补 schedule） */
export function mentionsSchedule(text: string): boolean {
  return /每(?:天|日|晚|周|星期|礼拜|月|小时|分钟|隔|个)|天天|工作日|定时|定期|周期性|自动运行|自动执行/.test(
    (text ?? '').replace(/\s+/g, ''),
  )
}
