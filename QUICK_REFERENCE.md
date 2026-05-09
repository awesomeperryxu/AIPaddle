# PRD 迭代快速参考

## 🚀 一键更新（推荐）

```bash
# 1. 创建 iteration 文件
vim docs/requirements/iteration/PRD_<module>_$(date +%Y%m%d).md

# 2. 运行快速更新
./quick-update.sh <module>

# 3. 执行生成的提示词（复制到 Claude Code）

# 4. 提交
git add docs/requirements/modules/ && git commit -m "feat: 更新 <module>" && git push
```

## 📝 简洁提示词模板

```
读取 docs/requirements/iteration/PRD_<module>_YYYYMMDD.md
更新 docs/requirements/modules/<module>.md
只输出变更摘要，不超过 200 字
```

## 📂 文件位置

| 类型 | 位置 |
|------|------|
| Iteration 文件 | `docs/requirements/iteration/PRD_<module>_YYYYMMDD.md` |
| 模块文件 | `docs/requirements/modules/<module>.md` |
| 索引文件 | `docs/requirements/PRD_Core_v1.03_index.md` |

## 🎯 关键原则

1. ✅ 只读取必要文件（模块文件 3KB vs 完整文档 29KB）
2. ✅ 要求简洁输出（"只输出摘要，不超过 200 字"）
3. ✅ 增量更新（只更新变更部分）
4. ✅ 使用脚本（./quick-update.sh）

## 📊 效果

- Token: 80,000 → 15,000 (⬇️ 81%)
- 时间: 15 分钟 → 3 分钟 (⬇️ 80%)

## 📖 详细文档

- [快速开始](README_OPTIMIZATION.md)
- [工作流指南](docs/WORKFLOW_GUIDE.md)
- [优化详解](docs/OPTIMIZATION_GUIDE.md)

---

**版本**: 2.0 | **更新**: 2026-05-09
