#!/bin/bash

# 自动化 PRD 更新工作流
# 使用 Claude Code API 进行增量更新

set -e

PROJECT_ROOT="/Users/perryxu/github/v0-ai-llmops-prototype"
ITERATION_DIR="$PROJECT_ROOT/docs/requirements/iteration"
MODULES_DIR="$PROJECT_ROOT/docs/requirements/modules"
TEMPLATE_FILE="$PROJECT_ROOT/docs/templates/prd_update_template.md"

# 查找今日 iteration 文件
today=$(date '+%Y%m%d')
iteration_files=$(find "$ITERATION_DIR" -name "*_${today}.md" -type f)

if [ -z "$iteration_files" ]; then
    echo "未找到今日 iteration 文件"
    exit 0
fi

# 获取当前版本
current_version=$(ls "$PROJECT_ROOT/docs/requirements/PRD_Core_v"*.md 2>/dev/null | \
    sort -V | tail -1 | sed -E 's/.*v([0-9]+\.[0-9]+)\.md$/\1/')

# 计算新版本
if [[ $current_version =~ ^([0-9]+)\.([0-9]+)$ ]]; then
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    new_minor=$(printf "%02d" $((10#$minor + 1)))
    new_version="${major}.${new_minor}"
else
    new_version="1.01"
fi

echo "版本: v${current_version} → v${new_version}"

# 处理每个 iteration 文件
while IFS= read -r iter_file; do
    module_name=$(basename "$iter_file" | sed -E 's/^(PRD_|UI_)(.+)_[0-9]{8}\.md$/\2/')

    echo "处理模块: $module_name"

    # 生成 Claude 提示词
    prompt=$(cat "$TEMPLATE_FILE" | \
        sed "s|{iteration_file_path}|$iter_file|g" | \
        sed "s|{module_name}|$module_name|g" | \
        sed "s|{current_version}|$current_version|g" | \
        sed "s|{new_version}|$new_version|g")

    # 保存提示词到临时文件
    echo "$prompt" > /tmp/claude_prompt_${module_name}.txt

    echo "✅ 提示词已生成: /tmp/claude_prompt_${module_name}.txt"
    echo "   执行: claude < /tmp/claude_prompt_${module_name}.txt"

done <<< "$iteration_files"

echo ""
echo "🎯 下一步："
echo "1. 逐个执行上述 Claude 命令"
echo "2. 或使用 Claude Code 手动执行提示词"
echo "3. 验证更新结果"
echo "4. 提交到 Git"
