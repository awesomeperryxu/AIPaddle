#!/bin/bash

# Dify 文档自动同步脚本
# 将 dify-analysis 的文档同步到 GitHub 仓库

REPO_DIR="$HOME/github/v0-ai-llmops-prototype"
SOURCE_DIR="$HOME/hermes-wechat/dify-analysis"
TARGET_DIR="$REPO_DIR/docs"
LOG_FILE="$REPO_DIR/sync-docs.log"

echo "========================================" >> "$LOG_FILE"
echo "同步开始: $(date)" >> "$LOG_FILE"

cd "$REPO_DIR" || exit 1

# 拉取最新代码
echo "拉取最新代码..." >> "$LOG_FILE"
git pull origin main >> "$LOG_FILE" 2>&1

# 同步文档
echo "同步文档..." >> "$LOG_FILE"

# 创建目标目录
mkdir -p "$TARGET_DIR/dify-analysis"

# 复制核心文档
cp "$SOURCE_DIR/Dify-PRD-Complete.md" "$TARGET_DIR/dify-analysis/" 2>> "$LOG_FILE"
cp "$SOURCE_DIR/Dify-v0dev-Prompts-Updated.md" "$TARGET_DIR/dify-analysis/" 2>> "$LOG_FILE"
cp "$SOURCE_DIR/FINAL_COMPLETE_REPORT.md" "$TARGET_DIR/dify-analysis/" 2>> "$LOG_FILE"
cp "$SOURCE_DIR/SCREENSHOTS_INVENTORY.md" "$TARGET_DIR/dify-analysis/" 2>> "$LOG_FILE"
cp "$SOURCE_DIR/QUICK_START.md" "$TARGET_DIR/dify-analysis/" 2>> "$LOG_FILE"

# 复制截图（选择性复制，避免文件过大）
mkdir -p "$TARGET_DIR/dify-analysis/screenshots"
cp "$SOURCE_DIR/screenshots-complete/"*.png "$TARGET_DIR/dify-analysis/screenshots/" 2>> "$LOG_FILE" || echo "截图复制失败或不存在" >> "$LOG_FILE"

# 检查是否有变更
if [[ -n $(git status -s) ]]; then
    echo "发现变更，提交到 Git..." >> "$LOG_FILE"
    
    # 添加所有变更
    git add docs/
    
    # 提交
    git commit -m "docs: 自动同步 Dify 分析文档 - $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE" 2>&1
    
    # 推送到远程
    git push origin main >> "$LOG_FILE" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ 同步成功！" >> "$LOG_FILE"
    else
        echo "❌ 推送失败！" >> "$LOG_FILE"
    fi
else
    echo "ℹ️  没有变更，跳过提交" >> "$LOG_FILE"
fi

echo "同步完成: $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
