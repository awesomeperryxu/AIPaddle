// 数据层抛出的中文业务错误 → HTTP 状态码的统一映射（route.ts 只能导出 HTTP 方法，故放在这里）。
// 约定：不存在/越权 → 404（不泄露他租户资源是否存在）；入参不合法 → 400；业务规则冲突 → 409。

export function departmentErrorStatus(msg: string): number {
  if (msg.includes('不存在或无权限')) return 404
  if (msg.includes('不能为空') || msg.includes('不能超过 50')) return 400
  if (
    msg.includes('层级不能超过') ||
    msg.includes('同名部门') ||
    msg.includes('不能把部门移动') ||
    msg.includes('请先')
  ) return 409
  return 500
}

export function departmentFail(msg: string) {
  const status = departmentErrorStatus(msg)
  const code =
    status === 404 ? 'not_found'
    : status === 400 ? 'invalid'
    : status === 409 ? 'conflict'
    : 'server_error'
  return Response.json({ error: { code, message: msg } }, { status })
}
