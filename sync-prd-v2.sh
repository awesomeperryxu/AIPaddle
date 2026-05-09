#!/bin/bash

# PRD 同步脚本 v2.0 - 优化版
# 功能：自动检测 iteration 文件，增量更新 PRD 和 UI 文档

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} ⚠️  $1"; }
log_error() { echo -e "${RED}[$(date '+%H:%M:%S')]${NC} ❌ $1"; }

# 配置
PROJECT_ROOT="/Users/perryxu/github/v0-ai-llmops-prototype"
ITERATION_DIR="$PROJECT_ROOT/docs/requirements/iteration"
MODULES_DIR="$PROJECT_ROOT/docs/requirements/modules"
CHANGELOG_DIR="$PROJECT_ROOT/docs/changelogs"

# 创建模块目录
mkdir -p "$MODULES_DIR"

# 版本递增函数
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
        echo "1.01"
    fi
}

# 提取模块名称（从文件名）
extract_module_name() {
    local filename=$(basename "$1")
    # PRD_tenant-management-enhancement_20260508.md -> tenant-management-enhancement
    echo "$filename" | sed -E 's/^(PRD_|UI_)(.+)_[0-9]{8}\.md$/\2/'
}

# 查找目标模块文件
find_module_file() {
    local module_name=$1
    local module_type=$2  # PRD 或 UI

    # 尝试多种匹配模式
    local patterns=(
        "${module_name}.md"
        "*${module_name}*.md"
        "2.*_${module_name}.md"
    )

    for pattern in "${patterns[@]}"; do
        local found=$(find "$MODULES_DIR" -name "$pattern" -type f | head -1)
        if [ -n "$found" ]; then
            echo "$found"
            return 0
        fi
    done

    # 如果找不到，创建新模块文件
    local new_file="$MODULES_DIR/${module_name}.md"
    log_info "创建新模块文件: $new_file"
    echo "# ${module_name}" > "$new_file"
    echo "$new_file"
}

# 智能合并内容
merge_content() {
    local iteration_file=$1
    local target_file=$2

    log_info "合并内容: $(basename $iteration_file) -> $(basename $target_file)"

    # 提取 iteration 文件的主要内容（跳过元数据）
    local content=$(sed -n '/^## /,$p' "$iteration_file")

    # 检查目标文件是否已包含此内容
    if grep -q "$(head -1 <<< "$content")" "$target_file" 2>/dev/null; then
        log_warn "内容已存在，跳过合并"
        return 0
    fi

    # 追加内容
    echo "" >> "$target_file"
    echo "---" >> "$target_file"
    echo "" >> "$target_file"
    echo "$content" >> "$target_file"

    log_info "✅ 合并完成"
}

# 生成索引文件
generate_index() {
    local doc_type=$1  # PRD 或 UI
    local version=$2
    local index_file="$PROJECT_ROOT/docs/requirements/${doc_type}_Core_v${version}.md"

    log_info "生成索引文件: $(basename $index_file)"

    cat > "$index_file" << EOF
# AI LLMOps 平台 ${doc_type} 文档

**文档版本**: ${version}
**创建日期**: $(date '+%Y-%m-%d')
**文档类型**: ${doc_type} 索引文档

---

## 📚 模块列表

EOF

    # 列出所有模块
    for module in $(ls "$MODULES_DIR"/*.md 2>/dev/null | sort); do
        local module_name=$(basename "$module" .md)
        echo "- [${module_name}](./modules/${module_name}.md)" >> "$index_file"
    done

    log_info "✅ 索引文件生成完成"
}

# 主流程
main() {
    log_info "🚀 PRD 同步流程启动 (v2.0 优化版)"

    # 查找今日 iteration 文件
    local today=$(date '+%Y%m%d')
    local iteration_files=$(find "$ITERATION_DIR" -name "*_${today}.md" -type f)

    if [ -z "$iteration_files" ]; then
        log_warn "未找到今日 iteration 文件"
        exit 0
    fi

    log_info "找到 $(echo "$iteration_files" | wc -l) 个 iteration 文件"

    # 获取当前版本
    local current_version=$(ls "$PROJECT_ROOT/docs/requirements/PRD_Core_v"*.md 2>/dev/null | \
        sort -V | tail -1 | sed -E 's/.*v([0-9]+\.[0-9]+)\.md$/\1/')

    if [ -z "$current_version" ]; then
        current_version="1.0"
    fi

    local new_version=$(increment_version "$current_version")
    log_info "版本递增: v${current_version} → v${new_version}"

    # 处理每个 iteration 文件
    while IFS= read -r iter_file; do
        local module_name=$(extract_module_name "$iter_file")
        log_info "处理模块: $module_name"

        # 查找或创建目标模块文件
        local target_file=$(find_module_file "$module_name" "PRD")

        # 合并内容
        merge_content "$iter_file" "$target_file"

    done <<< "$iteration_files"

    # 生成索引文件
    generate_index "PRD" "$new_version"
    generate_index "UI_Design_Spec" "$new_version"

    # 生成变更日志（简化版）
    local changelog_file="$CHANGELOG_DIR/CHANGELOG_${today}.md"
    cat > "$changelog_file" << EOF
# 变更日志 - $(date '+%Y-%m-%d')

## 版本信息
- **版本**: v${current_version} → v${new_version}
- **更新时间**: $(date '+%Y-%m-%d %H:%M:%S')

## 更新模块
EOF

    while IFS= read -r iter_file; do
        local module_name=$(extract_module_name "$iter_file")
        echo "- ${module_name}" >> "$changelog_file"
    done <<< "$iteration_files"

    log_info "✅ 同步完成！"
    log_info "📁 新版本: v${new_version}"
    log_info "📝 变更日志: $changelog_file"
}

main "$@"
