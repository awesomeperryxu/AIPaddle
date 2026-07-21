# CLAUDE.md — AIPaddle 项目工作约定

## 项目简介

AIPaddle 是面向企业的 AI 业务赋能与 LLMOps 管理平台，统一管理 Agent、Skill、知识库、Workflow、成员、安全审核与 SaaS 租户。当前处于"高保真前端原型 → 真实业务闭环"的转化阶段，边界见 `docs/IMPLEMENTATION_AUDIT.md`。

## 技术栈

- 前端：Next.js 16 · React 19 · TypeScript（strict）· Tailwind CSS 4 · Radix UI / shadcn/ui（组件在 `components/ui/`）· Recharts · Lucide React · pnpm
- 后端：Next.js API Routes / Server Actions 单体（不建独立后端服务）
- 数据与基础服务：Supabase 云托管（Postgres + Auth + Storage + pgvector），决策依据见 `docs/adr/ADR-001-backend-architecture.md`
- 演示数据：`lib/mock-data.ts`（目标是逐步替换为真实数据层）
- 技术栈已定稿，**不做无理由的替换或精简**；变更必须先写 ADR 经用户拍板

## 关键文档（动工前必读）

- `ROADMAP.md` — 任务执行清单与当前进度（本项目的"总账"）
- `docs/requirements/PRD_Core_v1.04.md` — 业务依据
- `docs/requirements/UI_Design_Spec_v1.04.md` — 设计依据
- `docs/IMPLEMENTATION_AUDIT.md` — 各模块"已实现 vs 未实现"的交付边界
- `docs/TESTING.md` / `docs/TESTING_WORKFLOW.md` — 测试策略与自动执行协议
- `docs/test-cases/` — 测试用例库（建 Issue 时从中摘取该任务节点的用例 ID 作为验收标准）

## ⚠️ 强制工作流（每个任务都必须遵守）

1. **任务开始前**：先读取 `ROADMAP.md`，找到本次工作对应的任务编号，向用户复述"当前要做的是 [编号] 任务、验收标准是什么"，**得到用户确认后才开始写代码**。找不到对应编号的工作，先和用户讨论是否要往 ROADMAP 里加。
2. **进度追踪 = 本地机密文档（2026-07-21 更新；仓库已转公开，追踪文档不进 git）**：安全加固（commit `005c520e`）已把 `ROADMAP.md`、`docs/ISSUES.md`、进度 Excel、`docs/adr/` 等**移出/忽略于公开仓库**——它们是**本地机密文档，仅存工作目录、不同步进公开 git**。公开仓库只承载代码 + `CLAUDE.md` + 脱敏后的 `README`。追踪三处协同（**均为本地文件，改动不进 PR**）：
   - `ROADMAP.md`（本地）：任务状态 + 决策日志 + 缺陷标注（**总账**）；
   - `docs/ISSUES.md`（本地，gitignore）：开放任务/缺陷台账（编号如 `[4.1.2]`/`[BUG-73]`，一行一条）；
   - `docs/AIPaddle-项目进度管控.xlsx`（本地，非 git；可能被 Excel.app 打开——写前先确认无 `~$` 锁，否则请用户先关闭）。
   - 动工前在 `docs/ISSUES.md` 建/领条目；完成经用户验收 → 置 ✅ 并同步 `ROADMAP.md` + Excel。**不用 `gh issue`；这些追踪文档只在本地更新，不 push 不进 PR**（GitHub 仅承载代码与 PR）。
3. **小批量**：一次只做一件事，单任务粒度 ≤ 2 小时。任务太大就先提议拆分。
4. **完成的定义**：用户亲手操作验证通过 + `pnpm check` 通过 + 本次改动相关测试绿 + **经用户同意后**（见规则 9 双闸）push 且 CI 绿灯 + `docs/ISSUES.md` 对应条目置 ✅、`ROADMAP.md` 状态同步。测试分层与豁免规则见 `docs/TESTING.md`。
5. **不许静默扩大范围**：不顺手重构、不顺手加功能；发现问题记录到 Issue，另行安排。
6. **测试自动执行协议**：每个 Issue 的测试调取、结果回帖、失败修复、Codex 交叉测试，一律按 `docs/TESTING_WORKFLOW.md` 执行——按标签映射自动跑对应测试集，报告用 `gh issue comment` 贴进 Issue；不合格自动修复最多 3 轮（只修代码不改测试，3 轮仍红打 `status:blocked` 交用户裁决）；用户验收前调取 Codex CLI 做只读交叉审查（切片验收 Issue 必做）。
7. **进度询问的标准输出**：用户询问项目进度时（"进度怎么样"、"现在到哪了"等任何进度类问题），默认动作是：按 ROADMAP/Issue 的最新状态**重新生成并覆盖** `docs/AIPaddle-项目进度管控.xlsx`（固定路径、固定格式：仪表盘/任务清单/里程碑关口/决策日志四表；任务清单含 任务编号/执行批次/阶段/任务类别/任务内容/优先级/状态/执行主体/依赖/验收标准/测试类型/测试用例状态/测试执行状态/关联用例/备注 十五列），交付文件并附三句话以内的口头摘要。除非用户明确只要口头回答。
8. **主控文件随交互实时更新**：每次与用户的交互只要产生了决策、进度变化或新任务，必须在同一次会话内同步更新对应文件——进度/状态 → `ROADMAP.md`（含决策日志表）；架构或技术决策 → 新增/修订 `docs/adr/ADR-xxx.md`；工作约定变化 → 本文件。更新后告知用户改了哪里。
9. 🔴 **本地优先 + 提交双闸（2026-07-21 起，最高优先级强制约束）**：一切改动——**开发代码、文档、配置，全部先改用户本地文件**，绝不直接在远程操作。向 GitHub `git push` / 建 PR **必须同时满足两个前置条件，缺一不可**：
   - **(a) 已通过阶段性测试**：至少 `pnpm check`（typecheck+lint+build）通过 + 本次改动相关的单元/集成测试绿；纯文档改动也要确认不破坏构建。
   - **(b) 已获得用户明确同意**：把「改了哪些本地文件、测试结果」摊给用户，**用户点头后才 push / 建 PR**。
   - 未同时满足即**停在本地**，只做本地修改与测试，等待用户裁决。此条**优先于**"完成即 commit/push"等其它表述——本地 commit 可以，但 **push 与 PR 必须过双闸**。
   - **批次提交（2026-07-21 起）**：**不再以单个任务为单位提 PR**。开发仍小批量、一次一件事、本地逐个 commit；但 PR 以**批次**攒交——多个已完成且**各自阶段测试通过**的改动累积成一批，整批 `pnpm check` 通过后，**经用户同意**再一次性 push + 建 PR。批次边界与提交时机由用户拍板。
10. 🔴 **主目录只停在 main + 各道独立 worktree（2026-07-21 起）**：项目本地主目录 = `/Users/perryxu/github/aipaddle`（= `AIPaddle`，权威主目录）。**主目录必须始终停在 `main` 分支，禁止在主目录 `git checkout`/切分支/开发**——否则会清掉 gitignore 的本地机密文件（ROADMAP/ISSUES/进度 Excel），且与其它道互撞。每条并行道（A/B/C/D/E）**只在自己的独立 worktree**（`git worktree add ../aipaddle-<道> feat/<分支>`）里开发；主目录仅用于停在 main 看权威进度文件与本地机密文档。见 `docs/PARALLEL_EXECUTION_PLAN.md`。

## 代码约定

- **数据层四层单向依赖（ADR-008）**：组件 → API Route/Server Action → 数据层 `lib/data/*` → Supabase 客户端，依赖只能自上而下。组件**禁止**直接 import `lib/mock-data.ts`、`@supabase/*` 或 `lib/supabase/*`；客户端组件只经 `fetch('/api/*')`（统一走 `lib/api/client.ts`），服务端组件/Action 只调 `lib/data/*`。
- **`lib/data/*` 是唯一访问数据库的层**：每个函数第一个参数固定 `ctx: RequestContext`（`{userId,orgId,roles}`，ADR-002），用请求级客户端（RLS 生效），文件顶部 `import 'server-only'`。迁移期用 Repository 模式包住 mock 逐页替换，切完即删对应 mock 导出（全切完 = 删 `lib/mock-data.ts`）。
- **动作权限单一事实来源=ADR-007 矩阵**：新增任何写操作 API 必须先在 `docs/adr/ADR-007` 矩阵登记 `action`、在 `lib/auth/permissions.ts` 补映射，再于 API 入口 `requirePermission(ctx, action)`；默认拒绝，漏配即 403。前端隐藏菜单不算数，必须服务端强制。
- **浏览器永不直连 Supabase**：前端只请求自己的 Next.js API，由服务端访问 Supabase（国内访问稳定性的关键约定，见 ADR-001）。`SUPABASE_SERVICE_ROLE_KEY` 等密钥只放服务器环境变量，绝不进前端代码或 git。
- **两把钥匙分工（ADR-002，RLS 双层防护的落地铁律）**：处理登录用户的业务请求**只能用请求级客户端**（`lib/db/server.ts`，带该用户 token，RLS 生效）；`service_role`（服务级客户端）**只允许出现在 `lib/db/admin.ts` 一个文件**，仅用于 seed/跨租户运维/审计写，其他任何文件禁止 import `SUPABASE_SERVICE_ROLE_KEY` 或创建 service 客户端（ESLint 规则 + CI 兜底强制）。用 service_role 应答普通用户请求 = Code Review 直接打回。
- **租户上下文只由服务端从可信会话推导**：请求身份契约固定为 `{userId, orgId, roles}`（来自 JWT claim），绝不采信前端传入的 Header/参数来判定"是哪家租户"。
- 所有涉及租户数据的 API 必须做 `org_id` 隔离与权限校验，不得只靠前端隐藏入口。
- 状态流转（Agent 发布、审核、租户启停等）必须有服务端校验，非法流转要拒绝。
- 新功能至少配一条自动化测试；修 bug 先写复现测试。测试写在哪一层（单元/集成/E2E）按 `docs/TESTING.md` 判断。
- **E2E 用例是可执行规格**：开发新页面/功能时必须遵守 `tests/e2e/README.md` 的选择器约定（Label 关联、语义按钮、约定的 data-testid），并让 `tests/e2e/stages/` 中对应用例通过；seed 脚本必须与 `tests/e2e/fixtures/test-data.ts` 保持一致。
- 功能开发走分支 + PR 合并 main，不直接 push main；CI 红灯时先修 CI，不开新任务。

## 常用命令

```bash
pnpm dev        # 本地开发 http://localhost:3000
pnpm check      # typecheck + lint + build（提交前必跑）
gh issue list   # 查看当前任务
```

## 部署

- 目标服务器：`ubuntu@<部署服务器IP·见私密配置/GitHub Secret DEPLOY_HOST>`（Ubuntu）
- 部署链路尚未建立，对应 ROADMAP 任务 0.7 / 0.8；建成前不要臆造部署脚本。
