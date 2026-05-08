# AI LLMOps 平台产品需求文档 (PRD)

**项目名称**: v0-ai-llmops-prototype  
**文档版本**: 1.0  
**创建日期**: 2026-05-07  
**文档类型**: 产品需求文档  
**基于**: 已开发的前端功能分析

---

## 1. 产品概述

### 1.1 产品定位

AI LLMOps 平台是一个**企业级 AI 运营管理平台**，专注于帮助企业构建、部署、管理和监控 AI Agent、Skill 和工作流。

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

### 2.5 工作流管理模块

**功能描述**: 可视化工作流编辑器，编排复杂的 AI 流程

**核心功能**:

1. **工作流列表**
   - 按类型筛选（workflow、chatflow、agent、text-generation）
   - 搜索功能
   - 状态管理（草稿、已发布、已下线）
   - 执行统计

2. **工作流编辑器**
   - 可视化画布
   - 节点拖拽
   - 节点连接
   - 节点配置面板
   - 工具栏（保存、运行、撤销、重做）

3. **节点类型**
   - **start** - 开始节点
   - **end** - 结束节点
   - **llm** - LLM 调用节点
   - **knowledge** - 知识检索节点
   - **code** - 代码执行节点
   - **condition** - 条件分支节点
   - **variable** - 变量节点
   - **http** - HTTP 请求节点
   - **template** - 模板节点
   - **iteration** - 迭代节点
   - **parameter-extractor** - 参数提取节点
   - **question-classifier** - 问题分类节点

4. **节点配置**
   - 节点名称和描述
   - 输入/输出参数
   - 节点特定配置
   - 错误处理

5. **工作流操作**
   - 创建工作流
   - 保存/发布
   - 运行测试
   - 查看日志
   - 版本管理
   - 导入/导出

**数据模型**:
```typescript
interface WorkflowApp {
  id: string;
  name: string;
  description: string;
  type: 'workflow' | 'chatflow' | 'agent' | 'text-generation';
  tags: string[];
  status: 'draft' | 'published' | 'offline';
  nodes: WorkflowNode[];
  connections: NodeConnection[];
  executions: number;
  successRate: number;
  lastEditedBy: string;
  lastEditedAt: string;
}

interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  position: { x: number; y: number };
  config?: Record<string, unknown>;
}

interface NodeConnection {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
  targetHandle?: string;
}
```

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

**功能描述**: 多租户 SaaS 平台管理

**核心功能**:

1. **租户列表**
   - 全部租户展示
   - 按套餐筛选
   - 按状态筛选
   - 搜索功能

2. **租户信息**
   - 企业名称
   - 联系人信息
   - 套餐类型
   - 使用量统计
   - 账单信息

3. **套餐管理**
   - **Free** - 免费版（基础功能）
   - **Pro** - 专业版（高级功能）
   - **Enterprise** - 企业版（完整功能）

4. **租户操作**
   - 创建租户
   - 升级/降级套餐
   - 暂停/恢复服务
   - 查看使用报告
   - 账单管理

**数据模型**:
```typescript
interface Tenant {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  package: 'Free' | 'Pro' | 'Enterprise';
  status: 'active' | 'suspended' | 'trial';
  agentCount: number;
  skillCount: number;
  memberCount: number;
  storageUsed: number;
  apiCalls: number;
  createdAt: string;
  expiresAt?: string;
}
```

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

### Phase 1: MVP (已完成)
- ✅ 基础 UI 框架
- ✅ 侧边栏导航
- ✅ 监控面板
- ✅ Agent 管理
- ✅ Skill Hub
- ✅ 工作流编辑器
- ✅ 知识库管理
- ✅ 安全审核
- ✅ 成员管理
- ✅ 租户管理

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
- **GitHub**: https://github.com/HELLOPERRYXU/v0-ai-llmops-prototype
- **v0 项目**: https://v0.app/chat/projects/prj_ZAwVAdLgqJ8PZuBLGPrN1hoDJteq

### 9.2 技术文档
- Next.js: https://nextjs.org/docs
- Radix UI: https://www.radix-ui.com/
- Tailwind CSS: https://tailwindcss.com/
- shadcn/ui: https://ui.shadcn.com/

---

**文档结束**

*本 PRD 基于 v0-ai-llmops-prototype 项目的前端代码分析生成，反映了当前已实现的功能。*
