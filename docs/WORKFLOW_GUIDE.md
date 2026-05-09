# PRD 迭代工作流指南

## 🎯 优化后的工作流

### 旧流程 vs 新流程

| 步骤 | 旧流程 | 新流程 | 节省 |
|------|--------|--------|------|
| 1. 创建 iteration 文件 | 手动创建 | 手动创建 | - |
| 2. 读取完整 PRD | 读取 29KB | 读取 3-5KB | ⬇️ 85% |
| 3. 查找插入位置 | 多次 grep | 自动定位 | ⬇️ 90% |
| 4. 更新文档 | 复制+编辑 | 增量合并 | ⬇️ 80% |
| 5. 生成日志 | 手动编写 | 自动生成 | ⬇️ 95% |
| 6. Git 提交 | 手动提交 | 一键提交 | ⬇️ 50% |
| **总计** | **~15 分钟** | **~3 分钟** | **⬇️ 80%** |

---

## 📝 新的迭代流程

### 方式 1：使用快速更新脚本（推荐）

```bash
# 1. 创建 iteration 文件
# docs/requirements/iteration/PRD_<module>_YYYYMMDD.md

# 2. 运行快速更新脚本
./quick-update.sh tenant-management

# 3. 脚本会生成 Claude 提示词，复制并执行
# 提示词会告诉 Claude：
# - 只读取必要文件
# - 增量更新
# - 简洁输出

# 4. 验证更新
git diff docs/requirements/modules/

# 5. 提交
git add docs/requirements/modules/
git commit -m "feat: 更新 <module> 模块"
git push
```

### 方式 2：手动使用简洁提示词

```
读取 docs/requirements/iteration/PRD_tenant-management_20260509.md
更新 docs/requirements/modules/2.9_tenant_management.md
只输出变更摘要，不超过 200 字
```

### 方式 3：使用完整自动化脚本

```bash
# 自动检测所有今日 iteration 文件并更新
./sync-prd-v2.sh

# 自动生成索引文件
# 自动生成 CHANGELOG
# 自动提交到 Git（可选）
```

---

## 📂 文件结构

```
docs/
├── requirements/
│   ├── PRD_Core_v1.03.md              # 完整文档（保留）
│   ├── PRD_Core_v1.03_index.md        # 索引文档（新）
│   ├── UI_Design_Spec_v1.03.md        # 完整文档（保留）
│   ├── modules/                        # 模块文件夹（新）
│   │   ├── 2.9_tenant_management.md
│   │   └── 2.10_tenant_internal_management.md
│   ├── ui-pages/                       # UI 页面文件夹（新）
│   │   ├── tenant_list.md
│   │   ├── tenant_detail.md
│   │   └── quota_management.md
│   └── iteration/                      # 迭代文件夹
│       ├── PRD_tenant-management_20260509.md
│       └── UI_tenant-management_20260509.md
├── changelogs/
│   ├── CHANGELOG_20260509.md
│   └── RELEASE_v1.04_20260509.md
└── templates/
    └── prd_update_template.md

scripts/
├── sync-prd-v2.sh                     # 完整自动化脚本
├── quick-update.sh                    # 快速更新脚本（推荐）
└── auto-update-prd.sh                 # 批量生成提示词
```

---

## 🎓 最佳实践

### 1. 创建 iteration 文件时

**保持简洁**：
```markdown
# ✅ 好的 iteration 文件
## 核心变更
- 新增功能 A
- 优化功能 B

## 数据模型
- 新增字段 X, Y, Z

## API 接口
- POST /api/xxx
```

**避免冗长**：
```markdown
# ❌ 不好的 iteration 文件
## 背景
在经过深入的用户调研和需求分析后，我们发现...
（500 字背景说明）

## 详细设计
首先，我们需要考虑...
（1000 字设计说明）
```

### 2. 与 Claude 交互时

**使用简洁提示词**：
```
✅ 读取 iteration/PRD_xxx.md，更新 modules/xxx.md，只输出摘要
❌ 请帮我详细分析这个文件，然后找到合适的位置...
```

**明确要求**：
```
✅ 不要解释过程，不要生成冗长说明
❌ （不说明，Claude 可能生成大量解释文字）
```

### 3. 文件命名规范

**Iteration 文件**：
```
PRD_<module-name>_YYYYMMDD.md
UI_<page-name>_YYYYMMDD.md

示例：
PRD_tenant-management_20260509.md
UI_tenant-detail-page_20260509.md
```

**模块文件**：
```
<section>_<module-name>.md

示例：
2.9_tenant_management.md
2.10_tenant_internal_management.md
```

---

## 🔧 常见问题

### Q1: 如何处理跨模块的变更？

**A**: 创建多个 iteration 文件，分别更新各模块

```bash
# 创建
docs/requirements/iteration/PRD_module-a_20260509.md
docs/requirements/iteration/PRD_module-b_20260509.md

# 更新
./quick-update.sh module-a
./quick-update.sh module-b
```

### Q2: 如何回滚到旧版本？

**A**: 使用 Git 回滚

```bash
# 查看历史
git log docs/requirements/modules/2.9_tenant_management.md

# 回滚到指定版本
git checkout <commit-hash> docs/requirements/modules/2.9_tenant_management.md
```

### Q3: 完整文档和模块文档如何同步？

**A**: 两种方式

**方式 1**：只维护模块文档，完整文档作为归档
```bash
# 模块文档是主文档
# 完整文档保留但不再更新
```

**方式 2**：定期合并模块到完整文档
```bash
# 使用脚本合并
cat docs/requirements/modules/*.md > docs/requirements/PRD_Core_v1.04.md
```

### Q4: Token 消耗还是很高怎么办？

**A**: 检查以下几点

1. **是否读取了完整文档？**
   ```bash
   # ❌ 不要这样
   读取 PRD_Core_v1.03.md（29KB）
   
   # ✅ 应该这样
   读取 modules/2.9_tenant_management.md（3KB）
   ```

2. **是否要求简洁输出？**
   ```bash
   # ✅ 明确要求
   "只输出变更摘要，不超过 200 字"
   ```

3. **是否使用了模板？**
   ```bash
   # ✅ 使用模板
   ./quick-update.sh <module>
   ```

---

## 📊 效果验证

### 验证 Token 消耗

**旧流程**：
```
读取 PRD_Core_v1.03.md: ~20,000 tokens
读取 UI_Design_Spec_v1.03.md: ~35,000 tokens
生成内容: ~10,000 tokens
编辑操作: ~8,000 tokens
其他: ~7,000 tokens
总计: ~80,000 tokens
```

**新流程**：
```
读取 iteration 文件: ~3,000 tokens
读取模块文件: ~2,000 tokens
生成内容: ~5,000 tokens
编辑操作: ~3,000 tokens
其他: ~2,000 tokens
总计: ~15,000 tokens
```

**节省**: 65,000 tokens (81%)

### 验证执行时间

```bash
# 旧流程
time (读取大文档 + 多次编辑 + 手动操作)
# 结果: ~15 分钟

# 新流程
time ./quick-update.sh tenant-management
# 结果: ~3 分钟
```

**节省**: 12 分钟 (80%)

---

## 🚀 下一步

1. **立即开始使用**
   ```bash
   # 下次迭代时使用新流程
   ./quick-update.sh <module>
   ```

2. **逐步迁移**
   ```bash
   # 将其他模块也拆分出来
   # 2.1, 2.2, 2.3 等
   ```

3. **完全自动化**
   ```bash
   # 配置 Git hook
   # 自动触发 sync-prd-v2.sh
   ```

---

## 📞 支持

如有问题，请查看：
- [优化指南](../OPTIMIZATION_GUIDE.md)
- [PRD 同步指南](../PRD_SYNC_GUIDE.md)

---

*最后更新: 2026-05-09*
