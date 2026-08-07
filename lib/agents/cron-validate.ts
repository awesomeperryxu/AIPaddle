// 五段式 cron 校验（WF-6）。纯函数、无依赖，供表单即时校验与单测共用。
//
// 为什么要校验：定时作业的 cron 一旦写错，表现是**到点静默不触发**——
// 不报错、不留痕，要等到「该跑却没跑」才被发现，而那时往往已经过了一个周期。
// 所以在用户保存前就拦住，而不是存进去等出问题。

type FieldSpec = { name: string; min: number; max: number }

const FIELDS: FieldSpec[] = [
  { name: '分钟', min: 0, max: 59 },
  { name: '小时', min: 0, max: 23 },
  { name: '日', min: 1, max: 31 },
  { name: '月', min: 1, max: 12 },
  { name: '星期', min: 0, max: 7 }, // 0 与 7 都表示周日
]

/** 校验单个字段：支持 * / 数字 / a-b 区间 / a,b,c 列表 / * 或区间加 /step */
function checkField(raw: string, spec: FieldSpec): string {
  const value = raw.trim()
  if (!value) return `${spec.name}不能为空`

  for (const part of value.split(',')) {
    const [range, stepRaw, ...rest] = part.split('/')
    if (rest.length > 0) return `${spec.name}「${part}」格式错误：步长只能出现一次`

    if (stepRaw !== undefined) {
      const step = Number(stepRaw)
      if (!Number.isInteger(step) || step <= 0) return `${spec.name}的步长必须是正整数`
    }

    if (range === '*') continue

    if (range.includes('-')) {
      const [a, b] = range.split('-')
      const from = Number(a), to = Number(b)
      if (!Number.isInteger(from) || !Number.isInteger(to)) return `${spec.name}区间「${range}」不是整数`
      if (from < spec.min || to > spec.max) return `${spec.name}超出范围（${spec.min}-${spec.max}）`
      if (from > to) return `${spec.name}区间起点不能大于终点`
      continue
    }

    const n = Number(range)
    if (!Number.isInteger(n)) return `${spec.name}「${range}」不是整数`
    if (n < spec.min || n > spec.max) return `${spec.name}超出范围（${spec.min}-${spec.max}）`
  }
  return ''
}

/** 返回空串表示合法；否则返回可直接展示给用户的中文原因 */
export function validateCron(expr: string): string {
  const parts = (expr ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'cron 不能为空'
  if (parts.length !== 5) {
    return `需要 5 段（分 时 日 月 周），当前 ${parts.length} 段`
  }
  for (let i = 0; i < FIELDS.length; i++) {
    const err = checkField(parts[i], FIELDS[i])
    if (err) return err
  }
  return ''
}
