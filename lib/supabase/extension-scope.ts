import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'

// V12-8.6 / ADR-020 §3：让 `lib/data/*` 在 Extension 请求下**一行都不用改**。
//
// 问题：lib/data/* 每个函数内部都调 `createClient()`，而它是从 cookies 取登录会话的。
// 外部 Key 调用没有 cookie，直接用会拿到匿名客户端 → RLS 判假 → 查不到数据。
//
// 三种解法里选了这个：
//   ① 给 lib/data/* 每个函数加"可注入客户端"参数 —— 要改几十个函数签名，ADR-008 的
//      四层依赖也会被搅乱；
//   ② X 道另写一套 lib/data/extension-*.ts —— 同一份查询逻辑写两遍，日后必然分叉；
//   ③ ✅ 用 AsyncLocalStorage 把机器用户令牌绑在当前请求的异步上下文里，createClient()
//      发现有令牌就改用它建客户端。改动只落在 lib/supabase/server.ts 一处，
//      lib/data/* 零改动，调用方也无感。
//
// 🔴 边界：只有 /api/ext/v1/* 会 runWithExtensionToken 建立这个作用域；内部路由永远
// 取不到 store，行为完全不变。AsyncLocalStorage 按异步链隔离，并发请求之间不串。
const store = new AsyncLocalStorage<string>()

/** 在给定机器用户令牌的作用域内执行；作用域内的 createClient() 会自动带上该令牌。 */
export function runWithExtensionToken<T>(accessToken: string, fn: () => Promise<T>): Promise<T> {
  return store.run(accessToken, fn)
}

/** 读取当前异步上下文的机器用户令牌；不在 Extension 请求中时返回 undefined。 */
export function currentExtensionToken(): string | undefined {
  return store.getStore()
}
