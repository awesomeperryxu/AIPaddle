import 'server-only'

/**
 * 4.8.18：账号密码策略（唯一校验入口）。
 *
 * 产品决策（2026-07-28）：新建账号由**创建人直接指定密码**，不再走 Supabase 邀请邮件
 * （国内邮件送达率不稳，且多一次跳转）。代价是密码要靠人工转达，所以：
 *   · 服务端强制最低强度，挡住 123456 这类；
 *   · 密码**绝不进日志、审计 detail、错误信息、前端回显**；
 *   · 必须配套「用户自行改密」入口，否则初始密码会长期不变（见 /api/auth/password）。
 */

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72   // bcrypt 有效长度上限，超出部分被静默截断，不如直接拒绝

/** 校验密码强度。通过返回 null，不通过返回中文原因（可直接回前端）。 */
export function validatePassword(pwd: unknown): string | null {
  if (typeof pwd !== 'string' || pwd.length === 0) return '密码不能为空'
  if (pwd.length < PASSWORD_MIN) return `密码至少 ${PASSWORD_MIN} 位`
  if (pwd.length > PASSWORD_MAX) return `密码不能超过 ${PASSWORD_MAX} 位`
  if (/^\s|\s$/.test(pwd)) return '密码首尾不能有空格'

  // 至少两类字符，挡住纯数字/纯字母这类弱口令
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pwd)).length
  if (classes < 2) return '密码需包含字母、数字、符号中的至少两类'

  return null
}

/** 常见弱口令黑名单（小写比对）。指定密码的场景下最容易被图省事填这些。 */
const WEAK = new Set([
  'password', 'password1', '12345678', '123456789', 'qwerty123',
  'abc12345', 'admin123', 'aipaddle', 'aipaddle123', '11111111',
])

export function isWeakPassword(pwd: string): boolean {
  return WEAK.has(pwd.toLowerCase())
}

/** 一步校验：强度 + 弱口令。通过返回 null。 */
export function checkPassword(pwd: unknown): string | null {
  const err = validatePassword(pwd)
  if (err) return err
  if (isWeakPassword(pwd as string)) return '该密码过于常见，请更换'
  return null
}
