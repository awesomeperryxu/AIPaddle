# AIPaddle 产品需求文档 (PRD)

**项目名称**: AIPaddle
**文档版本**: 1.04  
**创建日期**: 2026-05-07  
**更新日期**: 2026-05-12  
**文档类型**: 产品需求文档  
**基于**: 已开发的前端功能分析 + Dify 开源代码深度分析

**版本变更**:
- v1.01 (2026-05-08): 新增租户管理模块（2.9）
- v1.02 (2026-05-08): 新增租户内部管理模块（2.10）
- v1.03 (2026-05-08): 增强租户管理模块（2.9），完善开通企业流程、多级页面结构、配额管理、账单管理等功能
- v1.04 (2026-05-12): 全面重写 2.5 Workflow & Chatflow 模块（基于 Dify 源码深度分析，30+ 节点类型，130 人天估算）

---

## 1. 产品概述

### 1.1 产品定位

AIPaddle 是一个**企业级 AI 运营管理平台**，专注于帮助企业构建、部署、管理和监控 AI Agent、Skill 和工作流。

**核心价值主张**:
- **统一管理**: 集中管理所有 AI 资产（Agent、Skill、知识库、工作流）
- **企业级**: 完整的权限管理、安全审核、多租户支持
- **可视化**: 直观的监控面板和工作流编辑器
- **可扩展**: 灵活的 Skill 市场和插件系统

### 1.2 目标用户

1. **企业 IT 管理员** - 管理 AI 基础设施和资源
2. **AI 开发者** - 创建和发布 AI Agent 和 Skill
3. **业务部门** - 使用 AI Agent 提升工作效率
4. **安全审计员** - 审核和监控 AI 使用情况
5. **租户管理员** - SaaS 模式下的多租户管理

---

## 2. 核心功能模块

### 2.1 监控面板 (Dashboard)

**功能描述**: 提供平台整体运营数据的可视化展示

**核心功能**:
1. **实时统计**
   - Agent 总数和状态分布
   - Skill 总数和使用情况
   - 工作流执行统计
   - 知识库容量统计

2. **趋势图表**
   - Agent 调用趋势（折线图）
   - Agent 类型分布（饼图）
   - 部门使用情况（柱状图）
   - 成功率趋势

3. **快速操作**
   - 创建新 Agent
   - 查看待审核项
   - 访问常用功能

**UI 组件**:
- 统计卡片（Card）
- 图表组件（Recharts）
- 快速操作按钮
- 最近活动列表

---

### 2.2 Agent 管理模块

#### 2.2.1 Agent 管理 (Agents Admin)

**功能描述**: 创建、配置和管理企业 AI Agent

**核心功能**:

1. **Agent 列表**
   - 全部 Agent 展示
   - 按状态筛选（草稿、待审核、已发布、已下线）
   - 搜索功能（按名称、部门）
   - 统计卡片（总数、已发布、待审核、草稿）

2. **Agent 状态管理**
   - 草稿 (draft) - 开发中
   - 待审核 (pending) - 等待审批
   - 已发布 (published) - 正式运行
   - 已下线 (offline) - 停止服务

3. **Agent 详情**
   - 基本信息（名称、描述、部门）
   - 使用场景配置
   - 关联的 Skill 列表
   - 关联的知识库
   - 关联的工作流
   - 性能指标（调用次数、成功率、平均响应时间）

4. **使用场景**
   - 本地 CC（呼叫中心集成）
   - 企微对话（企业微信接入）
   - Web 接入（网页嵌入）
   - API 调用（直接 API）

5. **Agent 操作**
   - 创建 Agent
   - 编辑配置
   - 启动/暂停
   - 复制 Agent
   - 删除 Agent
   - 查看日志

**数据模型**:
```typescript
interface Agent {
  id: string;
  name: string;
  description: string;
  department: string;
  status: 'draft' | 'pending' | 'published' | 'offline';
  skills: string[];
  knowledgeBases: string[];
  workflows: string[];
  usageScenarios: ('local-cc' | 'wecom' | 'web' | 'api')[];
  metrics: {
    calls: number;
    successRate: number;
    avgResponseTime: number;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
```

#### 2.2.2 数字员工 (Agents View)

**功能描述**: 用户与已发布 Agent 的交互界面

**核心功能**:

1. **Agent 浏览**
   - 展示所有已发布的 Agent
   - 按部门筛选
   - 搜索功能

2. **Agent 交互**
   - 选择 Agent 进行对话
   - 实时消息发送
   - 查看 Agent 能力
   - 查看使用统计

3. **对话功能**
   - 文本输入
   - 历史记录
   - 快速操作按钮

---

### 2.3 Skill Hub 模块

**功能描述**: 企业 AI 能力市场，管理和分享可复用的 AI 能力

**核心功能**:

1. **Skill 列表**
   - 全部 Skill 展示
   - 按类型筛选（MCP、API、DB、Workflow、Prompt）
   - 搜索功能
   - 统计信息（总数、已发布、待审核、总安装量）

2. **Skill 类型**
   - **MCP** (Model Context Protocol) - 模型上下文协议
   - **API** - API 集成能力
   - **DB** - 数据库操作能力
   - **Workflow** - 工作流能力
   - **Prompt** - Prompt 模板

3. **Skill 详情**
   - 基本信息（名称、描述、类型）
   - 发布者信息
   - 版本信息
   - 安装量和评分
   - 风险等级（低、中、高）
   - 使用文档
   - 配置参数

4. **Skill 操作**
   - 创建 Skill
   - 安装/卸载
   - 查看详情
   - 评分和评论
   - 分享

5. **Tab 切换**
   - Skill Hub（所有已发布）
   - 我的 Skill（我创建的）

**数据模型**:
```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  type: 'MCP' | 'API' | 'DB' | 'Workflow' | 'Prompt';
  publisher: string;
  version: string;
  installs: number;
  rating: number;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'draft' | 'pending' | 'published';
  tags: string[];
  documentation: string;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
```

---

### 2.4 知识库模块

**功能描述**: 管理企业知识库，为 Agent 提供知识支持

**核心功能**:

1. **知识库列表**
   - 全部知识库展示
   - 按状态筛选
   - 搜索功能
   - 统计信息

2. **知识库详情**
   - 基本信息
   - 文档数量
   - 存储容量
   - 向量化状态
   - 关联的 Agent

3. **知识库操作**
   - 创建知识库
   - 上传文档
   - 删除文档
   - 重新索引
   - 测试检索

4. **知识库问答**
   - 基于知识库的问答测试
   - 检索结果展示
   - 相关性评分

**数据模型**:
```typescript
interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  department: string;
  documentCount: number;
  storageSize: number;
  vectorized: boolean;
  status: 'active' | 'indexing' | 'error';
  linkedAgents: string[];
  createdAt: string;
  updatedAt: string;
}
```

---

### 2.5 Workflow & Chatflow 模块

> **完整 PRD 详见独立模块文件**：[modules/2.5_workflow_chatflow.md](./modules/2.5_workflow_chatflow.md)  
> 基于 Dify 开源代码深度分析（937 个 TSX 文件），v1.04 全面重写。

**功能定位**：
- **Workflow**：面向批处理和 API 调用，以 End 节点输出，支持 Webhook/定时/插件触发
- **Chatflow**：面向对话场景，以 Answer 节点流式输出，支持多轮对话上下文和对话变量

**技术架构**：ReactFlow 画布引擎 + Zustand 状态管理 + WebSocket 实时协作

**节点类型（30+ 种）**：

| 分类 | 节点 |
|------|------|
| 触发器 | Start、Trigger-Webhook、Trigger-Schedule、Trigger-Plugin |
| AI | LLM、Agent、Question-Classifier、Parameter-Extractor |
| 逻辑控制 | If-Else、Iteration（容器）、Loop（容器）、Human-Input |
| 数据处理 | Code、Template-Transform、Variable-Assigner、List-Operator、Document-Extractor |
| 集成 | HTTP-Request、Tool、Knowledge-Retrieval、Data-Source、Knowledge-Base |
| 输出 | End（Workflow）、Answer（Chatflow） |
| 特殊 | Note（便签，非执行）、Iteration-Start、Loop-Start、Loop-End |

**变量系统**：
- 系统变量（`sys.*`）：query、files、user_id、conversation_id、dialog_count、timestamp
- 节点输出变量（`node_id.*`）
- 环境变量（`env.*`）：工作流级别，支持加密
- 对话变量（`conversation.*`）：Chatflow 专属，跨轮次持久化

**核心功能清单**：
1. 可视化画布（ReactFlow，点状网格，节点宽度 240px）
2. 节点配置面板（右侧 380px 抽屉，参数/输入/输出三 Tab）
3. 节点重试配置（1-10 次，间隔 100-5000ms）
4. 节点错误处理（无处理/失败分支/默认值）
5. 运行调试（三 Tab：结果/详情/追踪，含 Agent/迭代/循环/重试日志）
6. Chatflow 对话预览（流式输出，对话记录，线程导航）
7. 版本历史（列表、恢复、发布状态）
8. 环境变量管理（加密存储）
9. 全局变量面板（sys.* 完整列表）
10. 对话变量面板（影响分析，自动更新引用）
11. 评论系统（画布评论，线程，过滤，解决）
12. 实时协作（WebSocket，用户光标，CRDT 冲突解决）
13. Block Selector（节点添加面板，分类+搜索）
14. 便签节点（富文本，8 种颜色，可调大小）
15. 发布前检查清单（节点检查 + 插件检查）
16. 插件依赖管理
17. 工作流预览模式（只读，INPUT/TRACING/RESULT）
18. DSL 导入/导出（YAML 格式）
19. 快捷键系统（⌘Z/⌘C/⌘V/Delete 等）
20. 对齐辅助线（拖拽时自动显示）

**数据模型**：

```typescript
enum BlockEnum {
  Start = 'start', End = 'end', Answer = 'answer',
  LLM = 'llm', Agent = 'agent',
  Code = 'code', TemplateTransform = 'template-transform',
  IfElse = 'if-else', Iteration = 'iteration', Loop = 'loop',
  HttpRequest = 'http-request', Tool = 'tool',
  KnowledgeRetrieval = 'knowledge-retrieval',
  QuestionClassifier = 'question-classifier',
  ParameterExtractor = 'parameter-extractor',
  VariableAssigner = 'variable-assigner',
  ListOperator = 'list-operator', DocumentExtractor = 'document-extractor',
  HumanInput = 'human-input',
  TriggerWebhook = 'trigger-webhook', TriggerSchedule = 'trigger-schedule',
  TriggerPlugin = 'trigger-plugin',
  DataSource = 'data-source', KnowledgeBase = 'knowledge-base',
}

enum NodeRunningStatus {
  NotStart = 'not-start', Waiting = 'waiting', Running = 'running',
  Succeeded = 'succeeded', Failed = 'failed',
  Exception = 'exception', Paused = 'paused',
}

enum VarType {
  string = 'string', number = 'number', boolean = 'boolean',
  object = 'object', array = 'array',
  arrayString = 'array[string]', arrayNumber = 'array[number]',
  arrayObject = 'array[object]', file = 'file', arrayFile = 'array[file]',
}

interface CommonNodeType<T = Record<string, unknown>> {
  id: string
  type: BlockEnum
  title: string
  desc?: string
  selected?: boolean
  isInIteration?: boolean
  isInLoop?: boolean
  runningStatus?: NodeRunningStatus
  inputs: T
}
```

**开发工作量**：130 人天（详见模块文件第 18 章）

---

### 2.6 个人助理模块

**功能描述**: 个人 AI 助手，提供日常工作支持

**核心功能**:

1. **对话界面**
   - 多会话管理
   - 实时消息
   - 历史记录

2. **快速操作**
   - 预设问题模板
   - 常用功能快捷入口

3. **会话管理**
   - 创建新会话
   - 切换会话
   - 删除会话
   - 导出会话

---

### 2.7 安全管理模块

**功能描述**: 安全审核和权限管理

**核心功能**:

1. **安全审核**
   - 待审核列表
   - 审核详情
   - 批准/拒绝操作
   - 审核历史

2. **审核类型**
   - Agent 发布审核
   - Skill 发布审核
   - 知识库访问审核
   - 权限变更审核

3. **风险评估**
   - 低风险（自动通过）
   - 中风险（需要审核）
   - 高风险（严格审核）

4. **审核流程**
   - 提交审核
   - 审核中
   - 已批准
   - 已拒绝

**数据模型**:
```typescript
interface SecurityReview {
  id: string;
  type: 'agent' | 'skill' | 'knowledge' | 'permission';
  resourceName: string;
  submitter: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  riskLevel: 'low' | 'medium' | 'high';
  reviewer?: string;
  reviewedAt?: string;
  comments?: string;
}
```

---

### 2.8 成员管理模块

**功能描述**: 管理平台用户和权限

**核心功能**:

1. **成员列表**
   - 全部成员展示
   - 按角色筛选
   - 按状态筛选
   - 搜索功能

2. **角色管理**
   - **Admin** - 管理员（完全权限）
   - **Developer** - 开发者（创建和管理 AI 资产）
   - **User** - 普通用户（使用 AI 服务）
   - **Auditor** - 审计员（只读和审核权限）

3. **成员操作**
   - 邀请成员
   - 编辑角色
   - 启用/禁用账户
   - 删除成员
   - 查看活动日志

4. **权限管理**
   - 角色权限配置
   - 资源访问控制
   - 操作审计日志

**数据模型**:
```typescript
interface Member {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'Admin' | 'Developer' | 'User' | 'Auditor';
  status: 'active' | 'inactive';
  lastActive: string;
  joinedAt: string;
}
```

---

### 2.9 租户管理模块 (SaaS)

> **版本**: v1.01 新增  
> **更新日期**: 2026-05-08

**功能描述**: 企业级 AI Agent & Skill 管理平台的 SaaS 租户治理体系

**产品目标**:
- 企业快速开通与初始化
- LLM 模型统一治理
- Token 成本与计费管理
- MCP 安全治理
- Skill / Workflow 标准化初始化
- 企业组织与权限治理
- 企业级资源隔离与审计

#### 2.9.1 企业租户管理

**企业创建字段**:

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

**租户初始化内容**:
- 默认知识库
- 默认 Agent 空间
- 默认 Skill 库
- 默认 Workflow 库
- 默认 Prompt 库
- 默认 MCP 空间
- 默认审计日志

#### 2.9.2 LLM 模型管理

**支持的模型提供商**:
- OpenAI / Azure OpenAI
- Anthropic (Claude)
- Google (Gemini)
- DeepSeek
- 通义千问
- 智谱GLM
- Ollama / vLLM
- 企业私有模型

**模型治理能力**:
- Skill级模型绑定
- Workflow级模型绑定
- Agent级模型绑定
- 多模型Fallback
- 成本优先路由
- 质量优先路由
- 响应速度优先路由

**模型权限控制**:

| 权限项 | 说明 |
|---|---|
| 模型白名单 | 指定模型可用 |
| 模型黑名单 | 禁止调用 |
| 部门模型权限 | 部门隔离 |
| Skill模型权限 | Skill可调用模型 |

#### 2.9.3 Token 用量与计费

**Token统计维度**:

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

**计费方式**:
- 按Token计费
- 按调用次数计费
- 按并发计费
- 按座席计费
- 包月套餐
- 混合计费

**Token控制策略**:
- 日限额
- 月限额
- 部门限额
- 用户限额
- 模型限额
- Skill限额

#### 2.9.4 MCP 管理中心

**MCP 定位**:
- Tool调用协议层
- 企业系统连接层
- Agent执行能力层
- 企业AI权限边界

**MCP 分类**:

| 类型 | 说明 |
|---|---|
| 平台内置MCP | 官方维护 |
| 企业自建MCP | 企业开发 |
| 第三方MCP | 外部市场 |
| 审批通过MCP | 安全审核后 |
| 私有MCP | 企业专属 |

**MCP注册字段**:

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

**MCP 安全策略**:

**模式A：严格模式**（大型企业推荐）
- 仅允许平台官方MCP和已审批企业MCP
- 禁止临时MCP、未审批MCP、动态注册MCP
- 适用于：金融、政企、医疗

**模式B：受控开放模式**（推荐）
- 允许Skill创建时临时新增MCP
- 自动进入审批队列
- Draft环境允许测试，Production必须审批

**模式C：开放模式**（创新团队）
- 允许动态创建MCP
- Sandbox即时运行
- 生产环境必须审批
- 适用于：AI实验室、创新团队、初创企业

#### 2.9.5 组织结构与权限

**Excel导入支持字段**:
- 部门编码、部门名称、上级部门
- 用户工号、用户姓名、邮箱、手机、角色

**企业微信同步**:
- OAuth授权
- 部门同步、用户同步
- 单点登录SSO
- 自动增量同步
- 离职用户禁用

**未来扩展**: 飞书、钉钉、Okta、Azure AD、Google Workspace

**默认角色**:
- 企业超级管理员
- AI管理员
- 安全管理员
- 财务管理员
- 普通用户

**权限模型**: RBAC（未来建议：ABAC、Policy Engine、Runtime Permission）

#### 2.9.6 Skill 与 Workflow 初始化

**默认 Skill 模板**:

| 分类 | Skill |
|---|---|
| 办公 | 文档总结、PPT生成、邮件生成 |
| 数据 | SQL分析、BI问答 |
| 客服 | FAQ机器人 |
| 开发 | Code Review、API生成 |
| 法务 | 合同审查 |
| HR | JD生成 |

**Workflow模板**:
- 知识问答流程
- Agent协同流程
- MCP调用流程
- 审批流程
- 数据分析流程

#### 2.9.7 安全与审计

**必备能力**:
- MCP调用审计
- Prompt审计
- Token审计
- Agent行为审计
- 风险告警
- API限流
- 数据脱敏
- 操作审计

#### 2.9.8 租户管理页面增强 (v1.03 新增)

> **版本**: v1.03 新增  
> **更新日期**: 2026-05-08

**功能描述**: 完善租户管理的操作流程，构建完整的多级页面体系

**核心增强内容**:

**1. 开通企业功能增强**

采用全屏抽屉（Drawer）形式，表单分为 4 个区块：

**区块 1: 企业基本信息**
- 企业名称、企业编码（自动生成可修改）、企业简称
- 行业类型、企业规模、国家/地区（三级联动）
- 时区设置、企业 Logo 上传

**区块 2: 联系人信息**
- 联系人姓名、职位、邮箱（用于登录）
- 联系电话、备用邮箱

**区块 3: 套餐与配额**
- 套餐类型（免费版/标准版/专业版/企业版）
- 计费模式（按量付费/包年包月）
- 初始 Token 配额、配额预警阈值
- 并发请求限制（QPS）、存储空间配额

**区块 4: 高级设置**
- 服务有效期、是否启用 MCP
- 数据隔离级别（逻辑隔离/物理隔离）
- 备注信息（内部使用）

**提交后操作**:
- 创建租户记录，状态为 active
- 创建租户管理员账号
- 发送开通通知邮件（含登录链接、初始密码）
- 初始化默认组织架构
- 分配初始 Token 配额
- 创建审计日志记录

**2. 企业列表操作增强**

每行操作列增加以下按钮（使用 DropdownMenu 收纳）：
- 查看详情 → 企业详情页（二级页面）
- 编辑信息 → 编辑抽屉
- 配额管理 → 配额管理页（二级页面）
- 账单管理 → 账单管理页（二级页面）
- 模型配置 → 模型配置页（二级页面）
- 暂停服务 / 恢复服务 → 确认弹窗
- 删除租户 → 二次确认（超级管理员）

批量操作：
- 批量暂停服务
- 批量恢复服务
- 批量导出数据
- 批量发送通知

**3. 多级页面结构**

```
租户管理主页（一级）
├── 企业详情页（二级）
│   ├── 基本信息 Tab
│   ├── 配额使用 Tab
│   ├── 账单记录 Tab
│   ├── 操作日志 Tab
│   └── 设置 Tab
├── 配额管理页（二级）
│   ├── Token 用量详情（三级）
│   └── 存储用量详情（三级）
├── 账单管理页（二级）
│   └── 账单详情（三级）
├── 模型配置页（二级）
│   └── 模型权限设置（三级）
└── MCP 审批页（二级）
    └── MCP 详情（三级）
```

**4. 企业详情页（二级页面）**

路由: `/admin/tenants/:tenantId/detail`

**Tab 1: 基本信息**
- 展示所有创建时填写的字段（只读）
- 右上角"编辑"按钮

**Tab 2: 配额使用**
- Token 使用情况：环形进度图、近 30 天用量趋势、按模型分类占比
- 存储使用情况：进度条、文件类型分布
- 并发请求监控：实时 QPS、近 1 小时曲线

**Tab 3: 账单记录**
- 账单列表表格（账单周期、金额、Token 消耗、状态）
- 筛选器：时间范围、状态
- 统计卡片：累计消费、本月消费、待支付金额

**Tab 4: 操作日志**
- 日志列表（操作时间、操作人、操作类型、操作内容、IP）
- 按操作类型筛选
- 导出为 CSV

**Tab 5: 设置**
- 危险操作区：暂停服务、删除租户
- 通知设置：配额预警邮件接收人、账单通知接收人

**5. 配额管理页（二级页面）**

路由: `/admin/tenants/:tenantId/quota`

包含 3 个配额卡片：
- Token 配额卡片：当前配额、已用量、剩余量、调整配额按钮、用量趋势图
- 存储配额卡片：当前配额、已用量、剩余量、文件类型分布
- 并发限制卡片：当前限制（QPS）、近 1 小时峰值 QPS

调整配额功能：
- 打开 Dialog 输入新配额
- 填写调整原因（必填）
- 提交后记录审计日志

**6. 账单管理页（二级页面）**

路由: `/admin/tenants/:tenantId/billing`

顶部统计卡片：
- 累计消费、本月消费、待支付金额、逾期金额

账单列表表格：
- 列：账单编号、账单周期、账单金额、Token 消耗、状态、创建时间、操作
- 状态标签：已支付（绿色）、未支付（黄色）、已逾期（红色）、已作废（灰色）
- 操作：查看详情、下载 PDF、标记为已支付、作废账单
- 筛选器：时间范围、状态、金额范围
- 批量操作：批量下载、批量标记已支付

**7. 数据模型补充**

租户表（tenants）新增字段：
- shortName（企业简称）
- industry（行业类型）
- companySize（企业规模）
- country、province、city（地理位置）
- timezone（时区）
- logoUrl（Logo URL）
- contactName、contactPosition、contactEmail、contactPhone、backupEmail（联系人信息）
- planType（套餐类型）
- billingMode（计费模式）
- tokenQuota、quotaWarningThreshold、qpsLimit、storageQuota（配额信息）
- serviceStartDate、serviceEndDate（服务有效期）
- mcpEnabled（是否启用 MCP）
- dataIsolationLevel（数据隔离级别）
- internalNotes（内部备注）

新增表：
- quota_adjustments（配额调整记录）
- bills（账单表）
- bill_items（账单明细表）
- mcp_applications（MCP 申请表）

**8. API 接口**

```
POST /api/admin/tenants - 创建租户
GET /api/admin/tenants - 获取租户列表
GET /api/admin/tenants/:tenantId - 获取租户详情
PATCH /api/admin/tenants/:tenantId - 更新租户信息
POST /api/admin/tenants/:tenantId/quota/adjust - 调整配额
GET /api/admin/tenants/:tenantId/bills - 获取账单列表
GET /api/admin/tenants/:tenantId/bills/:billId - 获取账单详情
POST /api/admin/tenants/:tenantId/bills/:billId/mark-paid - 标记账单已支付
GET /api/admin/tenants/:tenantId/mcp - 获取 MCP 申请列表
POST /api/admin/tenants/:tenantId/mcp/:mcpId/review - 审批 MCP
```

**9. 工作量估算**

| 模块 | 预估工时（人天） |
|-----|----------------|
| 开通企业表单 | 3 |
| 企业列表增强 | 2 |
| 企业详情页 | 5 |
| 配额管理页 | 3 |
| 账单管理页 | 3 |
| 模型配置页 | 2 |
| MCP 审批页 | 2 |
| 三级页面 | 6 |
| 后端 API | 8 |
| 测试 | 4 |
| **总计** | **38 人天** |


### 2.10 租户内部管理模块

> **版本**: v1.02 新增  
> **更新日期**: 2026-05-08

**功能描述**: 租户自服务管理中心，企业租户管理员自主管理内部组织和人员

**模块定位**: 与 2.9 租户管理模块的区别

| 对比项 | 2.9 租户管理 | 2.10 租户内部管理 |
|---|---|---|
| 使用者 | 平台运营方 | 企业租户管理员 |
| 管理对象 | 多个租户 | 单个租户内部 |
| 核心功能 | 租户开通、计费、模型治理 | 组织架构、人员、权限 |
| 权限级别 | 平台超级管理员 | 企业管理员 |

#### 2.10.1 组织架构管理

**部门管理**:
- 部门创建、编辑、删除
- 支持无限层级（建议不超过 5 级）
- 部门树形结构展示
- 部门负责人、成本中心配置
- 部门状态管理（正常/冻结/已撤销）

**部门资源配额**:
- Token 月限额
- 存储空间限额
- Agent/Skill 数量限额
- 并发调用数限额
- 配额监控和告警（80%、90%、100% 阈值）

#### 2.10.2 人员管理

**用户信息管理**:
- 工号、姓名、邮箱、手机号
- 所属部门、直属上级、职位
- 用户状态（正常/试用/离职/冻结）
- 角色分配（支持多角色）

**用户创建方式**:
1. 单个创建（表单填写）
2. 批量导入（Excel 模板）
3. 企业微信同步（OAuth 授权、增量同步）
4. 飞书/钉钉同步（未来支持）

**用户生命周期**:
- 入职流程（创建账号 → 分配角色 → 激活邮件）
- 在职管理（部门调动、角色变更、信息更新）
- 离职流程（禁用登录 → 回收权限 → 转移资源 → 归档数据）

#### 2.10.3 角色权限管理

**预设角色**:
- 企业超级管理员（全部权限）
- 企业管理员（组织、人员、配额管理）
- AI 管理员（Agent、Skill、模型管理）
- 安全管理员（审计、权限、MCP 审批）
- 财务管理员（账单、配额、成本分析）
- 部门管理员（本部门人员和资源）
- 开发者（创建 Agent/Skill）
- 普通用户（使用 Agent/Skill）

**自定义角色**:
- 角色创建和编辑
- 权限矩阵配置（功能权限 × 操作权限）
- 数据权限设置（全部/本部门+/本部门/本人）
- 角色继承和权限组合

#### 2.10.4 访问控制与安全

**单点登录 (SSO)**:
- 支持 SAML 2.0、OAuth 2.0、OIDC
- 支持 Azure AD、Okta、Google Workspace、企业微信、飞书、钉钉

**多因素认证 (MFA)**:
- 短信验证码、邮箱验证码、TOTP
- 企业级/角色级/用户级 MFA 策略
- 信任设备管理

**会话管理**:
- 会话超时配置（30分钟 - 24小时）
- 最大并发会话限制
- 在线会话监控
- 强制登出功能

**登录安全**:
- 密码策略（长度、复杂度、有效期）
- 登录失败锁定
- IP 白名单
- 登录审计日志

#### 2.10.5 资源配额管理

**配额分配**:
- 企业级配额（从平台购买）
- 部门级配额（从企业配额分配）
- 用户级配额（从部门配额分配）

**配额监控**:
- 实时使用量监控
- 使用趋势分析
- 异常检测和告警
- 配额耗尽自动限流

#### 2.10.6 审计日志

**审计事件**:
- 用户登录/登出
- 用户创建/编辑/删除
- 角色分配/权限变更
- 部门创建/调整
- 配额调整
- 资源访问

**审计功能**:
- 多条件查询
- 日志导出（Excel、CSV、PDF）
- 审计保留（默认 1 年，企业版 3-7 年）
- 不可篡改、不可删除

---

## 3. 技术架构

### 3.1 前端技术栈

```json
{
  "framework": "Next.js 16.2.4",
  "language": "TypeScript 5.7.3",
  "styling": "Tailwind CSS 4.2.0",
  "ui": "Radix UI + shadcn/ui",
  "icons": "Lucide React",
  "charts": "Recharts 2.15.0",
  "forms": "React Hook Form + Zod",
  "theme": "next-themes"
}
```

### 3.2 UI 组件库

**基础组件** (来自 shadcn/ui):
- Button, Input, Card, Badge
- Dialog, Dropdown, Popover, Tooltip
- Tabs, Accordion, Sheet
- Table, Pagination
- Alert, Toast
- Progress, Slider
- Calendar, Date Picker
- Form, Label, Checkbox, Radio
- Select, Combobox
- Scroll Area, Resizable

**自定义组件**:
- AppSidebar - 侧边栏导航
- DashboardView - 监控面板
- AgentsAdminView - Agent 管理
- SkillHubView - Skill 市场
- WorkflowView - 工作流编辑器
- SecurityView - 安全审核
- MembersView - 成员管理
- TenantsView - 租户管理

### 3.3 设计系统

**颜色系统**:
```css
/* 主色 */
--primary: 主色调
--accent: 强调色
--success: 成功状态（绿色）
--warning: 警告状态（黄色）
--destructive: 危险状态（红色）

/* 中性色 */
--background: 背景色
--foreground: 前景色
--card: 卡片背景
--muted: 弱化色
--border: 边框色
```

**间距系统**:
- 小间距: 0.5rem (8px)
- 中间距: 1rem (16px)
- 大间距: 1.5rem (24px)

**圆角系统**:
- 小圆角: 0.5rem
- 中圆角: 0.75rem
- 大圆角: 1rem

---

## 4. 用户流程

### 4.1 创建和发布 Agent

```
1. 进入 Agent 管理页面
2. 点击"创建 Agent"
3. 填写基本信息（名称、描述、部门）
4. 选择使用场景
5. 关联 Skill
6. 关联知识库
7. 配置工作流（可选）
8. 保存为草稿
9. 测试 Agent
10. 提交审核
11. 审核通过后发布
12. 配置接入方式（CC/企微/Web/API）
```

### 4.2 创建和发布 Skill

```
1. 进入 Skill Hub
2. 点击"创建 Skill"
3. 选择 Skill 类型（MCP/API/DB/Workflow/Prompt）
4. 填写基本信息
5. 配置 Skill 参数
6. 编写使用文档
7. 设置风险等级
8. 保存为草稿
9. 测试 Skill
10. 提交审核
11. 审核通过后发布到 Skill Hub
```

### 4.3 创建工作流

```
1. 进入工作流管理
2. 点击"创建工作流"
3. 选择工作流类型
4. 在画布上拖拽节点
5. 连接节点
6. 配置每个节点
7. 设置变量
8. 保存工作流
9. 运行测试
10. 查看执行日志
11. 发布工作流
```

---

## 5. 数据模型总结

### 5.1 核心实体

1. **Agent** - AI 代理
2. **Skill** - AI 能力
3. **KnowledgeBase** - 知识库
4. **Workflow** - 工作流
5. **Member** - 成员
6. **Tenant** - 租户
7. **SecurityReview** - 安全审核

### 5.2 关系

```
Agent 1:N Skill (一个 Agent 可以有多个 Skill)
Agent 1:N KnowledgeBase (一个 Agent 可以关联多个知识库)
Agent 1:1 Workflow (一个 Agent 可以有一个工作流)
Tenant 1:N Agent (一个租户可以有多个 Agent)
Tenant 1:N Member (一个租户可以有多个成员)
```

---

## 6. 非功能需求

### 6.1 性能要求

- 页面加载时间 < 2s
- API 响应时间 < 500ms
- 支持 1000+ 并发用户
- 工作流执行延迟 < 3s

### 6.2 安全要求

- 用户认证（OAuth 2.0）
- 角色权限控制（RBAC）
- 数据加密（传输和存储）
- 审计日志
- API Rate Limiting

### 6.3 可用性要求

- 系统可用性 > 99.9%
- 数据备份（每日）
- 灾难恢复计划
- 监控和告警

### 6.4 可扩展性

- 微服务架构
- 水平扩展支持
- 插件系统
- API 优先设计

---

## 7. 开发优先级

### Phase 1: MVP UI 原型（已完成）
- ✅ 基础 UI 框架（原型）
- ✅ 侧边栏导航（原型）
- ✅ 监控面板（静态演示数据）
- ✅ Agent 管理（列表与详情原型）
- ✅ Skill Hub（列表与详情原型）
- ✅ 工作流编辑器（本地交互原型）
- ✅ 知识库管理（列表与详情原型）
- ✅ 安全审核（列表与详情原型）
- ✅ 成员管理（列表原型）
- ✅ 租户管理（列表与概览原型）

> 上述完成状态仅表示前端页面覆盖；API、持久化、权限校验和执行引擎仍属于 Phase 2。具体边界见实现审计。

### Phase 2: 后端集成 (待开发)
- ⏳ 用户认证系统
- ⏳ Agent API
- ⏳ Skill API
- ⏳ 工作流引擎
- ⏳ 知识库 API
- ⏳ 权限系统

### Phase 3: 高级功能 (待开发)
- ⏳ 实时监控
- ⏳ 日志分析
- ⏳ 性能优化
- ⏳ 多语言支持
- ⏳ 移动端适配

---

## 8. 待开发功能

根据代码分析，以下功能标记为"开发中"：

1. **Key 管理** - API 密钥管理
2. **账单管理** - 费用和账单
3. **系统设置** - 全局配置

---

## 9. 参考资料

### 9.1 项目信息
- **GitHub**: https://github.com/HELLOPERRYXU/AIPaddle
- **实现审计**: `../IMPLEMENTATION_AUDIT.md`

### 9.2 技术文档
- Next.js: https://nextjs.org/docs
- Radix UI: https://www.radix-ui.com/
- Tailwind CSS: https://tailwindcss.com/
- shadcn/ui: https://ui.shadcn.com/

---

**文档结束**

*本 PRD 基于 AIPaddle 项目的前端代码分析生成，反映了当前已实现的功能。*
