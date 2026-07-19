# ADR-007：权限模型与角色-权限矩阵（RBAC）

- 状态：**待拍板**（2026-07-20 起草，冲刺 D1·D-2）
- 对应任务：ROADMAP 2.3（权限模型：角色定义 + API 级校验方案）
- 决策人：Perry
- 起草：Claude
- 依赖：2.2（ADR-002，请求契约 `{userId, orgId, roles}`）、2.4（`user_roles` 表，C4 多角色）
- 契约来源：PRD 2.8 成员管理 + `tests/e2e/fixtures/test-data.ts` 的 `ROLE_MATRIX`（用例先行，本矩阵必须兼容）

---

## 背景

ADR-002 定了"你是谁、属于哪家公司、什么职位（`roles`）"如何传到每个请求。本 ADR 回答下一个问题：**拿着某个职位，到底能做哪些操作、不能做哪些**，以及**这套判断在哪里、怎么强制执行**。

数据隔离（能不能碰"别家公司"的数据）由 RLS 兜底（ADR-002），**已解决**。本 ADR 只管**功能权限**（能不能做"这个动作"），是 ADR-002 的应用层第一道防线，对应落地任务 3.4「权限校验中间件」。

---

## 决策

### 1. 模型：RBAC + 按操作鉴权 + 默认拒绝

- 采用 **RBAC（基于角色的访问控制）**：权限不直接绑用户，而是绑「角色」，用户通过 `user_roles` 拿到角色。
- 鉴权粒度 = **操作（action）**，用命名空间字符串表示，如 `agent:create`、`agent:review`、`member:manage`。API 每个受保护动作声明它需要的 action。
- **默认拒绝（deny-by-default）**：矩阵里没写 `允许` 的，一律 403。新增功能必须显式进矩阵，漏配 = 拒绝（安全侧默认）。
- **多角色取并集**（C4）：一个用户可有多个角色（如同时是 Developer 和 Auditor），有效权限 = 各角色权限的**并集**（任一角色允许即允许）。

### 2. 四个角色（PRD 2.8，组织内 org-scoped）

| 角色 | 定位 | 一句话 |
|------|------|--------|
| **Admin** | 管理员 | 本租户内完全权限（含成员、审核、MCP 审批、配额查看） |
| **Developer** | 开发者 | 创建和管理 AI 资产（Agent/Skill/知识库/Workflow），但**不能审核、不能管成员** |
| **User** | 普通用户 | 只**使用**已发布的 AI 服务（对话、跑工作流、传文件），不创建资产 |
| **Auditor** | 审计员 | **只读 + 审核**：看全部资产、审批/驳回、读审计日志，但不创建不修改 |

> **跨租户的"平台超级管理员"**（SaaS 运营方开通企业、调整他人配额、暂停租户，PRD 2.9）**不在这 4 个组织内角色里**，是独立的平台级角色（`tenant:manage`）。MVP 冲刺中 D3·D-2（4.5.1 成员/4.5.2 租户）先按"Admin 管理本租户"实现，跨租户运营超管留到阶段 6，见 §5。

### 3. 角色-权限矩阵（本 ADR 的核心交付物）

✅=允许　❌=拒绝(403)。"own"=仅限本人创建的资源（应用层附加归属校验）。

| 模块 | 操作(action) | Admin | Developer | User | Auditor |
|------|-------------|:-----:|:---------:|:----:|:-------:|
| **Agent** | `agent:create` 创建 | ✅ | ✅ | ❌ | ❌ |
| | `agent:read` 查看 | ✅ | ✅ | ✅ 仅已发布 | ✅ |
| | `agent:update` 编辑 | ✅ | ✅ own | ❌ | ❌ |
| | `agent:delete` 删除 | ✅ | ✅ own | ❌ | ❌ |
| | `agent:submit` 提交审核 | ✅ | ✅ | ❌ | ❌ |
| | `agent:review` 审核批/驳 | ✅ | ❌ | ❌ | ✅ |
| | `agent:chat` 使用对话 | ✅ | ✅ | ✅ | ❌ |
| **Skill** | `skill:create` 创建 | ✅ | ✅ | ❌ | ❌ |
| | `skill:read` 查看 | ✅ | ✅ | ✅ 仅已发布 | ✅ |
| | `skill:update` / `skill:delete` | ✅ | ✅ own | ❌ | ❌ |
| | `skill:install` 安装 | ✅ | ✅ | ❌ | ❌ |
| | `skill:submit` 提交审核 | ✅ | ✅ | ❌ | ❌ |
| | `skill:review` 审核 | ✅ | ❌ | ❌ | ✅ |
| | `skill:test` 试跑 | ✅ | ✅ | ❌ | ❌ |
| **知识库** | `kb:create` / `kb:update` / `kb:delete` / `kb:upload` | ✅ | ✅ own | ❌ | ❌ |
| | `kb:read` 查看 | ✅ | ✅ | ❌ 经 Agent 间接 | ✅ |
| **Workflow** | `workflow:create`/`update`/`delete` | ✅ | ✅ own | ❌ | ❌ |
| | `workflow:read` 查看 | ✅ | ✅ | ✅ 仅已发布 | ✅ |
| | `workflow:run` 运行 | ✅ | ✅ | ✅ 仅已发布 | ❌ |
| | `workflow:submit` / `workflow:review` | 提交✅/审核✅ | 提交✅/审核❌ | ❌ | 审核✅ |
| **MCP** | `mcp:register` 注册申请 | ✅ | ✅ | ❌ | ❌ |
| | `mcp:approve` 审批 | ✅ | ❌ | ❌ | ❌ |
| | `mcp:read` 清单(权限过滤后) | ✅ | ✅ | ❌ | ✅ |
| | `mcp:toggle` 启停 | ✅ | ❌ | ❌ | ❌ |
| **成员** | `member:read` 查看 | ✅ | ✅ | ❌ | ✅ |
| | `member:manage` 邀请/改角色/启禁/删除 | ✅ | ❌ | ❌ | ❌ |
| **审计** | `audit:read` 读审计日志 | ✅ | ❌ | ❌ | ✅ |
| **文件** | `file:process` 上传处理下载 | ✅ | ✅ | ✅ | ❌ |
| **会话** | `conversation:own` 读写自己的会话 | ✅ | ✅ | ✅ | ✅ |
| **租户** | `tenant:read` 本租户配额/账单 | ✅ | ❌ | ❌ | ✅ |
| | `tenant:manage` 跨租户开通/配额/暂停 | ❌ 平台超管专属(§5) | ❌ | ❌ | ❌ |

**与 `ROLE_MATRIX` 契约的一致性核对**（11 条测试断言全部满足）：

| 契约断言 | 本矩阵 |
|---------|--------|
| Admin agent:create/review/member:manage = ✅ | ✅✅✅ 一致 |
| Developer agent:create ✅ / review ❌ / member:manage ❌ | 一致 |
| User agent:create ❌ / agent:chat ✅ | 一致 |
| Auditor agent:review ✅ / agent:create ❌ / audit:read ✅ | 一致 |

### 4. 强制执行方案（API 级，落地任务 3.4）

- **执行点**：Next.js API Route / Server Action 入口的**权限中间件**，读 ADR-002 注入的 `ctx.roles`，调 `requirePermission(ctx, 'agent:create')`，不满足直接 403。**绝不只靠前端隐藏菜单**（隐藏菜单只是体验，不是安全）。
- **权限映射单一数据源**：`lib/auth/permissions.ts` 导出 `ROLE_PERMISSIONS: Record<Role, Set<Action>>`（就是上表的代码化），中间件与 `ROLE_MATRIX` 测试共用同一张表，避免"文档一套、代码一套"。
- **两类校验分工**：
  - *动作权限*（能不能做这个动作）→ 本矩阵，中间件判。
  - *数据归属 own*（能不能改这条具体数据）→ 应用层查 `created_by == userId`（或 Admin 放行）；跨租户由 RLS 兜底（ADR-002）。
- **"已发布才可见"**：User 的 `*:read` 限已发布资产，通过 `where status='published'` 实现，不进权限矩阵（那是数据过滤，不是动作权限）。
- **审计**：所有 403 拒绝与敏感动作（review/member:manage/mcp:approve）写 `audit_logs`。

### 5. 平台超级管理员（跨租户，暂缓）

`tenant:manage`（开通企业、改他人配额、暂停租户）是 SaaS 运营方的能力，跨越 `org_id` 边界，**与 RLS 的租户隔离天然冲突**，必须用 service 客户端 + 独立超管鉴权，风险面完全不同。本 ADR **不把它塞进 4 个组织内角色**。MVP 冲刺 D3·D-2 的 4.5.x 先做"Admin 在本租户内邀请成员/查看配额"，真正的跨租户运营后台留阶段 6，届时新增 `platform_admin` 角色专题（可能独立鉴权体系）。

---

## 需要你拍板的判断点（3 个）

矩阵大部分由 PRD + 契约唯一确定，以下 3 处是我做的默认判断，请确认或推翻：

1. **Auditor 不能使用对话（`agent:chat`=❌）**：定位为"纯只读+审核"，不作为消费者。若你希望审计员也能试用 Agent 来判断该不该过审，改成 ✅。
2. **发布必须走审核**：Developer 只能 `submit`（提交），`review`（批准发布）仅 Admin/Auditor。即开发者不能自己发布自己的资产。若你要"Developer 可直接发布、审核只对企业级资产"，需调整。
3. **平台超管 `tenant:manage` 暂缓到阶段 6**（见 §5），MVP 里租户/成员管理按"Admin 管本租户"实现。

---

## 被否决的备选

| 方案 | 否决原因 |
|------|---------|
| 直接在数据库 RLS 里做角色细粒度控制 | RLS 擅长按 `org_id` 过滤"数据可见性"，做"动作权限"会让策略爆炸且难测；migration 0001 已注明角色控制放应用层 |
| 前端按角色隐藏菜单即可 | 隐藏 ≠ 安全，构造请求即可绕过；必须服务端强制 |
| 给每个用户单独配权限（ACL） | 企业场景角色稳定，ACL 维护成本高、不可预测；RBAC 足够且可测 |
| 单角色（用户只能一个角色） | 与数据模型 C4 多角色冲突，且现实中"开发者兼审计"存在；用并集 |

## 连带决定与落地清单

- 新建 `lib/auth/permissions.ts`（`Role`/`Action` 类型 + `ROLE_PERMISSIONS` 表 + `hasPermission()`）——3.4 落地，A/相关道建。
- 新建 `requirePermission()` 中间件包裹受保护 API——3.4。
- `ROLE_MATRIX`（test-data.ts）在 3.7 隔离/权限专项里逐条断言（对应 S0 权限组用例）。
- 本矩阵是**动作权限单一事实来源**：新增任何写操作 API，必须先在矩阵登记 action，再实现（否则默认拒绝）——写入 CLAUDE.md 约定。

## 复审条件

- 引入平台超管 / 跨租户运营后台时（阶段 6）重开，新增 `platform_admin`。
- 出现"部门级权限"（PRD 提到 MCP 按部门过滤）需求扩展时：当前 `department` 是文本字段（C1），升级组织架构（切片 5）后可能引入"角色×部门"二维权限，届时本 ADR 增补。
