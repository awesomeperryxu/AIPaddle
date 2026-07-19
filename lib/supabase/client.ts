'use client'
import { createBrowserClient } from '@supabase/ssr'

// 仅用于客户端组件的 session 读取（不做业务数据请求，见 ADR-001）
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
