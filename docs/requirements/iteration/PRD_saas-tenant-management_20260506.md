# LLMOps SaaS 平台 - 租户管理模块 PRD

## 1. 产品目标

构建企业级 AI Agent & Skill 管理平台的 SaaS 租户治理体系，实现：

- 企业快速开通与初始化
- LLM 模型统一治理
- Token 成本与计费管理
- MCP 安全治理
- Skill / Workflow 标准化初始化
- 企业组织与权限治理
- 企业级资源隔离与审计

---

# 2. 核心模块

## 2.1 企业租户管理

### 企业创建字段

| 字段 | 类型 | 说明 |
|---|---|---|
| 企业名称 | String | 租户唯一名称 |
| 企业编码 | String | 系统唯一Code |
| 行业类型 | Enum | 制造/金融/零售等 |
| 企业规模 | Enum | 小型/中型/大型 |
| 国家地区 | Enum | 用于数据隔离 |
| 时区 | Enum | 默认系统时区 |
| Logo | Image | 企业Logo |
| 联系人 | String | 主管理员 |
| 联系邮箱 | Email | 登录与通知 |

---

## 2.2 租户初始化

### 初始化内容

- 默认知识库
- 默认 Agent 空间
- 默认 Skill 库
- 默认 Workflow 库
- 默认 Prompt 库
- 默认 MCP 空间
- 默认审计日志

---

# 3. LLM 模型管理

## 3.1 模型支持

支持：

- OpenAI
- Azure OpenAI
- Anthropic
- Gemini
- DeepSeek
- 通义千问
- 智谱GLM
- Claude
- Ollama
- vLLM
- 企业私有模型

---

## 3.2 模型治理能力

### 支持功能

- Skill级模型绑定
- Workflow级模型绑定
- Agent级模型绑定
- 多模型Fallback
- 成本优先路由
- 质量优先路由
- 响应速度优先路由

---

## 3.3 模型权限

| 权限项 | 说明 |
|---|---|
| 模型白名单 | 指定模型可用 |
| 模型黑名单 | 禁止调用 |
| 部门模型权限 | 部门隔离 |
| Skill模型权限 | Skill可调用模型 |

---

# 4. Token 用量与计费

## 4.1 Token统计维度

| 维度 | 示例 |
|---|---|
| 企业维度 | 总Token |
| 部门维度 | 市场部/研发部 |
| 用户维度 | 用户Token消耗 |
| Agent维度 | Agent成本 |
| Skill维度 | Skill调用成本 |
| Workflow维度 | 流程成本 |
| MCP维度 | MCP调用成本 |
| 模型维度 | GPT-4/Claude等 |

---

## 4.2 计费方式

- 按Token计费
- 按调用次数计费
- 按并发计费
- 按座席计费
- 包月套餐
- 混合计费

---

## 4.3 Token控制策略

- 日限额
- 月限额
- 部门限额
- 用户限额
- 模型限额
- Skill限额

---

# 5. 组织结构初始化

## 5.1 Excel导入

### 支持字段

- 部门编码
- 部门名称
- 上级部门
- 用户工号
- 用户姓名
- 邮箱
- 手机
- 角色

### 支持能力

- 批量导入
- 增量同步
- 冲突检测
- 重复校验

---

## 5.2 企业微信同步

支持：

- OAuth授权
- 部门同步
- 用户同步
- 单点登录SSO
- 自动增量同步
- 离职用户禁用

未来扩展：

- 飞书
- 钉钉
- Okta
- Azure AD
- Google Workspace

---

# 6. Skill 与 Workflow 初始化

## 6.1 默认 Skill 模板

| 分类 | Skill |
|---|---|
| 办公 | 文档总结 |
| 办公 | PPT生成 |
| 办公 | 邮件生成 |
| 数据 | SQL分析 |
| 数据 | BI问答 |
| 客服 | FAQ机器人 |
| 开发 | Code Review |
| 开发 | API生成 |
| 法务 | 合同审查 |
| HR | JD生成 |

---

## 6.2 Workflow模板

- 知识问答流程
- Agent协同流程
- MCP调用流程
- 审批流程
- 数据分析流程

---

# 7. 权限初始化

## 默认角色

- 企业超级管理员
- AI管理员
- 安全管理员
- 财务管理员
- 普通用户

---

## 权限模型

当前：

- RBAC

未来建议：

- ABAC
- Policy Engine
- Runtime Permission

---

# 8. MCP 管理中心

## 8.1 MCP 定位

MCP 是：

- Tool调用协议层
- 企业系统连接层
- Agent执行能力层
- 企业AI权限边界

---

## 8.2 MCP 分类

| 类型 | 说明 |
|---|---|
| 平台内置MCP | 官方维护 |
| 企业自建MCP | 企业开发 |
| 第三方MCP | 外部市场 |
| 审批通过MCP | 安全审核后 |
| 私有MCP | 企业专属 |

---

## 8.3 MCP注册字段

| 字段 | 说明 |
|---|---|
| MCP名称 | 唯一名称 |
| MCP类型 | 内置/企业/第三方 |
| Endpoint | 地址 |
| Auth方式 | API Key/OAuth/JWT |
| 权限范围 | 可访问资源 |
| 调用限流 | TPS |
| 审计开关 | 是否记录 |
| 安全等级 | 高/中/低 |

---

# 9. Skill 创建时 MCP 管控策略

## 9.1 推荐方案

采用：

# “分级安全策略 + 开关控制”

而不是单一模式。

---

## 9.2 企业级配置开关

| 配置项 | 类型 |
|---|---|
| 是否允许Skill创建时新增MCP | Boolean |
| 是否允许未审批MCP运行 | Boolean |
| 是否允许公网MCP | Boolean |
| 是否允许企业私有MCP | Boolean |
| 是否允许第三方MCP市场 | Boolean |

---

## 9.3 推荐模式

### 模式A：严格模式（大型企业推荐）

仅允许：

- 平台官方MCP
- 已审批企业MCP

禁止：

- 临时MCP
- 未审批MCP
- 动态注册MCP

适用于：

- 金融
- 政企
- 医疗

---

### 模式B：受控开放模式（推荐）

允许：

- Skill创建时临时新增MCP
- 自动进入审批队列

规则：

- Draft环境允许测试
- Production必须审批

这是最推荐模式。

---

### 模式C：开放模式（创新团队）

允许：

- 动态创建MCP
- Sandbox即时运行

但：

- 生产环境必须审批

适用于：

- AI实验室
- 创新团队
- 初创企业

---

# 10. 核心建议

## 不建议 Skill 无治理直接创建 MCP

原因：

### 风险1：数据泄露

可能访问：

- ERP
- CRM
- 财务系统
- 数据库
- 文件系统

---

### 风险2：Agent失控调用

可能形成：

- 无限循环
- Token失控
- API攻击
- 数据破坏

---

### 风险3：Prompt Injection

MCP 是 Prompt Injection 的高风险入口。

---

### 风险4：企业合规

影响：

- SOC2
- ISO27001
- GDPR
- HIPAA
- 等保

---

# 11. 推荐架构

## 推荐采用：

# “开放开发 + 受控上线”

---

## 第一层：MCP Registry

统一管理：

- MCP版本
- 权限
- 安全级别
- 生命周期
- 审计

---

## 第二层：企业 MCP Marketplace

企业可见：

- 官方MCP
- 已审批MCP
- 企业共享MCP

---

## 第三层：Skill 引用 MCP

Skill：

- 只能引用
- 不直接创建生产MCP

---

## 第四层：Runtime 权限控制

运行时动态检查：

- 用户权限
- Skill权限
- MCP权限
- 数据权限

---

# 12. 安全与审计

必须具备：

- MCP调用审计
- Prompt审计
- Token审计
- Agent行为审计
- 风险告警
- API限流
- 数据脱敏
- 操作审计

---

# 13. UI 建议

## 一级菜单

- Dashboard
- 租户设置
- 用户与组织
- 模型管理
- Agent管理
- Skill管理
- Workflow管理
- MCP中心
- Token与账单
- 安全与审计
- 系统配置

---

## MCP中心UI建议

参考：

- Kubernetes Operator
- API Gateway
- Plugin Marketplace

重点突出：

- 权限
- 风险等级
- 审批状态
- 调用量
- 安全状态

---

# 14. 总结

该模块本质是：

# “企业 AI 治理中台”

核心能力包括：

- 企业级 AI 治理
- MCP 安全治理
- Token 成本治理
- Agent Runtime 权限治理
- 企业级审计与合规
- SaaS 多租户隔离

未来真正的企业级 LLMOps 平台壁垒：

- 治理能力
- MCP治理能力
- Runtime控制能力
- 企业安全能力
- Token成本优化能力
