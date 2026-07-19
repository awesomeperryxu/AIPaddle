# ADR-004：MCP 治理架构（两层结构 + 全量 Skill 封装 + 权限分配）

- 状态：**已采纳**（2026-07-18，Perry 拍板）
- 关联：PRD v1.06 §2.3/§2.9.4/§10 · migration 0002 · ADR-001/002

## 核心规则（用户拍板）

1. **平台内全部 MCP 能力一律封装到 Skill 下**——无论是组织架构/数据库类的数据查询，还是其他任何 MCP 工具调用。Agent 对话、Workflow Tool 节点、个人助理都只能引用已发布的 Skill，**不存在平台内直连 MCP Server 的调用路径**。
2. **Workflow Tool 节点只能从 Skill 列表选择**，直连 MCP Server 的配置入口不存在；服务端校验 Tool 节点引用必须是已发布且运行者有权限的 Skill。
3. **MCP 权限按用户权限分配**：一个用户在创建/使用 Skill 时能看到的 MCP Server 清单，由其角色（user_roles）与部门决定。无权限的 Server 对该用户完全不可见（列表不出现、API 404）。
4. Skill 对使用者的可见与可安装同样受角色控制（复用 Skill Hub 已有的权限设计）。

## 两层结构

| 层 | 对象 | 菜单位置 | 使用者 | 管的是什么 |
|----|------|---------|--------|-----------|
| 连接层 | MCP Server 注册中心 | 侧边栏「安全与管理」→「MCP 管理」（新增) | 管理员/安全管理员 | Endpoint、认证、审批、可用角色/部门、限流、审计开关、安全等级 |
| 能力层 | MCP 型 Skill | Skill Hub（不变，五类型保留） | 开发者封装、全员按权限使用 | 工具白名单、参数/数据范围约束、文档、风险等级、评分 |

## 封装规范（Skill = 授权切面）

`skills.config`（jsonb，数据模型无需改列）结构约定：

```json
{
  "mcp_server_id": "<uuid>",
  "allowed_tools": ["search_contact", "get_department"],
  "param_constraints": { "scope": "本部门" },
  "readonly": true,
  "result_limit": 200,
  "masked_fields": ["phone", "id_number"]
}
```

- **按"能力域 × 权限级"拆分粒度**：同一 MCP Server 可封装为多个不同切面的 Skill（如「通讯录查询」低风险全员 vs「通讯录管理」高风险仅 HR）。
- **数据库类强制约束**：底层只读账号、库表白名单、select-only 校验、行数上限、敏感字段脱敏。

## 补足条款（治理闭环所需，Claude 建议并入）

1. **双重审批链**：MCP Server 注册须审批（连接可信）；引用它的 Skill 发布再审批（切面合理）。Server 审批通过 ≠ Skill 免审。
2. **禁用联动**：Server 被禁用/删除 → 引用它的全部 Skill 自动置为不可用并通知安装者；恢复后需人工重新启用 Skill。
3. **密钥安全**：`auth_config` 中的凭据加密存储（Supabase Vault / pgsodium），任何 API 响应不回显明文；轮换只在 MCP 管理页操作。
4. **审计贯通**：每次经 Skill 的 MCP 调用写 call_logs 时同时记录 `skill_id + mcp_server_id + tool_name`（detail jsonb），实现"从一次调用追溯到连接"的完整链路。
5. **限流分层**：Server 级 TPS（保护企业系统）与 Skill 级配额（业务策略）两层，先到先限。
6. **Skill 外的两类例外**（不经 Skill，由 MCP 中心直接治理，属阶段 6）：员工 Claude Code/IDE 端直连（配置下发+审计）；平台系统级集成（企微同步等，不进 Skill Hub）。

## 实施计划

| 项 | 内容 | 时机 |
|----|------|------|
| migration 0002 | mcp_servers 表（含角色/部门授权数组、状态机、RLS、软删除） | 已产出，随 db push 应用 |
| 菜单 | 「安全与管理」新增「MCP 管理」入口 | 切片 3（任务 4.3.0） |
| MCP 管理中心最小版 | 注册/列表/审批/启停 + 按权限过滤的 Server 清单 API | 切片 3（4.3.0） |
| Skill 创建表单 | MCP 型：Server 下拉（按权限过滤）+ 工具白名单勾选 + 约束配置 | 切片 3（4.3.1） |
| Tool 节点约束 | 只能选 Skill + 服务端校验 | 切片 4（4.4.2 验收标准） |
| 员工端直连治理 / 安全模式 A/B/C | 完整 MCP 网关能力 | 阶段 6 |

## 复审条件

MCP Server 数量 > 20 或出现跨租户共享 Server 需求；员工端直连正式启用时（阶段 6 需补网关设计）。
