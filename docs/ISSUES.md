# AIPaddle 开放任务 / 缺陷台账（ISSUES）

> **权威追踪（2026-07-21 起）**：账号迁移（HELLOPERRYXU → awesomeperryxu）后旧 GitHub Issues 已失，进度改为**仓库内版本化追踪**。本文件是「开放任务 + 缺陷」台账，与 `ROADMAP.md`（总账/状态/决策日志）、`docs/AIPaddle-项目进度管控.xlsx`（四表）协同。
>
> **约定**：一行一条，编号沿用 ROADMAP 任务号（`4.1.2`）或缺陷号（`BUG-73`）。状态：⬜ 未开始 · 🔄 进行中 · ✅ 已完成（用户验收）· ⏸ 暂缓。**改动先落本地文件，push/PR 须过双闸（阶段测试 + 用户同意），见 `CLAUDE.md` 规则 9。**

_Last updated: 2026-07-21_

## 缺陷（线上验证 2026-07-20 发现）

| 编号 | 缺陷 | 归属 | 状态 | 备注 / 验收标准 |
|------|------|------|:---:|------|
| BUG-72 | 登录按钮偶发卡「登录中...」不跳转（会话已建立） | 3.2 认证 | 🔄 | 连续 5 次登录均 3s 内跳转、loading 态复位 |
| BUG-73 | DashboardShell 侧边栏点二级菜单不切换视图 | 3.5 外壳 | 🔄 待复核 | 外壳已改**路由式**（/agents-admin、/security 等为真实路由），需复核是否已解决 |
| BUG-74 | 监控指标 + 侧栏用户仍为 mock | 3.5 数据 | 🔄 | 组织名已接真实 org；**遗留**：监控指标（6,780 等）仍 mock |
| BUG-75 | agents-admin 未消费 /api/agents 真实数据 | 4.1.1 | ✅ 已解决 | agents-admin 服务端页已 `listAgents(ctx)` 真实数据（commit b8d6d5c9） |

## 当前切片任务（切片 1：Agent 管理）

| 编号 | 任务 | 归属道 | 状态 | 备注 / 验收标准 |
|------|------|------|:---:|------|
| 4.1.1 | Agent CRUD API + 页面接通（列表/创建/编辑/删除） | B | ✅ 已合并 | CRUD 闭环（增删改查 + 8 单测），已并入 main（PR #5）；待用户线上亲验 |
| 4.1.2 | 状态机：草稿→待审核→已发布→停用（含校验规则） | B | 🔄 待验收 | 状态机 `lib/agents/status.ts`（5 条合法流转）+ 数据层 `transitionAgent`（原子条件更新）+ `POST /api/agents/[id]/transition`（按动作分权限、非法流转 409）+ UI 按状态+权限渲染动作 + 12 测试；本地绿，待用户同意提批次 |
| 4.1.3 | 审核流程接入安全管理模块（审批提交、留痕） | B | 🔄 待验收 | 流转联动写 `security_reviews`（submit 建 pending / approve·reject 裁决）+ `audit_logs` 留痕（不可篡改）；`lib/data/reviews.ts`+`audit.ts`；security 页接 `listReviews` 真实数据、SecurityView 接 reviews prop（空回落 mock）；+4 审批留痕测试；本地绿 |
| 4.1.4 | Agent 调用：接通真实大模型 API（通义 Qwen） | B | 🔄 待验收 | `POST /api/agents/[id]/chat`：加载 Agent config→注入 systemPrompt→调 `lib/ai.chat`(qwen-plus)；数字员工页(AgentsView)接线真实对话；服务端丢弃前端 system 防注入；7 测试 + 实测通义返回与配置相符 |
| 4.1.5 | 调用日志落库与展示 | B | 🔄 待验收 | chat 每次调用落 `call_logs`（真实 token/延迟/成败，`chatWithUsage`）+ `lib/data/call-logs.ts`(record/list/count) + `GET /api/agents/[id]/logs`(audit:read) + agents-admin 详情展示真实调用数与最近调用；3 测试 |
| 4.1.6 | Agent Copilot 最简版（ADR-005） | — | ⬜ | 生成物过 Schema 校验、AI 不能触发发布、留审计 |

## 阶段 0/3 收尾（独立跟进，不阻塞切片）

| 编号 | 任务 | 状态 | 备注 |
|------|------|:---:|------|
| 3.6 | 部署到服务器验收 | ⬜ | 线上已可访问；配 `DEPLOY_SSH_KEY` Secret 后 push main 自动部署（新 repo 需重配 Secret） |
| 0.9c | 开 main 分支保护 | ⬜ | 需 GitHub 侧配置 |
| MIG-1 | 账号迁移收尾 | 🔄 | 旧 repo Issue/PR 未迁；新 repo 需重配 CI Secrets（`DEPLOY_SSH_KEY` 等）、分支保护 |

> 其它道（D 知识库 4.2.x / C 测试 / E 集成）的开放条目由各道自行在本表追加。
