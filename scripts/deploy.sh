#!/usr/bin/env bash
# 部署 main 到生产服务器。
#
# 🔴 2026-08-03 手工部署踩过的坑，逐条固化在这里：
#   ① 用了 sudo —— 应用跑在 ubuntu 的 pm2 下，sudo pm2 是另一个上下文，
#      结果起了个空的 root 守护进程还报 Process not found。目录属主本就是 ubuntu。
#   ② pnpm install 无 TTY 中止 —— 要 CI=true。
#   ③ git reset 先执行、构建后失败 → 线上处于「新源码 + 旧 .next」的半更新状态，
#      多条路由 500，而日志里的 InvariantError 看着像 Next.js 自身的 bug。
#      用户点创建知识库撞上的就是这个。
#   ④ 🔴 heredoc 没加引号 —— 本地 shell 会先展开变量和反引号，
#      连注释里的反引号也会被当成命令执行，下发到服务器的是**被改坏的脚本**。
#      本脚本前两次实跑都栽在这，而报错（syntax error near |、usage: mv）
#      看着像服务器出了问题，排查方向完全被带偏。
#      故：heredoc 用单引号包住定界符，需要的值经 ssh 环境变量传入。
#
# 零停机：构建到 .next.new（next.config.mjs 支持 NEXT_DIST_DIR），成功后原子切换。
# 构建期间线上照跑旧产物；且每次全新目录，不会有增量构建残留的不一致清单。
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

# 🔴 定界符加单引号：本地一律不展开，脚本原样送达。参数经环境变量传。
# 🔴 不带 sudo：目录属主就是登录用户。
ssh -o ConnectTimeout=20 -i "$KEY" "$HOST" \
  "APP_DIR='$APP_DIR' PM2_NAME='$PM2_NAME' bash -s" <<'REMOTE'
set -euo pipefail
cd "$APP_DIR"
export CI=true          # 无 TTY 时 pnpm 会中止删除 node_modules

PREV=$(git rev-parse HEAD)
echo "当前版本：$(git log --oneline -1)"

# 失败即回滚。半更新（新源码 + 旧构建产物）比「没更新」危险得多——
# 它不会报错，只在某些路由上 500。
# 🔴 显式 exit 不会触发 ERR trap（只有命令失败才会）。
# 第一版在构建失败分支里直接 exit 1，于是回滚被自己的错误处理绕过，
# 服务器停在「新 commit + 旧 .next」——正是本脚本要防的半更新状态。
# 所以所有主动失败都必须走 die()，不许裸 exit。
die() {
  trap - ERR          # 防止 rollback 内部命令失败再次触发，递归
  rollback
  exit 1
}

rollback() {
  echo "🔴 部署失败，回滚到 $PREV"
  git reset --hard "$PREV"
  rm -rf .next.new
  # 旧 .next 全程没动过，源码退回去即自洽，不必重建
  pm2 restart "$PM2_NAME" --update-env || true
  echo "已回滚（旧构建产物未受影响）"
}
trap rollback ERR

git fetch origin main
git reset --hard origin/main
echo "目标版本：$(git log --oneline -1)"

pnpm install --frozen-lockfile 2>&1 | tail -2

# 构建到临时目录 —— 线上此刻仍跑着旧 .next
# 全量日志落盘再摘要：早先把构建输出接进 tail 做摘要，结果失败时报错被吃掉，
# 只剩一句 A previous build that didn't exit cleanly，等于没有信息。
# 🔴 构建重试一次：这一步实测会抖——同样的输入 2 成 1 败，
# 失败时报 .next.new/server/pages-manifest.json 不存在（server 目录整个是空的，
# 即构建在写产物之前就断了）。没查出确定成因，故先按已知不稳定处理：
# 重试一次并把两次日志都留着。若重试仍失败，多半是真问题而非抖动。
build_once() {
  rm -rf .next.new
  NEXT_DIST_DIR=.next.new pnpm build > "$1" 2>&1
}
BUILD_LOG="/tmp/aipaddle-build-$(date +%s).log"
if build_once "$BUILD_LOG"; then
  tail -3 "$BUILD_LOG"
else
  echo "⚠️ 构建失败，重试一次（该步骤已知不稳定）。首次日志：$BUILD_LOG"
  tail -12 "$BUILD_LOG"
  BUILD_LOG2="/tmp/aipaddle-build-$(date +%s)-retry.log"
  if build_once "$BUILD_LOG2"; then
    echo "✅ 重试成功"
    tail -3 "$BUILD_LOG2"
  else
    echo "🔴 重试仍失败，完整日志 $BUILD_LOG2 ——"
    tail -40 "$BUILD_LOG2"
    die
  fi
fi

# 产物完整性自检：缺了这些说明构建其实没成，别拿去替换线上
for f in .next.new/BUILD_ID .next.new/server/app; do
  if [ ! -e "$f" ]; then echo "🔴 构建产物缺 $f"; die; fi
done

# 原子切换
rm -rf .next.old
# 注意：不能用 test -d 后接 && mv 的连写 —— set -e 下目录不存在时整行返回 1，
# 会误触发回滚。用 if 块。
if [ -d .next ]; then mv .next .next.old; fi
mv .next.new .next
pm2 restart "$PM2_NAME" --update-env
trap - ERR

sleep 5
if pm2 list | grep "$PM2_NAME" | grep -q online; then
  rm -rf .next.old
  echo "✅ 进程 online，旧构建产物已清理"
else
  # 起不来就把旧产物换回去。这一步不能靠 trap：此时源码已是新的
  echo "🔴 进程未起来，恢复旧构建产物"
  rm -rf .next
  mv .next.old .next
  git reset --hard "$PREV"
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
