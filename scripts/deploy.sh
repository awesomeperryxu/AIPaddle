#!/usr/bin/env bash
# 部署 main 到生产服务器。
#
# 🔴 为什么要有这个脚本：2026-08-03 手工部署踩了三个坑，每一个都是"知道但当时忘了"：
#   ① 用了 sudo —— 应用跑在 ubuntu 的 pm2 下，sudo pm2 是另一个上下文，
#      结果起了个空的 root 守护进程，还报 "Process not found"。
#      /opt/aipaddle 属主本就是 ubuntu，整个部署不需要 sudo。
#   ② pnpm install 无 TTY 中止 —— 要 CI=true。
#   ③ 🔴 最要命的：git reset 先执行、构建后失败，于是**新源码配旧 .next**，
#      线上多条路由报 "client reference manifest does not exist" 500，
#      而我当时只看到"构建失败"，没意识到线上已处于半更新状态。
#      用户点创建知识库撞上的就是这个。
#
# 对策：
#   · 先记录当前 commit，任何一步失败就回滚源码并重启回旧版本；
#   · 🔴 构建到临时目录（NEXT_DIST_DIR=.next.new，next.config.mjs 已支持），
#     构建成功后再原子切换成 .next。这样做有两个好处：
#       - 构建期间线上照常跑旧 .next，**零停机**（直接 rm -rf .next 会让
#         整个构建期 2~4 分钟内所有页面 500）；
#       - 每次都是全新目录，不会有增量构建残留的不一致清单——
#         "client reference manifest does not exist" 就是这么来的。
#
# 用法：
#   ./scripts/deploy.sh              # 部署 origin/main
#   ./scripts/deploy.sh --no-verify  # 跳过部署后验证（不建议）
set -euo pipefail

HOST="${DEPLOY_HOST:-ubuntu@43.173.99.218}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/lighthouse.pem}"
APP_DIR="${DEPLOY_DIR:-/opt/aipaddle}"
PM2_NAME="${PM2_NAME:-aipaddle}"

echo "=== 部署到 $HOST:$APP_DIR ==="

# 🔴 不带 sudo：目录属主就是登录用户，用 sudo 会切到另一个 pm2 上下文
ssh -o ConnectTimeout=20 -i "$KEY" "$HOST" "bash -s" <<REMOTE
set -euo pipefail
cd "$APP_DIR"
export CI=true          # 无 TTY 时 pnpm 会中止删除 node_modules

PREV=\$(git rev-parse HEAD)
echo "当前版本：\$(git log --oneline -1)"

# 失败即回滚：把源码退回去并重启，让线上回到一个自洽的状态。
# 半更新（新源码 + 旧构建产物）比"没更新"危险得多——它不会报错，只会在
# 某些路由上 500，而日志里的 InvariantError 看着像 Next.js 自己的 bug。
rollback() {
  echo "🔴 部署失败，回滚到 \$PREV"
  git reset --hard "\$PREV"
  rm -rf .next.new
  # 旧 .next 全程没动过，源码退回去即自洽，不必重建；重启只为确保进程加载的是旧码
  pm2 restart "$PM2_NAME" --update-env || true
  echo "已回滚（旧构建产物未受影响）"
}
trap rollback ERR

git fetch origin main
git reset --hard origin/main
echo "目标版本：\$(git log --oneline -1)"

pnpm install --frozen-lockfile 2>&1 | tail -2

# 构建到临时目录 —— 线上此刻仍跑着旧 .next
rm -rf .next.new
NEXT_DIST_DIR=.next.new pnpm build 2>&1 | tail -4

# 构建产物完整性自检：缺了这些文件说明构建其实没成，别拿去替换线上
for f in .next.new/BUILD_ID .next.new/server/app; do
  [ -e "\$f" ] || { echo "🔴 构建产物缺 \$f"; exit 1; }
done

# 原子切换：旧的先挪走，成功后再删
rm -rf .next.old
# 🔴 不能写成 `[ -d .next ] && mv ...`：set -e 下目录不存在时整行返回 1，
# 会误触发回滚 —— 首次部署就会莫名其妙"失败"
if [ -d .next ]; then mv .next .next.old; fi
mv .next.new .next
pm2 restart "$PM2_NAME" --update-env
trap - ERR
sleep 5
if pm2 list | grep "$PM2_NAME" | grep -q online; then
  rm -rf .next.old
  echo "✅ 进程 online，旧构建产物已清理"
else
  # 起不来就把旧产物换回去——这一步不能靠 trap，此时源码已是新的
  echo "🔴 进程未起来，恢复旧构建产物"
  rm -rf .next && mv .next.old .next
  git reset --hard "\$PREV"
  pm2 restart "$PM2_NAME" --update-env || true
  exit 1
fi
REMOTE

if [ "${1:-}" != "--no-verify" ]; then
  echo
  echo "=== 部署后验证 ==="
  sleep 3
  "$(dirname "$0")/verify-deploy.sh"
fi
