// 浏览器薄封装（ADR-008）：客户端组件通过此模块发请求，禁止直连 Supabase 或 lib/data/*。
// 服务端组件 / Server Actions 直接调 lib/data/*，不走这里。

type ApiError = { code: string; message: string }
type ApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError }

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  const body = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) {
    const err = body.error as ApiError | undefined
    return { data: null, error: err ?? { code: 'unknown', message: res.statusText } }
  }
  return { data: body as T, error: null }
}

export const apiClient = {
  get:    <T>(path: string)                => request<T>(path),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: <T>(path: string)                => request<T>(path, { method: 'DELETE' }),
}
