# AI LLMOps 平台产品需求文档 (PRD)

**项目名称**: v0-ai-llmops-prototype  
**文档版本**: 1.04  
**创建日期**: 2026-05-07  
**更新日期**: 2026-05-08  
**文档类型**: 产品需求文档（索引）  
**基于**: 已开发的前端功能分析

**版本变更**:
- v1.01 (2026-05-08): 新增租户管理模块（2.9）
- v1.02 (2026-05-08): 新增租户内部管理模块（2.10）
- v1.03 (2026-05-08): 增强租户管理模块（2.9），完善开通企业流程、多级页面结构、配额管理、账单管理等功能
- v1.04 (2026-05-08): 新增 Workflow & Chatflow 模块（2.5），基于 Dify 开源代码分析，包含 PRD 和 UI 设计文档
- v1.04 (2026-05-12): 全面重写 2.5 模块（Dify 源码深度核查，补充 24 个缺失功能），新建 PRD_Core_v1.04.md 和 UI_Design_Spec_v1.04.md

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
- **[2.5 Workflow & Chatflow 模块](./modules/2.5_workflow_chatflow.md)** 🆕
  - 可视化工作流画布（ReactFlow）
  - 20+ 节点类型（LLM、Agent、IfElse、Iteration、Loop、Code、HTTP 等）
  - 变量系统（系统变量、环境变量、对话变量）
  - 运行调试与版本管理
  - DSL 导入/导出
  - [UI 设计文档](./ui-pages/workflow_chatflow.md)
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

- **总模块数**: 11 个
- **独立模块文档**: 3 个（2.5, 2.9, 2.10）
- **当前版本**: v1.04
- **最后更新**: 2026-05-08

---

## 🔗 相关文档

- [UI 设计规范 v1.04](./UI_Design_Spec_v1.04.md) 🆕
- [UI 设计规范 v1.03](./UI_Design_Spec_v1.03.md)
- [PRD 主文件 v1.04](./PRD_Core_v1.04.md) 🆕
- [Workflow & Chatflow UI 设计](./ui-pages/workflow_chatflow.md) 🆕
- [变更日志](../changelogs/CHANGELOG_20260508.md)
- [发布日志](../changelogs/RELEASE_v1.03_20260508.md)
- [优化指南](../OPTIMIZATION_GUIDE.md)

---

*本文档采用模块化结构，便于快速定位和更新。完整内容请查看对应模块文件。*
