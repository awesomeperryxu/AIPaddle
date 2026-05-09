# AI LLMOps 平台产品需求文档 (PRD)

**项目名称**: v0-ai-llmops-prototype  
**文档版本**: 1.03  
**创建日期**: 2026-05-07  
**更新日期**: 2026-05-09  
**文档类型**: 产品需求文档（索引）  
**基于**: 已开发的前端功能分析

**版本变更**:
- v1.01 (2026-05-08): 新增租户管理模块（2.9）
- v1.02 (2026-05-08): 新增租户内部管理模块（2.10）
- v1.03 (2026-05-08): 增强租户管理模块（2.9），完善开通企业流程、多级页面结构、配额管理、账单管理等功能

---

## 📚 文档说明

本文档采用**模块化结构**，每个功能模块独立维护，便于：
- 快速定位和更新
- 减少文档冲突
- 提高协作效率
- 降低维护成本

---

## 📋 核心模块列表

### 基础功能模块

- [2.1 监控面板 (Dashboard)](./PRD_Core_v1.03.md#21-监控面板-dashboard)
- [2.2 Agent 管理模块](./PRD_Core_v1.03.md#22-agent-管理模块)
- [2.3 Skill Hub 模块](./PRD_Core_v1.03.md#23-skill-hub-模块)
- [2.4 知识库模块](./PRD_Core_v1.03.md#24-知识库模块)
- [2.5 工作流管理模块](./PRD_Core_v1.03.md#25-工作流管理模块)
- [2.6 个人助理模块](./PRD_Core_v1.03.md#26-个人助理模块)
- [2.7 安全管理模块](./PRD_Core_v1.03.md#27-安全管理模块)
- [2.8 成员管理模块](./PRD_Core_v1.03.md#28-成员管理模块)

### SaaS 租户管理模块（独立文档）

- **[2.9 租户管理模块 (SaaS)](./modules/2.9_tenant_management.md)** ⭐
  - 企业租户管理
  - LLM 模型管理
  - Token 用量与计费
  - MCP 管理中心
  - 组织初始化
  - 安全与审计
  - **租户管理页面增强 (v1.03)** 🆕
    - 开通企业功能增强
    - 企业列表操作增强
    - 多级页面体系（10 个页面）
    - 配额管理功能
    - 账单管理功能

- **[2.10 租户内部管理模块](./modules/2.10_tenant_internal_management.md)** ⭐
  - 组织架构管理
  - 人员管理
  - 角色权限管理
  - 访问控制与安全
  - 资源配额管理
  - 审计日志

---

## 🔄 迭代文件

最新迭代内容请查看：
- [iteration 文件夹](./iteration/)

---

## 📖 使用说明

### 查看完整文档
```bash
# 查看完整 PRD（包含所有模块）
cat docs/requirements/PRD_Core_v1.03.md

# 查看特定模块
cat docs/requirements/modules/2.9_tenant_management.md
```

### 更新文档
```bash
# 1. 创建 iteration 文件
# docs/requirements/iteration/PRD_<module>_YYYYMMDD.md

# 2. 运行同步脚本
./sync-prd-v2.sh

# 3. 验证更新
git diff docs/requirements/modules/
```

---

## 📊 文档统计

- **总模块数**: 10 个
- **独立模块文档**: 2 个（2.9, 2.10）
- **当前版本**: v1.03
- **最后更新**: 2026-05-09

---

## 🔗 相关文档

- [UI 设计规范](./UI_Design_Spec_v1.03.md)
- [变更日志](../changelogs/CHANGELOG_20260508.md)
- [发布日志](../changelogs/RELEASE_v1.03_20260508.md)
- [优化指南](../OPTIMIZATION_GUIDE.md)

---

*本文档采用模块化结构，便于快速定位和更新。完整内容请查看对应模块文件。*
