#!/bin/bash

# PRD 自动同步脚本
# 用法: ./sync-prd.sh 或输入命令 "同步PRD"
# 功能：
#   1. 检测 iteration 文件夹中今日的更新文件
#   2. 分析需要更新的内容
#   3. 自动递增版本号
#   4. 生成变更日志
#   5. 调用 Claude Code 更新 PRD 和 UI Design 文档

set -e

REPO_DIR="$HOME/github/v0-ai-llmops-prototype"
DOCS_DIR="$REPO_DIR/docs"
REQ_DIR="$DOCS_DIR/requirements"
ITER_DIR="$REQ_DIR/iteration"
CHANGELOG_DIR="$DOCS_DIR/changelogs"
LOG_FILE="$REPO_DIR/sync-prd.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[ERROR] $1" >> "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    echo "[WARN] $1" >> "$LOG_FILE"
}

# 获取今天的日期（格式：YYYYMMDD）
TODAY=$(date '+%Y%m%d')

echo "========================================"
log "🚀 PRD 同步流程启动"
log "📅 查找日期: $TODAY"

cd "$REPO_DIR" || { error "无法进入仓库目录"; exit 1; }

# 创建必要的文件夹
mkdir -p "$CHANGELOG_DIR"

# 1. 查找今天的 iteration 文件
log "🔍 查找今日 iteration 文件..."
ITER_FILES=$(find "$ITER_DIR" -type f -name "*_${TODAY}.md" 2>/dev/null)

if [ -z "$ITER_FILES" ]; then
    warn "未找到今天的 iteration 文件 (*_${TODAY}.md)"
    log "💡 请在 $ITER_DIR 创建格式为 PRD_<模块名>_${TODAY}.md 的文件"
    exit 0
fi

log "✅ 找到 iteration 文件:"
echo "$ITER_FILES" | while read -r file; do
    log "   - $(basename "$file")"
done

# 2. 读取当前版本号
log "📖 读取当前文档版本..."
PRD_FILE=$(find "$REQ_DIR" -maxdepth 1 -name "PRD_Core_v*.md" | sort -V | tail -1)
UI_FILE=$(find "$REQ_DIR" -maxdepth 1 -name "UI_Design_Spec_v*.md" | sort -V | tail -1)

if [ -z "$PRD_FILE" ] || [ -z "$UI_FILE" ]; then
    error "未找到 PRD 或 UI Design 文件"
    exit 1
fi

PRD_VERSION=$(basename "$PRD_FILE" .md | sed 's/PRD_Core_v//')
UI_VERSION=$(basename "$UI_FILE" .md | sed 's/UI_Design_Spec_v//')

log "   当前 PRD 版本: v${PRD_VERSION}"
log "   当前 UI 版本: v${UI_VERSION}"

# 3. 版本号递增
increment_version() {
    local version=$1
    if [[ $version =~ ^([0-9]+)\.([0-9]+)$ ]]; then
        major="${BASH_REMATCH[1]}"
        minor="${BASH_REMATCH[2]}"

        if [ ${#minor} -eq 1 ]; then
            new_minor="01"
        else
            new_minor=$(printf "%02d" $((10#$minor + 1)))
        fi

        echo "${major}.${new_minor}"
    else
        echo "$version"
    fi
}

NEW_PRD_VERSION=$(increment_version "$PRD_VERSION")
NEW_UI_VERSION=$(increment_version "$UI_VERSION")

log "🔄 版本递增:"
log "   PRD: v${PRD_VERSION} → v${NEW_PRD_VERSION}"
log "   UI:  v${UI_VERSION} → v${NEW_UI_VERSION}"

# 4. 生成变更日志
CHANGELOG_FILE="$CHANGELOG_DIR/CHANGELOG_${TODAY}.md"
RELEASE_FILE="$CHANGELOG_DIR/RELEASE_v${NEW_PRD_VERSION}_${TODAY}.md"

log "📝 生成变更日志..."

# 创建 CHANGELOG
cat > "$CHANGELOG_FILE" << EOF
# 变更日志 - $(date '+%Y-%m-%d')

## 版本信息
- **PRD 版本**: v${PRD_VERSION} → v${NEW_PRD_VERSION}
- **UI Design 版本**: v${UI_VERSION} → v${NEW_UI_VERSION}
- **更新时间**: $(date '+%Y-%m-%d %H:%M:%S')

## 本次迭代文件
EOF

echo "$ITER_FILES" | while read -r file; do
    echo "- \`$(basename "$file")\`" >> "$CHANGELOG_FILE"
done

cat >> "$CHANGELOG_FILE" << EOF

## 变更内容

### 新增功能
- 待 Claude Code 分析后自动填充

### 功能优化
- 待 Claude Code 分析后自动填充

### UI 变更
- 待 Claude Code 分析后自动填充

## 影响范围
- 待分析

## 下一步行动
- [ ] 更新 PRD_Core 文档
- [ ] 更新 UI_Design_Spec 文档
- [ ] 同步到 GitHub
- [ ] 通知相关团队

---
*本日志由 sync-prd.sh 自动生成*
EOF

log "✅ 变更日志已创建: $(basename "$CHANGELOG_FILE")"

# 5. 创建发布日志模板
cat > "$RELEASE_FILE" << EOF
# Release Notes - v${NEW_PRD_VERSION}

**发布日期**: $(date '+%Y-%m-%d')
**版本**: v${NEW_PRD_VERSION}

## 📋 本次发布概要

基于 iteration 文件更新，本次发布包含以下模块的功能迭代和优化。

## 🎯 核心更新

### PRD 文档更新
- 版本: v${PRD_VERSION} → v${NEW_PRD_VERSION}
- 更新内容: 待 Claude Code 分析

### UI Design 文档更新
- 版本: v${UI_VERSION} → v${NEW_UI_VERSION}
- 更新内容: 待 Claude Code 分析

## 📦 迭代文件清单

EOF

echo "$ITER_FILES" | while read -r file; do
    filename=$(basename "$file")
    echo "### \`$filename\`" >> "$RELEASE_FILE"
    echo "" >> "$RELEASE_FILE"
    echo "**模块**: $(echo "$filename" | sed 's/PRD_//' | sed 's/_[0-9]*.md//')" >> "$RELEASE_FILE"
    echo "" >> "$RELEASE_FILE"
done

cat >> "$RELEASE_FILE" << EOF

## 🔄 变更类型

- [ ] 新增功能
- [ ] 功能优化
- [ ] UI/UX 改进
- [ ] 架构调整
- [ ] 安全增强
- [ ] 性能优化

## 📊 影响评估

- **影响范围**: 待评估
- **兼容性**: 待评估
- **风险等级**: 待评估

## ✅ 验收标准

- [ ] PRD 文档已更新
- [ ] UI Design 文档已更新
- [ ] 变更日志已记录
- [ ] 文档已同步到 GitHub
- [ ] 相关团队已通知

---
*本发布日志由 sync-prd.sh 自动生成*
EOF

log "✅ 发布日志已创建: $(basename "$RELEASE_FILE")"

# 6. 生成 Claude Code 提示词文件
PROMPT_FILE="$CHANGELOG_DIR/claude_prompt_${TODAY}.txt"

cat > "$PROMPT_FILE" << EOF
请根据以下 iteration 文件更新 PRD 和 UI Design 文档：

## Iteration 文件路径
EOF

echo "$ITER_FILES" | while read -r file; do
    echo "- $file" >> "$PROMPT_FILE"
done

cat >> "$PROMPT_FILE" << EOF

## 当前文档
- PRD: $PRD_FILE (v${PRD_VERSION})
- UI Design: $UI_FILE (v${UI_VERSION})

## 目标
1. 分析 iteration 文件中的新增内容
2. 将相关内容合并到 PRD_Core 文档中
3. 更新 UI_Design_Spec 文档（如有 UI 相关变更）
4. 创建新版本文档：
   - PRD_Core_v${NEW_PRD_VERSION}.md
   - UI_Design_Spec_v${NEW_UI_VERSION}.md
5. 更新变更日志：
   - $CHANGELOG_FILE
   - $RELEASE_FILE

## 要求
- 保持文档结构一致
- 新增内容需要标注版本号
- 更新目录索引
- 补充变更日志中的"待分析"部分
- 确保 v0.dev 提示词的可用性

请开始执行。
EOF

log "✅ Claude 提示词已生成: $(basename "$PROMPT_FILE")"

# 7. 输出总结
echo ""
echo "========================================"
log "✨ PRD 同步准备完成！"
echo ""
log "📁 生成的文件:"
log "   1. 变更日志: $CHANGELOG_FILE"
log "   2. 发布日志: $RELEASE_FILE"
log "   3. Claude 提示词: $PROMPT_FILE"
echo ""
log "📋 下一步操作:"
log "   1. 查看提示词文件: cat $PROMPT_FILE"
log "   2. 在 Claude Code 中执行提示词内容"
log "   3. 或直接运行: claude < $PROMPT_FILE"
echo ""
log "🎯 目标版本:"
log "   - PRD_Core_v${NEW_PRD_VERSION}.md"
log "   - UI_Design_Spec_v${NEW_UI_VERSION}.md"
echo "========================================"
echo ""

# 自动打开提示词文件（可选）
if command -v cat &> /dev/null; then
    echo ""
    log "📄 Claude 提示词内容:"
    echo "----------------------------------------"
    cat "$PROMPT_FILE"
    echo "----------------------------------------"
fi

log "✅ 同步流程完成: $(date)"

