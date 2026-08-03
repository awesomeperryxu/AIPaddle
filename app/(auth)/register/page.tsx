import { redirect } from 'next/navigation'

// 🔴 自助注册已关闭（2026-08-03 用户拍板，BUG-93）。
// 入账路径只有「平台开租户 → 租户管理员邀请成员」。
//
// 真正的拦截在 app/(auth)/actions.ts 的 SELF_REGISTRATION_ENABLED——
// Server Action 是独立可调的端点，光收页面挡不住直接 POST。
// 这里只是把表单收掉，免得留一个填了也没用的入口。
export default function RegisterPage() {
  redirect('/login?error=registration_closed')
}
