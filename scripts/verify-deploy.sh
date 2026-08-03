#!/usr/bin/env bash
# 部署后冒烟验证。手工部署没有回归保护，靠这个把「关键路径还活着」验一遍。
#
# 🔴 只做只读探测：不建数据、不发消息、不改状态。
# 部署验证脚本自己制造副作用，会让「线上有脏数据」变成常态。
#
# 用法：
#   ./scripts/verify-deploy.sh                      # 默认打生产 https://aipaddle.net
#   BASE=http://localhost:3000 ./scripts/verify-deploy.sh
#
# 注：曾经的 /d1preview basePath 已废弃——现在 /d1preview/* 会 307 到根路径。
# 用它当 BASE 会让每条断言都测到那个跳转上，全线误报（第一次跑就栽在这）。
set -uo pipefail

BASE="${BASE:-https://aipaddle.net}"
fail=0

# code <期望码> <路径> <说明>
code() {
  local want="$1" path="$2" desc="$3"
  local got
  got=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE$path" 2>/dev/null)
  if [ "$got" = "$want" ]; then
    printf '  ✅ %-38s %s\n' "$desc" "$got"
  else
    printf '  ❌ %-38s 期望 %s，实际 %s\n' "$desc" "$want" "$got"; fail=$((fail+1))
  fi
}

# body <关键字> <路径> <说明>；关键字必须出现
body() {
  local kw="$1" path="$2" desc="$3"
  if curl -s --max-time 15 "$BASE$path" 2>/dev/null | grep -q "$kw"; then
    printf '  ✅ %-38s 含「%s」\n' "$desc" "$kw"
  else
    printf '  ❌ %-38s 未见「%s」\n' "$desc" "$kw"; fail=$((fail+1))
  fi
}

echo "=== 部署验证：$BASE ==="

echo "① 基础可达"
code 200 /login "登录页"

echo "② 自助注册已关闭（BUG-93）"
# 未登录访问受保护页应回登录页而不是 500/死循环
code 307 /register "注册页重定向"
body "请联系企业管理员开通" /login "登录页无注册入口"

echo "③ 受保护页面未登录时回踢"
for p in /dashboard /plugins/mcp /plugins/smtp /agents; do
  code 307 "$p" "未登录访问 $p"
done

echo "④ 对外 Extension API 仍被放行（不是 307 到 login）"
# 🔴 这条最容易被中间件改动误伤：放行没了，外部拿到的是跳转而非 401，调不通且看不出原因
got=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/api/ext/v1/chat" -X POST -H 'content-type: application/json' -d '{}' 2>/dev/null)
if [ "$got" = "307" ] || [ "$got" = "302" ]; then
  printf '  ❌ %-38s 被重定向（%s）——中间件放行丢了\n' "对外 API 未被会话检查拦截" "$got"; fail=$((fail+1))
else
  printf '  ✅ %-38s %s（非重定向即正常，鉴权在端点内做）\n' "对外 API 未被会话检查拦截" "$got"
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "✅ 全部通过"
else
  echo "❌ $fail 项未通过 —— 部署有问题，先查再说，不要放着"
  exit 1
fi
