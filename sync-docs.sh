#!/bin/bash

# v0-ai-llmops-prototype 文档自动同步脚本
# 同步本地 docs 文件夹到 GitHub

REPO_DIR="$HOME/github/v0-ai-llmops-prototype"
LOG_FILE="$REPO_DIR/sync-docs.log"

echo "========================================" >> "$LOG_FILE"
echo "同步开始: $(date)" >> "$LOG_FILE"

# 等待网络就绪（最多等 60 秒）
echo "检查网络连接..." >> "$LOG_FILE"
for i in $(seq 1 12); do
    if ping -c 1 -W 3 github.com &>/dev/null 2>&1; then
        echo "✅ 网络就绪" >> "$LOG_FILE"
        break
    fi
    if [ $i -eq 12 ]; then
        echo "❌ 网络不可用，跳过本次同步" >> "$LOG_FILE"
        echo "同步完成: $(date)" >> "$LOG_FILE"
        echo "" >> "$LOG_FILE"
        exit 0
    fi
    echo "等待网络... ($((i*5))s)" >> "$LOG_FILE"
    sleep 5
done

cd "$REPO_DIR" || exit 1

# 拉取最新代码
echo "拉取最新代码..." >> "$LOG_FILE"
git pull origin main >> "$LOG_FILE" 2>&1

# 添加 docs 文件夹的所有变更
echo "检查 docs 文件夹变更..." >> "$LOG_FILE"
git add docs/

# 检查是否有变更
if [[ -n $(git status -s docs/) ]]; then
    echo "发现变更，提交到 Git..." >> "$LOG_FILE"
    
    # 提交
    git commit -m "docs: 自动同步文档 - $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE" 2>&1
    
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
