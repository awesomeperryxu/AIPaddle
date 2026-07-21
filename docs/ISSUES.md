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
| 4.1.1 | Agent CRUD API + 页面接通（列表/创建/编辑/删除） | B | 🔄 待验收 | CRUD 已闭环（列表/创建/编辑/删除全接通 + 8 单测），PR #5（新 repo）待用户验收合并；刷新后数据仍在、跨租户不可见 |
| 4.1.2 | 状态机：草稿→待审核→已发布→停用（含校验规则） | B | ⬜ | 非法流转被拒绝并有提示 |
| 4.1.3 | 审核流程接入安全管理模块（审批提交、留痕） | B | ⬜ | 审批记录可查 |
| 4.1.4 | Agent 调用：接通真实大模型 API（通义 Qwen） | — | ⬜ | 数字员工页面能真实对话 |
| 4.1.5 | 调用日志落库与展示 | — | ⬜ | 日志数=实际调用次数 |
| 4.1.6 | Agent Copilot 最简版（ADR-005） | — | ⬜ | 生成物过 Schema 校验、AI 不能触发发布、留审计 |

## 阶段 0/3 收尾（独立跟进，不阻塞切片）

| 编号 | 任务 | 状态 | 备注 |
|------|------|:---:|------|
| 3.6 | 部署到服务器验收 | ⬜ | 线上已可访问；配 `DEPLOY_SSH_KEY` Secret 后 push main 自动部署（新 repo 需重配 Secret） |
| 0.9c | 开 main 分支保护 | ⬜ | 需 GitHub 侧配置 |
| MIG-1 | 账号迁移收尾 | 🔄 | 旧 repo Issue/PR 未迁；新 repo 需重配 CI Secrets（`DEPLOY_SSH_KEY` 等）、分支保护 |

> 其它道（D 知识库 4.2.x / C 测试 / E 集成）的开放条目由各道自行在本表追加。

## UI 原型对齐批次（2026-07-21，`public/prototype/*.dc.html` 为唯一真实源）

> 用户拍板：全部 UI（含 e2e）按原型对齐，差异全按原型更新；成员角色**保留后端键、只改显示标签**。四轮完成，`pnpm check` 全绿、Playwright 解析 73 用例正常。分支 `feat/prototype-ui-alignment`（批次 PR）。

| 编号 | 内容 | 状态 | 备注 / 遗留 |
|------|------|:---:|------|
| 4.2.x | 知识库管理页接入真实数据（上传→向量化→列表→删除→建库） | ✅ | 服务端页 listKnowledgeBases+listDocuments；按 knowledge:create 门控 |
| UI-R1 | 知识库/成员/租户 中度偏离对齐 + s2 e2e 改写 | ✅ | 成员保留角色键改标签；租户 ¥/菜单8项 |
| UI-R2 | keys/billing/settings/saas-dashboard 空白页按原型落地 | ✅ | **UI 骨架 + 内联 mock；真实后端接线待后续切片** |
| UI-R3 | dashboard 监控明细下钻 / workflow 编辑器4面板 / knowledge-qa 双栏 | ✅ | mock 交互；qa 保留 /api/knowledge/ask 接线 |
| UI-R4 | agents/skill-hub e2e 钩子（testid/aria-label）+ spec 文案对齐 | ✅ | 「已下线」页签原型无，已从 s1 移除 |
| FIX-IDX | S2-IDX-04 检索评分面板 | ⏸ | 原型仅按钮占位、面板未建，e2e 标 `test.fixme` |
| FIX-INV | S5-01 成员邀请表单 | ⏸ | 「添加成员」按钮为 disabled 占位、无表单，e2e 标 `test.fixme` |
