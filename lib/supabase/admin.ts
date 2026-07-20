import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ⚠️ 服务级客户端（service_role）——绕过 RLS，唯一封装文件（ADR-002 铁律）。
// 只用于系统级操作：seed / 跨租户运维 / Auth 用户管理 / 定时任务写 audit_logs。
// 禁止用它响应"某个登录用户发起的业务请求"——那必须用请求级客户端（lib/supabase/server）。
// 其他任何文件不得 import SUPABASE_SERVICE_ROLE_KEY 或自建 service 客户端。
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
