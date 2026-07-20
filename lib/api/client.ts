// 浏览器薄封装（ADR-008）：客户端组件统一经此请求自己的 Next API，
// 自动带会话 Cookie、统一 JSON 头与错误结构 {error:{code,message}}。
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body?.error?.message ?? message
    } catch {
      // 非 JSON 响应，保留 statusText
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}
