#!/bin/bash

# PRD 快速更新脚本 - 优化版
# 用法: ./quick-update.sh <module_name>

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} ⚠️  $1"; }

# 配置
PROJECT_ROOT="/Users/perryxu/github/v0-ai-llmops-prototype"
MODULES_DIR="$PROJECT_ROOT/docs/requirements/modules"
ITERATION_DIR="$PROJECT_ROOT/docs/requirements/iteration"

# 参数
MODULE_NAME=$1
TODAY=$(date '+%Y%m%d')

if [ -z "$MODULE_NAME" ]; then
    log "用法: ./quick-update.sh <module_name>"
    log "示例: ./quick-update.sh tenant-management"
    exit 1
fi

# 查找 iteration 文件
ITER_FILE=$(find "$ITERATION_DIR" -name "*${MODULE_NAME}*${TODAY}.md" -type f | head -1)

if [ -z "$ITER_FILE" ]; then
    warn "未找到今日 iteration 文件: *${MODULE_NAME}*${TODAY}.md"
    log "可用的 iteration 文件:"
    ls -1 "$ITERATION_DIR"/*${TODAY}.md 2>/dev/null || echo "  (无)"
    exit 1
fi

log "找到 iteration 文件: $(basename $ITER_FILE)"

# 查找目标模块文件
MODULE_FILE=$(find "$MODULES_DIR" -name "*${MODULE_NAME}*.md" -type f | head -1)

if [ -z "$MODULE_FILE" ]; then
    warn "未找到模块文件，将创建新文件"
    MODULE_FILE="$MODULES_DIR/${MODULE_NAME}.md"
    echo "# ${MODULE_NAME}" > "$MODULE_FILE"
fi

log "目标模块文件: $(basename $MODULE_FILE)"

# 生成 Claude 提示词
PROMPT_FILE="/tmp/claude_prompt_${MODULE_NAME}.txt"

cat > "$PROMPT_FILE" << EOF
请增量更新模块文档。

## 输入
- Iteration 文件: $ITER_FILE
- 目标模块: $MODULE_FILE

## 任务
1. 读取 iteration 文件的核心内容
2. 读取目标模块文件（如果存在）
3. 将 iteration 内容合并到模块文件
4. 避免重复内容

## 输出要求
- 只输出变更摘要（不超过 200 字）
- 不要解释过程
- 不要生成冗长的说明

## 变更摘要格式
- 新增: XXX
- 优化: XXX
- 影响: XXX

开始执行。
EOF

log "✅ 提示词已生成: $PROMPT_FILE"
log ""
log "📋 提示词内容:"
cat "$PROMPT_FILE"
log ""
log "🚀 执行命令:"
log "   claude < $PROMPT_FILE"
log ""
log "或者手动复制提示词到 Claude Code"
