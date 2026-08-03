#!/usr/bin/env bash
# 在生产服务器上执行一个迁移文件（GAP-8：此前没有任何可脚本化的迁移通道）。
#
# 为什么绕这么一圈：
#   · 本地 psql —— 开发机的 DNS 常被 fake-ip 代理劫持（所有域名 → 198.18.x），连不上；
#   · 服务器的 DATABASE_URL —— 指向 db.<ref>.supabase.co，该域名**只有 IPv6 记录**，
#     而 Crab 没有 IPv6 出口，直连必然 ENETUNREACH；
#   · Supabase 没有 exec_sql 之类的 RPC，REST 接口也执行不了 DDL。
# 可行的那条路是 **IPv4 Session Pooler**：域名有 A 记录、5432 可达，
# 密码复用 DATABASE_URL 里的那个。本脚本就是把这条路固化下来。
#
# 🔴 密码全程只在服务器上出现，不打印、不落盘、不出网。
#
# 用法（在本地执行，脚本会自己 ssh 过去）：
#   ./scripts/apply-migration.sh supabase/migrations/0038_xxx.sql
#   ./scripts/apply-migration.sh supabase/migrations/0038_xxx.sql --dry-run   # 只连不跑
set -euo pipefail

FILE="${1:-}"
DRY_RUN="${2:-}"
HOST="${DEPLOY_HOST:-ubuntu@43.173.99.218}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/lighthouse.pem}"
REGION="${SUPABASE_POOLER_REGION:-aws-0-ap-southeast-2}"

[ -n "$FILE" ] || { echo "用法: $0 <迁移文件> [--dry-run]"; exit 1; }
[ -f "$FILE" ] || { echo "❌ 找不到文件：$FILE"; exit 1; }

BASENAME=$(basename "$FILE")
echo "=== 迁移：$BASENAME ==="

scp -o ConnectTimeout=10 -i "$KEY" "$FILE" "$HOST:/tmp/$BASENAME" >/dev/null
echo "已上传到服务器"

ssh -o ConnectTimeout=30 -i "$KEY" "$HOST" "sudo bash -s" <<REMOTE
set -euo pipefail
cd /opt/aipaddle
DBURL=\$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')
PW=\$(python3 -c "import urllib.parse;u=urllib.parse.urlparse('''\$DBURL''');print(urllib.parse.quote(urllib.parse.unquote(u.password or ''),safe=''))")
REF=\$(python3 -c "import re;print(re.search(r'db\.([a-z0-9]+)\.supabase\.co','''\$DBURL''').group(1))")
POOLER="postgresql://postgres.\${REF}:\${PW}@${REGION}.pooler.supabase.com:5432/postgres"

# 先验连通，连不上就别往下走——半路失败的 DDL 最难收拾
PGCONNECT_TIMEOUT=10 psql "\$POOLER" -tAc "select 'connected as '||current_user"

if [ "${DRY_RUN}" = "--dry-run" ]; then
  echo "DRY-RUN：仅验证连通，不执行 SQL"
  rm -f "/tmp/$BASENAME"
  exit 0
fi

# ON_ERROR_STOP：任一语句失败立即中止，不继续跑后面的
psql "\$POOLER" -v ON_ERROR_STOP=1 -f "/tmp/$BASENAME"
rm -f "/tmp/$BASENAME"
echo "✅ 已执行"
REMOTE

echo "🔴 记得把本次迁移登记到 docs/MIGRATION_PLAN 的编号占用表"
