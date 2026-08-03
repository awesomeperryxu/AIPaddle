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

# 🔴 部署级互斥：两次部署重叠会同时跑 next build，直接撞上 Next 的构建锁。
# 宁可第二次立刻退出，也不要两边互相破坏对方的产物。
exec 9>/tmp/aipaddle-deploy.lock
if ! flock -n 9; then
  echo "🔴 已有另一次部署在进行中（/tmp/aipaddle-deploy.lock），本次退出"
  exit 1
fi

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

# 🔴 清掉陈旧的 git 锁。被中断的部署（ssh 断开、任务被杀）会让 git 半途退出，
# 留下 .git/index.lock，之后所有 git 操作都报
# 「Another git process seems to be running in this repository」——实测踩到过。
# 与 Next 构建锁同一类问题：中断留下的锁挡住后续操作。
# 🔴 只在确实没有 git 进程在本目录跑时才删——正在跑的操作不能动。
if [ -f .git/index.lock ]; then
  running=0
  for pid in $(pgrep -x git 2>/dev/null); do
    if [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" = "$PWD" ]; then running=1; break; fi
  done
  if [ "$running" = "0" ]; then
    echo "  清理陈旧的 .git/index.lock"
    rm -f .git/index.lock
  else
    echo "🔴 有 git 进程正在本仓库运行，本次退出"
    exit 1
  fi
fi

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
# 🔴 只杀本项目的 next build 进程，**绝不碰 next-server**——那是正在对外服务的应用。
# 用 cwd 精确匹配：这台机器上还跑着别的 Next 应用（含 Docker 里的），
# 按进程名粗暴 pkill 会误伤。排查时就见过一个存活 12.9 天的 next-server，
# 查了 /proc/<pid>/cwd 才确认它属于另一个容器——先查再动。
kill_stale_builds() {
  local me="$PWD" pid cwd
  for pid in $(pgrep -f 'next build|next-build' 2>/dev/null); do
    cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)
    if [ "$cwd" = "$me" ]; then
      echo "  清理陈旧构建进程 pid=$pid"
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
}

build_once() {
  # 🔴 BUG-97 真因：Next.js 有构建锁，报的是
  #    「Another next build process is already running」。
  # 一次被中断的构建会留下未释放的锁/进程，之后的构建一律拒绝启动——
  # 这正好解释「同样输入 2 成 1 败」：失败那次总是紧跟在一次被打断的构建之后。
  # （此前误以为是 rm -rf 的竞态，那只是表象。）
  kill_stale_builds
  sleep 1

  rm -rf .next.new
  # 🔴 确认真的删掉了再往下走。rm -rf 失败时只往 stderr 写一行就返回，
  # 在 set -e 下也未必中止；不验证的话就会拿一个半残目录去构建。
  if [ -e .next.new ]; then
    echo "🔴 .next.new 删除失败（可能有进程正在写入），中止"
    return 1
  fi

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
