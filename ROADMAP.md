# AIPaddle 任务执行清单（ROADMAP）

> **术语说明（2026-07-19）**：本文档及测试用例中历史提法"切片 N"已在项目管控中取消，对应关系：切片 0=**地基**、1=**Agent**、2=**知识库**、3=**Skill·MCP**、4=**工作流**、5=**成员租户**。任务编号（3.x、4.x.x）保持不变。与 Claude Code 的交互粒度 = 单个任务（Issue，≤2h），非批次；跨批次须过质量关口由用户验收放行。

> 版本 v2.0 · 更新日期 2026-07-18
> 基准：仓库现状 + `docs/IMPLEMENTATION_AUDIT.md` + `docs/requirements/PRD_Core_v1.04.md`
> 状态标记：✅ 已完成 · 🔄 进行中 · ⬜ 未开始 · ⏸ 暂缓（有触发条件才做）
>
> **使用规则**：
> 1. Claude Code 在执行任何 AIPaddle 相关任务前，必须先读取本文件，向用户确认当前对应的任务编号后再动工（详见 `CLAUDE.md`）。
> 2. **进度追踪权威 = 仓库内文档（2026-07-21 起，替代 GitHub Issues）**：账号迁移后旧 Issue 已失，改为本文件 + `docs/ISSUES.md`（开放任务/缺陷台账，带编号如 `[4.1.2]`/`[BUG-73]`）+ 进度 Excel 三处协同；不再用 `gh issue` 追踪进度。
> 3. 小批量执行：单个任务粒度 ≤ 2 小时，一次只做一件事。**改动先落本地文件；push/PR 须过双闸（阶段测试通过 + 用户同意），详见 `CLAUDE.md` 规则 9**。
> 4. **测试策略见 `docs/TESTING.md`**（六层测试 × 五个时机）；**测试的自动执行、Issue 回帖、自动修复与 Codex 交叉测试按 `docs/TESTING_WORKFLOW.md` 协议**。每个 Issue 必须走完模板里的 9 步执行清单才能关闭。
> 5. **测试用例库见 `docs/test-cases/`**（98 条，按工作节点映射）：建 Issue 时把该任务编号名下的用例 ID 填入「验收标准」栏，执行结果按用例 ID 逐条回帖。

---

## 项目现状判定（基于实现审计）

当前仓库是**覆盖主要模块的高保真前端原型**：页面和演示数据已就绪（数据来自 `lib/mock-data.ts`），但认证、持久化 API、权限校验、工作流执行引擎和实时监控尚未接入。所有涉及"创建/修改/删除/审批/发布/聊天/计费/执行"的能力都还没有形成业务闭环。

因此接下来的主线只有一件事：**把原型变成有真实数据闭环的产品**，顺序遵循审计报告的建议交付顺序。

---

## 总览

| 阶段 | 名称 | 状态 | 说明 |
|------|------|------|------|
| 0 | 环境与工程基础 | 🔄 大部分完成 | 补齐部署与 Issue 工作流 |
| 1 | 产品定义 | ✅ 基本完成 | PRD v1.04 + UI 规范已就绪 |
| 2 | 后端架构设计 | ⬜ **当前优先级最高** | 前端已定，后端选型和数据模型未定 |
| 3 | 基础设施闭环（切片 0） | ✅ | 认证、租户上下文、权限、数据层跑通；S0 隔离/权限全绿、关口3 已过（2026-07-20）；余 3.6 部署独立跟进 |
| 4 | 功能切片开发 | 🔄 | **已解禁（2026-07-20）**；切片1 Agent（4.1.x）+ 切片2 知识库（4.2.x，D 道）等并行推进 |
| 5 | 真实用户验证 | ⬜ | 第一条闭环跑通后即启动 |
| 6 | 平台化收尾 | ⏸ | 计费、MCP、安全审计、实时监控 |

**铁律**：2 未完成不得进入 3；3 未完成不得开始 4 的任何切片。

---

## 阶段 0：环境与工程基础

| # | 任务 | 状态 | 检测标准 |
|---|------|------|---------|
| 0.1 | Git 仓库与 GitHub | ✅ | 仓库已建，代码已托管 |
| 0.2 | Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui 脚手架 | ✅ | `pnpm dev` 可跑 |
| 0.3 | 质量检查脚本（`pnpm check` = typecheck + lint + build） | ✅ | 本地执行通过 |
| 0.4 | CLAUDE.md 入库 | 🔄 | 本次生成，放仓库根目录 |
| 0.5 | ROADMAP.md 入库（本文件） | 🔄 | 放仓库根目录 |
| 0.6 | 建立 GitHub Issues 工作流 | 🔄 | Issue 模板已入库；标签体系已定义（`type:ui/logic/api/infra/slice-acceptance` + `flag:tenant-data/rag`，见 TESTING_WORKFLOW.md §1）；待做：在 GitHub 上创建这些标签、把阶段 2-3 任务批量建成 Issue |
| 0.7 | 服务器部署链路（43.173.99.218，Ubuntu） | ✅ | 已全新部署 main → `/opt/aipaddle`（PM2 托管 3000 + 开机自启）+ Nginx 反代到 `https://aipaddle.net`；用户隐私窗口登录验收通过（2026-07-20）；Issue #52 已关闭 |
| 0.8 | 自动化部署（GitHub Actions：push main → 自动部署到服务器 + 部署后冒烟检查） | ✅ | `.github/workflows/deploy.yml` 已入库，git-pull 方案（并发保护 + 6次冒烟retry）；`DEPLOY_SSH_KEY`（ed25519）已配；冒烟 HTTP 200 通过（2026-07-20，run #29741561949）；Issue #55、#77 已关闭 |
| 0.9 | 测试基建：装 Vitest + React Testing Library + Playwright；`pnpm test` / `pnpm test:e2e` 可用；启用 ci.yml 中注释掉的测试步骤 | 🔄 | **✅ 0.9a(D1-C-1) Playwright 已装+首跑**：装 chromium、加 `test:e2e`/`test:smoke` 脚本，原型冒烟 6 条全绿（P-GLB-01/02/04、P-DSH-01、P-AGT-02、P-WF-01；P-AGT-01/03、P-WF-02 等为人工记录型，不做自动化）。**✅ 0.9b(D1-C-2) Vitest+RTL 已装+启用 CI**：`vitest.config.ts`（jsdom）+ `tests/unit/setup.ts`，加 `test`/`test:watch` 脚本，样例 7 条全绿（cn 工具 4 + Button 组件 3），ci.yml 已取消注释单元测试步骤。**待做**：0.9c 开 main 分支保护 |

---

## 阶段 1：产品定义 ✅ 基本完成

| # | 任务 | 状态 | 检测标准 |
|---|------|------|---------|
| 1.1 | PRD（`docs/requirements/PRD_Core_v1.04.md`） | ✅ | 已有 v1.04 |
| 1.2 | UI 设计规范（`UI_Design_Spec_v1.04.md`） | ✅ | 已有 v1.04 |
| 1.3 | 实现审计（`docs/IMPLEMENTATION_AUDIT.md`） | ✅ | 已明确各模块"UI 原型 vs 闭环"边界 |
| 1.4 | 确定 MVP 首个闭环场景 | ✅ | **已拍板（2026-07-20）**：Agent 管理（切片 1）作为 MVP 第一条端到端闭环，依次执行 4.1.1→4.1.6 |
| 1.5 | 种子用户画像与名单（为阶段 5 做准备） | ⬜ | 列出 5-10 个目标企业/用户 |

**⚠️ 检测关口 1**：1.4 确认之前，不启动阶段 4 的任何切片。

---

## 阶段 2：后端架构设计 ⬜（当前优先级最高）

**目标**：把"前端原型"背后的地基定下来。全部是设计决策 + 文档，代码量很小。

| # | 任务 | 状态 | 检测标准 |
|---|------|------|---------|
| 2.1 | 后端形态选型 | ✅ | **已决策（2026-07-18）**：Next.js API Routes 单体 + Supabase 云托管（Postgres/Auth/Storage/pgvector），区域选新加坡或东京；浏览器永不直连 Supabase。详见 `docs/adr/ADR-001-backend-architecture.md` |
| 2.2 | 认证与多租户方案：登录方式、租户上下文如何传递、`org_id` 隔离策略 | ✅ | **ADR-002 已拍板（2026-07-20）**：认证=Supabase Auth+服务端会话；上下文=`org_id` 进 JWT claim，请求契约 `{userId,orgId,roles}`；RLS 关键决策=请求级客户端（RLS 生效）vs 服务级客户端（锁死 `lib/db/admin.ts` 单文件）严格分工，禁 service_role 应答用户请求；含 3 张时序图 + migration `current_org_id()` 改法。详见 `docs/adr/ADR-002-tenant-context-rls.md` |
| 2.3 | 权限模型：角色定义（参照 PRD 成员/租户模块），API 级校验方案 | ✅ | **ADR-007 已拍板（2026-07-20）**：RBAC + 按操作(action)鉴权 + 默认拒绝 + 多角色并集；4 角色×全模块权限矩阵（兼容 `ROLE_MATRIX` 契约）；**PRD 角色映射 + 统一上架审核流程**（Agent/Skill/Workflow·Chatflow 三资产共用 draft→pending→published 状态机；部门级 Admin/Auditor 单审，**企业级仅 Admin 创建、Admin 必审 + 可指派 AIBP 协同双签**）；执行=API 入口 `requirePermission()`（3.4），单一来源 `lib/auth/permissions.ts`；跨租户平台超管暂缓阶段 6。详见 `docs/adr/ADR-007-rbac-permission-model.md` |
| 2.4 | 数据模型设计：核心表 + ERD | ✅ | **v1.0 已确认（2026-07-18）**：16 张表，C1 文本部门 / C2 统一中间表 / C3 分表 / C4 多角色 / C5 1536 维 / C6 全表软删除；migration 已产出 `supabase/migrations/0001_initial_schema.sql`（含 RLS/索引/审计防篡改）。**已应用到 Supabase 项目**（2026-07-19，0001+0002 迁移落库，18 表就绪）|
| 2.5 | 统一 API 客户端与数据层设计（替换组件直接消费 mock 的现状） | ✅ | **ADR-008 已拍板（2026-07-20）**：四层单向依赖（组件→API/Action→`lib/data/*`→Supabase 客户端）；组件禁直连 mock/supabase；`lib/data/*` 唯一碰库、首参 `ctx`、`server-only`；Repository 模式包 mock 逐页切（配合 3.5）；命名对齐现状 `lib/supabase/`。铁律已写入 CLAUDE.md。详见 `docs/adr/ADR-008-data-access-layer.md` |
| 2.6 | 「不自己造的轮子」清单 | ✅ | 认证 = Supabase Auth、存储 = Supabase Storage、向量库 = pgvector（ADR-001）；模型网关 = 首版不引入，直连 Moonshot（ADR-003）；支付 = 阶段 6 再选 |
| 2.8 | Vibe Coding 执行架构（ADR-005） | ✅ | **已拍板（2026-07-18，范围收缩版）**：仅限对话创建 Skill/Workflow/Agent 资产，无通用软件开发能力 → **无需沙盒、无独立执行服务、服务器不部署 Claude Code**，回归单体；四道防线替代隔离；Code 节点首版禁用；Copilot 任务并入切片 1/3/4（4.1.6/4.3.3/4.4.5）；PRD 升 v1.07 增 2.11 章 |
| 2.7 | 大模型接入方案 | ✅ | **ADR-003 已拍板并于 2026-07-20 修订：默认 LLM Kimi → 通义 Qwen（qwen-plus）**；Agent 级 config.model 可调配，Key（`DASHSCOPE_API_KEY`）只存服务器环境变量，call_logs 记用量。**嵌入模型结案 → ADR-009**：通义 `text-embedding-v4 @1536 维`，与对话**同供应商同一把 Key**（一家全包），对齐 pgvector `vector(1536)`；解锁 4.2.2。换模原因：Kimi/DeepSeek 均无 embedding 接口，通义 chat+embedding 一家覆盖 |

**⚠️ 检测关口 2**：2.1-2.4 的每份 ADR 你必须真的看懂并拍板，这是后面验收 AI 代码的基础。

---

## 阶段 3：基础设施闭环（切片 0，审计建议交付顺序第 1 条）

**目标**：认证 + 租户上下文 + 权限 + 统一 API 客户端跑通。做完后任何页面都能"登录 → 带租户身份调 API → 数据落库 → 刷新不丢"。

| # | 任务 | 状态 | 检测标准 |
|---|------|------|---------|
| 3.1 | 数据库就绪，建核心表 | ✅ | 迁移 0001/0002 已落库（18 表），seed 两租户五账号，test-data 已对齐；PR#51 CI 绿，待验收 |
| 3.2 | 注册/登录/退出（用现成认证方案，不自己写） | 🔄 | Supabase Auth 注册/登录/退出 + 中间件守卫；修复 /auth/callback 路由断链；PR#51 CI 绿。**⚠️ 线上验证（2026-07-20）发现登录按钮偶发卡「登录中...」不跳转（会话其实已建立）→ Issue #72** 待修 |
| 3.3 | 租户上下文中间件（每个请求解析出 user + org） | ✅ | `lib/context.ts` `getRequestContext()`已实现（commit 267043b7）；L2 权限矩阵 19 条 + L3 API 集成 9 条全绿（35条/35条）；Issue #57 进行中；**✅ 自动化已验证**（S0-ISO 隔离专项 UI+API 两层全绿，PR #79）；**待你亲手走查**：两租户账号互相看不到数据 → 通过后关闭 #57 |
| 3.4 | 权限校验中间件（API 级，不只靠菜单隐藏） | ✅ | `lib/auth/permissions.ts`（ADR-007矩阵）+ `POST /api/agents` 403门已实现（commit 75df1797）；单元测试覆盖全角色×action矩阵；Issue #58 进行中；**✅ 自动化已验证**（S0-PRM-02：User POST /api/agents → 403，PR #79）；**待你亲手走查**后关闭 #58 |
| 3.5 | 统一 API 客户端 + 数据层，第一个页面（如 Dashboard）从 mock 切换到真实 API | ✅ | `lib/data/agents.ts`（listAgents/createAgent 含 DB→Agent 映射）+ `lib/api/client.ts`（apiFetch）+ GET /api/agents 已实现；**DashboardShell 完整外壳**（侧边栏+多视图路由）已从 feat/3.5-app-shell 合并入 main（commit f58a31e8）；Issue #61 进行中。**⚠️ 线上验证（2026-07-20，B道）**：侧边栏渲染✅、`/api/agents` 返真实数据✅、**租户隔离实测通过**（orgB 看不到 orgA agent）；但发现 3 缺陷——点二级菜单不切换视图(#73)、监控指标与侧栏用户仍 mock(#74)、agents-admin 未消费 /api/agents(#75)。**✅ 已修（PR #79）**：侧边栏组织名接真实 org（#74 组织名部分）、新增 `/api/agents/[id]`；**遗留**：#73 菜单切换、#74 监控指标 mock、#75 agents-admin 切真实数据（3.5 收尾） |
| 3.6 | 部署到服务器验收（依赖 0.7） | ⬜ | 代码已就绪（main 最新）；**待做**：配 `DEPLOY_SSH_KEY` Secret 后自动部署，或手动 rsync；线上打开侧边栏+登出确认正常 → 关闭 Issue #59 |
| 3.7 | 第一批自动化测试（认证与权限的关键路径）+ 租户隔离专项脚本（TESTING.md L5①） | ✅ | L2 权限矩阵 19 条 + L3 API 集成 9 条（35条 CI 全绿）；**✅ 租户隔离专项 S0-ISO 已全绿（2026-07-20，PR #79）**：UI 层（B 租户看不到 A org 名/数据）+ API 层（越权读/写/ID 猜测均 404）；**完整 @stage0 12 条全绿**（AUTH 7 + ISO 2 + PRM 2 + DAL 1，含修复 flaky login/注册/选择器）→ Issue #60 |

**✅ 检测关口 3 已关闭（2026-07-20）**：S0-ISO 隔离专项 UI+API 两层全绿、完整 @stage0 12/12 绿，**用户亲手走查通过**（#57/#58/#60/#61 已关闭）。**Phase 4 正式解禁**，可开始功能切片。3.6 服务器部署验收独立跟进（不阻塞切片开发）。

---

## 阶段 4：功能切片开发（按审计建议顺序）

**方法**：每个切片 = 一条用户能走通的端到端路径。固定循环：`描述任务 → AI 写码 → 亲手验证 → 补测试 → git 提交 + 部署 → 关闭 Issue → 更新本清单`。

### 切片 1：Agent 管理端到端闭环（审计建议第 2 条）⬜

现状：搜索/页签/详情抽屉已有（UI ✅），增删改、状态流转、日志、API 全缺。

| # | 任务 | 状态 | 检测标准 |
|---|------|------|---------|
| 4.1.1 | Agent CRUD API + 页面接通（列表/创建/编辑/删除） | ✅ | CRUD 闭环（增删改查 + 8 单测）已并入 main（PR #5）；agents-admin 接真实数据、跨租户隔离生效；待用户线上亲验 |
| 4.1.2 | 状态机：草稿 → 待审核 → 已发布 → 停用（含校验规则） | 🔄 待验收 | `lib/agents/status.ts`（5 条合法流转表）+ 数据层 `transitionAgent`（原子条件更新，当前态≠from→非法）+ `POST /api/agents/[id]/transition`（submit=agent:submit / approve·reject=agent:review / offline·online=agent:update，非法流转 409）+ UI 按状态+权限渲染动作；12 测试全绿；本地完成待用户同意提批次 |
| 4.1.3 | 审核流程接入安全管理模块（审批提交、留痕） | 🔄 待验收 | 状态机流转联动：submit→建 `security_reviews` pending 记录；approve/reject→裁决更新 + `reviewer_id/reviewed_at`；各动作写 `audit_logs`（不可篡改）。`lib/data/reviews.ts`(record/list) + `audit.ts`(writeAudit)；security 页接 `listReviews` 真实数据、SecurityView 加 `reviews` prop（空回落 mock）；+4 审批留痕测试；本地绿待用户同意提批次 |
| 4.1.4 | Agent 调用：接通真实大模型 API | 🔄 待验收 | `POST /api/agents/[id]/chat`（加载 config→systemPrompt→`lib/ai.chat` qwen-plus）+ 数字员工页真实对话接线；防前端 system 注入；7 测试 + 实测通义回答与配置相符 |
| 4.1.5 | 调用日志落库与展示 | 🔄 待验收 | chat 落 `call_logs`（真实 token/延迟/成败）+ `GET /api/agents/[id]/logs` + agents-admin 详情展示真实调用数/最近调用；`chatWithUsage` 取用量；3 测试 |
| 4.1.6 | **Agent Copilot 最简版**（ADR-005）：配置页"AI 帮我建"侧栏，描述→生成配置草稿→落 draft 态 | ⬜ | 生成物过 Schema 校验；AI 不能触发发布；生成动作留审计 |

### 切片 2：知识库闭环（审计建议第 3 条前半）⬜

> 📐 **前置设计已就绪（2026-07-20，D 道）**：`docs/design/knowledge-base-spec.md` —— 上传/存储桶布局、切块参数默认值、通义 v3 向量化、RAG 检索+引用+删除失效、数据层接口，地基（3.3/3.5）就绪后照此施工。

| # | 任务 | 状态 | 检测标准 |
|---|------|------|---------|
| 4.2.1 | 文档上传（先只支持 PDF）+ 存储 | ✅ | **已完成（2026-07-20，A道，PR#83）**：Storage 私有桶 kb-documents + lib/data/documents+knowledge + /api/documents(GET/POST/DELETE)；上传201→列表→删除200 全验证；附 migration 0003 修全表软删 RLS |
| 4.2.2 | 解析/切块/向量化入库 | ✅ | **已完成(2026-07-20,A道)**:unpdf解析→切块→DashScope v4嵌入(1536)→chunks表 |
| 4.2.3 | Agent 关联知识库，问答带引用（RAG） | 🔄 | **本地完成待批量合(2026-07-21,A道,feat/slice2-knowledge)**:pgvector检索(migration0004)+qwen带引用+拒答;金标准7/7=100% |
| 4.2.4 | **办公文件处理·通道①**（ADR-006）：上传→AI处理→生成 docx·xlsx·pdf→下载 | 🔄 | **本地完成待合(2026-07-21,A道)**:3格式均生成有效文件+审计;PDF中文字体待接 |

### 切片 3：Skill Hub 持久化 ⬜

| # | 任务 | 状态 | 检测标准 |
|---|------|------|---------|
| 4.3.0 | **MCP 管理中心最小版**（ADR-004）：「安全与管理」新增菜单入口；Server 注册/列表/审批/启停；`my_mcp_servers` 按角色+部门过滤的清单 API | ⬜ | 无权限用户列表不可见（404）；Server 禁用联动禁用引用它的 Skill |
| 4.3.1 | Skill CRUD + 安装/发布 + 版本管理；**MCP 型 Skill 封装表单**（Server 下拉按权限过滤 + 工具白名单 + 范围约束） | ⬜ | 全流程亲手走通；封装规范符合 ADR-004 |
| 4.3.2 | Skill 调用测试入口 | ⬜ | 能在线试跑一个 Skill；调用日志带 skill_id + mcp_server_id + tool_name |
| 4.3.3 | **Skill Copilot**（ADR-005）：描述→生成封装草稿（含从 my_mcp_servers 推荐 Server 与工具白名单） | ⬜ | 推荐范围不越权（S3-08 联动）；草稿态+审计 |
| 4.3.4 | **办公文件处理·通道②**（ADR-006）：企业云盘 MCP 接入——飞书云文档/金山 WPS/**企业微信微盘**（自建 Server）/OneDrive，读写分切面封装 Skill | ⬜ | 云盘读写走 MCP 治理原路（S3-08/09 覆盖）；企微微盘 Server 过注册审批 |

### 切片 4：Workflow 保存与执行（审计建议第 3 条后半）⬜

现状：编辑器拖放/缩放已有（UI ✅），保存、连线编辑、版本、运行全缺。

| # | 任务 | 状态 | 检测标准 |
|---|------|------|---------|
| 4.4.1 | 图结构校验 + 保存/加载 | ⬜ | 刷新后画布原样恢复；非法图（孤立节点、环）被提示 |
| 4.4.2 | 节点配置持久化 + 连线编辑；**Tool 节点只能引用已发布 Skill**（ADR-004 铁律，无直连 MCP 入口） | ⬜ | 编辑后保存可复现；构造直连 MCP 的请求被服务端拒绝 |
| 4.4.3 | 最小执行引擎（先支持 2-3 种节点类型串行执行） | ⬜ | 一条 3 节点工作流能运行出结果并显示每步状态 |
| 4.4.4 | 版本发布与运行历史 | ⬜ | 可回看历史版本和运行记录 |
| 4.4.5 | **Workflow/Chatflow Copilot**（ADR-005 交互协议）：意图识别跳转（右对话左画布）→ 流式生成 → **画布下方澄清面板**（缺失配置勾选回填）→ 手动调配双向协同；Dify DSL 硬约束；Code 节点禁用 | ⬜ | 三场景验收（PRD v1.09）：跳转带原文、澄清回填即时上屏、AI 产物与手工编辑同构；含代码节点的图 422 |

### 切片 5：成员与租户管理闭环 🔄

| # | 任务 | 状态 | 检测标准 |
|---|------|------|---------|
| 4.5.1 | 成员邀请/编辑/禁用/角色变更 | 🔄 | **代码已合并 main（PR #6）**：成员 API（`api/members`+`[id]`）+ `lib/data/members.ts` + 页面接真实数据；47 测试全绿。待用户线上验收（禁用成员立即无法登录）转 ✅ |
| 4.5.2 | 租户创建/编辑/停用 + 配额基础 | 🔄 | **代码已在 main（本租户查看+编辑）**：`lib/data/tenant.ts`（`getTenant` 信息+配额+用量 / `updateTenant` 编辑）+ `GET(tenant:read)`/`PATCH(tenant:manage)` `api/tenant` + settings 页；单元测试绿。待用户线上验收转 ✅。**跨租户开通/停用=平台超管，阶段 6**（ADR-007） |

**⚠️ 检测关口 4（每周）**：本周能演示什么新东西？答不上来 = 任务切大了，砍半。

---

## 阶段 5：真实用户验证（切片 1 完成后即启动，持续进行）

| # | 任务 | 状态 | 检测标准 |
|---|------|------|---------|
| 5.1 | 邀请 3-5 个种子用户试用 Agent 闭环 | ⬜ | 每人一页观察笔记（卡点/疑问/未用功能） |
| 5.2 | 反馈汇总 → 调整切片优先级 | ⬜ | 产出调整后的切片顺序 |
| 5.3 | 第二轮验证 | ⬜ | 上轮卡点不再出现 |

**⚠️ 检测关口 5**：没有用户主动第二次使用，先回头改场景，不写新功能。

---

## 阶段 6：平台化收尾 ⏸（审计建议第 4 条，有真实需求才做）

| # | 方向 | 触发条件 |
|---|------|---------|
| 6.1 | 租户计费与账单 | 有客户愿意付费 |
| 6.2 | MCP 接入 | 有客户明确要求 |
| 6.3 | 安全审计完整留痕与策略执行 | 有企业客户合规要求 |
| 6.4 | 实时监控与告警 | 线上有稳定流量 |
| 6.5 | 租户内部管理（PRD 2.10：组织/角色/访问控制/配额页面） | 有团队型客户 |

---

## 附：小批量执行的 5 条军规

1. 任务粒度 ≤ 2 小时，说得出"做什么、不做什么、怎么验证"才开工。
2. 一次只让 AI 做一件事；先建 Issue 再动工。
3. 每天收工三件事：亲手验证 → git 提交 → 关 Issue / 更新本清单。
4. 卡住 30 分钟就换方法：换思路、回退重来、或把任务再拆小。
5. 每周五自问：能演示什么？下周最重要的一个切片是什么？

---

> **⚡ 冲刺模式（2026-07-19 用户强制拍板）**：全部开发任务压入 D1-D3 三天，5 条 CLI 并行道（A 数据/B 部署与Skill/C 测试与工作流/D 设计与租户/E 集成），测试以天为单位每晚打包执行（日结包①②③）。串行硬约束以红字标注于进度 Excel「任务清单」末列与「三天全量冲刺」表。冲刺期间批次关口压缩为两个：D2 早隔离专项（唯一硬闸）+ D3 晚终验收。**风险留档**：本计划移除批次缓冲，工程估算约 120-180 小时 vs 3×5 道理论容量，实际完成度取决于并行效率与修红速度；用户测试（5.2-4）与阶段 7 不在冲刺范围。

## 决策日志

| 日期 | 决策 | 记录 |
|------|------|------|
| 2026-07-18 | 后端 = Next.js API Routes 单体 + Supabase 云托管；保留现有前端技术栈不精简 | ADR-001 |
| 2026-07-18 | 测试策略：六层测试（静态/单元/集成/E2E/专项/人工）；工具 Vitest + RTL + Playwright；CI 上 GitHub Actions；每个 Issue 走 9 步执行清单 | docs/TESTING.md |
| 2026-07-18 | 测试自动执行协议：Issue 标签→测试集映射；结果 `gh` 自动回帖；失败自动修复 ≤3 轮（只修代码不改测试）；用户验收前 Codex CLI 只读交叉审查 | docs/TESTING_WORKFLOW.md |
| 2026-07-18 | 测试用例库 v1.0：依据 PRD v1.04 + 原型现状编写 98 条用例（P0 30 条），按原型/切片 0/1/2/3-5 分五档，逐条映射到 ROADMAP 任务节点与 Issue 验收标准 | docs/test-cases/ |
| 2026-07-18 | 数据模型 v1.0 拍板：部门文本字段、Agent 资源统一中间表、对话/计量分表、多角色 user_roles、向量 1536 维、全业务表软删除；16 张表 migration 入库 | docs/design/ERD 确认页 + supabase/migrations/0001 |
| 2026-07-18 | LLM 接入拍板：默认 Kimi 2.5（Moonshot API），Agent 级可调配；首版不上模型网关；向量库确认为 Supabase pgvector（服务器无需装向量组件）；PRD 升 v1.05 增设第 10 章技术决策索引 | ADR-003 / PRD v1.05 |
| 2026-07-18 | MCP 治理拍板（ADR-004）：平台内全部 MCP 能力强制封装到 Skill（含组织架构/数据库类）；MCP 清单按用户角色+部门权限过滤；两层结构（mcp_servers 注册中心 + Skill 授权切面）；双重审批、禁用联动、密钥加密、审计贯通、限流分层；PRD 升 v1.06；migration 0002 入库 | ADR-004 / PRD v1.06 |
| 2026-07-18 | Vibe Coding 范围收缩拍板（ADR-005）：仅限对话创建 Skill/Workflow/Agent，无通用软件开发能力；**无需沙盒**（结构化生成+四道防线），撤销架构豁免回归单体，服务器不部署 Claude Code；Code 节点首版禁用；PRD 升 v1.07 新增 2.11 章 | ADR-005 / PRD v1.07 |
| 2026-07-18 | 办公文件处理拍板（ADR-006，高优先级基础能力）：三通道——上传处理下载（并入切片2）、企业云盘 MCP 含企微微盘（并入切片3）、浏览器授权直读写（二期）；AI 只调内置文件工具，延续无沙盒模型；PRD 升 v1.08 增 2.12 章 | ADR-006 / PRD v1.08 |
| 2026-07-18 | Copilot 交互场景规范拍板：意图识别跳转（右对话左画布）、画布下方澄清面板（勾选回填）、Dify DSL 硬约束（AI 产物与手工同构）；PRD 升 v1.09，ADR-005 增交互协议，新增用例 CP-07~10 | ADR-005 / PRD v1.09 |
| 2026-07-18 | 阶段性 E2E 套件入库：PRD 全量功能的 Playwright 可执行规格（S0-S5，含两租户五账号、状态机矩阵、金标准问答等具体测试数据），以 `E2E_STAGE` 环境变量按切片逐步启用；测试数据文件是 seed 脚本的契约 | tests/e2e/ |
| 2026-07-20 | 认证与租户隔离拍板（ADR-002，冲刺 D1·D-1）：认证=Supabase Auth+`@supabase/ssr` 服务端会话（首版邮箱密码）；租户上下文=`org_id`+`roles` 进 JWT claim，全链路请求契约 `{userId,orgId,roles}`（只由服务端从可信会话推导，禁信前端入参）；**RLS 关键决策**=请求级客户端（带用户 token，RLS 生效，第二层）vs 服务级客户端（`service_role` 锁死 `lib/db/admin.ts` 单文件，仅系统级操作）严格分工，禁 service_role 应答用户请求，靠"单文件封装+ESLint 禁读密钥+CI+CodeReview"四道约束落地双层防护；migration `current_org_id()` 改为读 JWT claim+回退查表（A 道随 3.3 落地） | ADR-002 |
| 2026-07-20 | 权限模型拍板（ADR-007，冲刺 D1·D-2）：RBAC+按操作(action)鉴权+默认拒绝+多角色并集；4 角色（Admin/Developer/User/Auditor）×全模块角色-权限矩阵（兼容 test-data `ROLE_MATRIX`）；**按 PRD 补齐统一上架审核流程**：Agent/Skill/Workflow·Chatflow 三资产共用 draft→pending→published 状态机，部门级 Admin/Auditor 单审，**企业级仅 Admin 创建、Admin 必审 + 可指派业务部门 AIBP 协同双签**（AIBP 部门自动路由待切片 5）；执行=API 入口 `requirePermission()`（落地 3.4），单一来源 `lib/auth/permissions.ts`；跨租户 `tenant:manage` 平台超管暂缓阶段 6；Auditor 不可 chat | ADR-007 |
| 2026-07-20 | 数据层设计拍板（ADR-008，冲刺 D1·D-3）：四层单向依赖（组件→API/Action→`lib/data/*`→Supabase 客户端）；组件禁直连 mock/supabase，`lib/data/*` 唯一碰库+首参 `ctx`+`server-only`；浏览器薄封装 `lib/api/client.ts` 只打 `/api/*`；Repository 模式包 mock 逐页切（配合 3.5，全切完删 mock-data.ts）；命名对齐现状 `lib/supabase/`（service 客户端=`lib/supabase/admin.ts`）；铁律写入 CLAUDE.md | ADR-008 |
| 2026-07-20 | **LLM 换供应商：Kimi → 通义 Qwen（ADR-003 修订）**：查证 Kimi/DeepSeek 均无 embedding 接口，GLM 有但 1536 维/OpenAI 兼容未确认；改用**通义（百炼）一家全包**——对话 `qwen-plus` + 嵌入 `text-embedding-v3`，共用一把 `DASHSCOPE_API_KEY`、一份账单；环境变量 `MOONSHOT_API_KEY`→`DASHSCOPE_API_KEY`；PRD 技术索引/ADR-005/copilot 同步换名 | ADR-003 |
| 2026-07-20 | 嵌入模型选型拍板（ADR-009）：**通义 text-embedding-v3 输出 1536 维**（OpenAI 兼容、中文强、国内低延迟、免运维），对齐 pgvector `vector(1536)`，与 LLM 同供应商同 Key；封装 `lib/llm/embedding.ts` 单点、Key 存服务器；建议 migration 给 `chunks` 补 `embedding_model/dim`（交 A 道）；已开通 DashScope Key，配 `.env.local`；解锁 4.2.2 向量化 | ADR-009 |
| 2026-07-20 | 线上部署验证（B 道，D1-B 后）：aipaddle.net 登录/会话✅、`/console` iframe 门户✅、DashboardShell 侧边栏✅、`/api/agents` 返真实 DB 数据✅、**租户隔离实测通过**（orgA 见自己 agent，orgB 返空）；发现 4 缺陷入排期：#72 登录卡「登录中...」/ #73 侧边栏二级菜单不切换视图 / #74 监控指标+侧栏用户仍 mock / #75 agents-admin 未接 /api/agents | Issues #72-75 |
| 2026-07-20 | D1-E 集成任务显式化（E道D1职责=合并/修红/部署，冲刺表原未排编号）：用 GitHub 侧原子合并集成绿灯 PR、合并后复核 main CI 绿、确认自动部署与线上正常；E道纪律=不产新功能，合并前检查无 MERGE_HEAD/锁避免撞车 | Issue #77 |

## 当前状态小结（2026-07-20 · 第 6 次更新）

- ✅ **已完成**：前端原型（11 个模块 UI）、PRD v1.04、UI 规范、实现审计、全部 ADR（001~009）、数据库 18 张表+seed、认证闭环、服务器部署链路（0.7）、**GitHub Actions 自动部署（0.8）**、Vitest+RTL+Playwright 测试基建（0.9a/0.9b）、Phase 3 全部（3.1~3.5/3.7，关口3已过）、D1-E 集成（#77）
- 🔄 **进行中**：
  - **3.6** 服务器部署人工验收（不阻塞 Phase 4）→ Issue #59
  - **4.1.1** Agent CRUD（B道）→ Issue #62
  - **4.2.2** 文档解析+向量化（A道）→ Issue #88
  - **0.9c** main 分支保护（需在 GitHub Settings 操作，用户动作）
  - **缺陷** #72/#73/#74/#75 排期修复
- 🔄 **E道（Phase 4）**：
  - **4.5.1** 成员管理 API + 页面接真实数据 → PR #6 待合并（2026-07-21）
  - **4.5.2** 租户创建/编辑/停用+配额（4.5.1 合并后）
  3. 启动 Phase 4 切片 1：4.1.1 Agent CRUD API + 页面接通
