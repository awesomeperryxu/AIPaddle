# PRD 同步流程使用说明

## 📖 概述

本文档说明如何使用 `sync-prd.sh` 脚本自动化 PRD 文档的版本管理和同步流程。

## 🚀 快速开始

### 方式一：直接运行脚本
```bash
cd ~/github/v0-ai-llmops-prototype
./sync-prd.sh
```

### 方式二：使用命令别名
```bash
同步PRD
# 或
sync-prd
```

## 📋 工作流程

### 1. 创建 Iteration 文件

在 `docs/requirements/iteration/` 文件夹中创建今天的迭代文件：

**命名格式**: `PRD_<模块名>_YYYYMMDD.md`

**示例**: `PRD_saas-tenant-management_20260508.md`

### 2. 运行同步脚本

```bash
同步PRD
```

脚本会自动：
- ✅ 检测今天的 iteration 文件
- ✅ 读取当前 PRD 和 UI Design 版本号
- ✅ 自动递增版本号（v1.0 → v1.01 → v1.02）
- ✅ 生成变更日志（CHANGELOG）
- ✅ 生成发布日志（RELEASE）
- ✅ 生成 Claude 提示词文件

### 3. 执行文档更新

脚本会生成 Claude 提示词文件，包含完整的更新指令。

**自动执行**（推荐）:
- Claude Code 会自动读取提示词并执行更新

**手动执行**:
```bash
cat docs/changelogs/claude_prompt_YYYYMMDD.txt
```

### 4. 同步到 GitHub

文档更新完成后，运行：
```bash
./sync-docs.sh
```

或等待每天 8:00 AM 的自动同步。

## 📁 生成的文件

每次运行 `sync-prd.sh` 会生成以下文件：

```
docs/
├── changelogs/
│   ├── CHANGELOG_YYYYMMDD.md          # 变更日志
│   ├── RELEASE_vX.XX_YYYYMMDD.md      # 发布日志
│   └── claude_prompt_YYYYMMDD.txt     # Claude 提示词
├── requirements/
│   ├── PRD_Core_vX.XX.md              # 新版本 PRD
│   ├── UI_Design_Spec_vX.XX.md        # 新版本 UI Design
│   └── iteration/
│       └── PRD_<模块名>_YYYYMMDD.md   # 迭代文件
```

## 🔄 版本号规则

- **初始版本**: v1.0
- **第一次更新**: v1.01
- **第二次更新**: v1.02
- **第十次更新**: v1.10
- **第十一次更新**: v1.11

版本号自动递增，无需手动管理。

## 📝 变更日志内容

### CHANGELOG
- 版本信息
- 迭代文件清单
- 变更内容（新增功能、功能优化、UI 变更）
- 影响范围
- 下一步行动

### RELEASE
- 发布概要
- 核心更新
- 迭代文件清单
- 变更类型
- 影响评估
- 验收标准

## ⚙️ 配置

### 修改脚本路径

编辑 `/usr/local/bin/同步PRD`:
```bash
#!/bin/bash
~/github/v0-ai-llmops-prototype/sync-prd.sh "$@"
```

### 自定义日志位置

编辑 `sync-prd.sh`:
```bash
LOG_FILE="$REPO_DIR/sync-prd.log"
```

## 🐛 故障排查

### 问题：未找到今天的 iteration 文件

**原因**: 没有创建今天日期的 iteration 文件

**解决**: 
```bash
cd ~/github/v0-ai-llmops-prototype/docs/requirements/iteration
touch PRD_<模块名>_$(date +%Y%m%d).md
```

### 问题：版本号没有递增

**原因**: 文件名格式不正确

**解决**: 确保文件名格式为 `PRD_Core_vX.XX.md`

### 问题：GitHub 同步失败

**原因**: 网络问题或权限问题

**解决**: 
```bash
cd ~/github/v0-ai-llmops-prototype
git status
git pull origin main
```

## 📊 示例

### 完整流程示例

```bash
# 1. 创建今天的 iteration 文件
cd ~/github/v0-ai-llmops-prototype/docs/requirements/iteration
vim PRD_user-management_20260508.md

# 2. 运行 PRD 同步
同步PRD

# 3. 查看生成的提示词
cat docs/changelogs/claude_prompt_20260508.txt

# 4. Claude Code 自动执行更新（或手动执行）

# 5. 同步到 GitHub
./sync-docs.sh

# 6. 验证
git log -1
```

## 🎯 最佳实践

1. **每日一次**: 建议每天只运行一次 PRD 同步
2. **原子更新**: 每个 iteration 文件专注于一个模块
3. **清晰命名**: 使用描述性的模块名称
4. **及时同步**: 更新完成后立即同步到 GitHub
5. **版本追踪**: 保留所有历史版本文件

## 📞 支持

如有问题，请查看日志文件：
```bash
tail -f ~/github/v0-ai-llmops-prototype/sync-prd.log
```

---

**最后更新**: 2026-05-08  
**版本**: 1.0
