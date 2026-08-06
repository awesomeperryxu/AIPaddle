# AIPaddle E2E 测试套件使用说明

> 依据 PRD_Core_v1.04 全量功能编写的**阶段性 CI 测试**。用例设计文档在 `docs/test-cases/`，本目录是其可执行实现。

## 目录结构

```
tests/e2e/
├── fixtures/test-data.ts    # 测试数据唯一权威来源（租户/账号/Agent/语料/金标准…）
├── helpers.ts               # 阶段门控 + 登录等公共操作
├── smoke.spec.ts            # TC-00 原型冒烟（现在就能跑）
└── stages/
    ├── s0-foundation.spec.ts   # 切片 0：认证/隔离/权限/持久化
    ├── s1-agent.spec.ts        # 切片 1：Agent CRUD/状态机/审核/对话/日志
    ├── s2-knowledge.spec.ts    # 切片 2：上传/检索/RAG 问答/拒答
    └── s3-s5-later.spec.ts     # 切片 3-5：Skill/Workflow/成员租户（骨架）
```

## 阶段性 CI 的运行方式（核心机制）

所有 stages/ 用例由环境变量 `E2E_STAGE` 门控——**未到阶段的用例自动 skip，不会红**：

```bash
pnpm test:e2e                      # 只跑原型冒烟（E2E_STAGE 缺省 -1）
E2E_STAGE=0 pnpm test:e2e          # 冒烟 + 切片 0
E2E_STAGE=2 pnpm test:e2e          # 冒烟 + 切片 0/1/2
pnpm test:e2e --grep @smoke        # 只跑冒烟集（CI 合并前）
pnpm test:e2e --grep @isolation    # 只跑租户隔离专项
```

CI 接入：切片 0 启动后，在 `.github/workflows/ci.yml` 的 e2e job 中加一行
`env: { E2E_STAGE: "0" }`，每完成一个切片把数字 +1 即可，无需改测试代码。

## 并发上限：workers 锁在 2（BUG-96）

`playwright.config.ts` 显式设了 `workers: 2`，**不要**为了提速调高。

原因在 `webServer` 跑的是 `pnpm dev` —— Next.js 开发服务器是**按需即时编译**的。
多个 worker 同时首访不同路由（`/login`、`/api/auth/login`、`/dashboard`…）会触发并发编译，
CPU 打满后单个请求就撞 30s timeout。

**挂哪一条完全随机**，这一点最容易误导排查方向：
- 台账 BUG-96 记录的是 4 条 S0 用例超时（S0-AUTH-03 / S0-ISO-01·03·04·05 / S0-PRM-01）
- 2026-08-06 复现时却是 `auth.setup` 的 `adminB` 登录超时，导致后续 12 个用例直接 `did not run`

随机性正是资源争抢的特征——**不是用例本身不稳定**。排查时若只盯着失败的那条用例，会一直找不到原因。

实测对照（本机 12 核）：

| workers | 结果 | 耗时 |
|---|---|---|
| 6（默认 = 核数/2） | setup 即挂，12 用例未跑 | — |
| **2（现配置）** | 17 passed | 1.4m |
| 1 | 17 passed | 2.6m |

⚠️ **想提高这个值，必须先把 `webServer` 换成生产构建**（`pnpm build && pnpm start`，无即时编译），
否则只是把随机失败的概率调回去。

## 测试数据约定（与 seed 脚本的契约）

- `fixtures/test-data.ts` 是唯一权威：seed 脚本 **`scripts/seed-e2e.mjs`（`pnpm seed:e2e`）** 幂等地按 `TENANTS` / `USERS` 建两租户五账号 + 角色 + 平台超管（adminA），密码取环境变量 `SEED_PASSWORD`；跑 stages/带登录用例前先执行。走 service_role REST（本地即可运行）。
- 测试邮箱域固定 `@aipaddle-test.local`，杜绝误发真实邮件。
- 固定语料（3 份 PDF）与完整金标准集（`tests/fixtures/golden-set.json`，≥20 题）在切片 2 用脚本生成，`KNOWLEDGE_DOCS` 中已锁定其内容要点。
- 测试环境需暴露两个仅测试可用的辅助口：`/api/e2e/seed-info`（返回 seed 资源 ID）与 `?e2e-fault=llm`（模型故障注入）。生产环境必须关闭。

## 选择器约定（开发新页面时必须遵守，已写入 CLAUDE.md）

1. 优先可访问性定位：表单控件必须有 `<Label>` 关联（`getByLabel`）、按钮用语义文本（`getByRole('button', {name})`）。
2. 动态/统计类元素加 `data-testid`，已约定的 ID：
   `user-menu`、`metric-calls`、`chat-message-assistant`、`citation`、
   `retrieval-score`、`skill-installs`、`canvas`、`block-<节点类型>`、`node-status-<节点类型>`、`run-result`、
   `agent-name-input`、`agent-name-error`。
   （`stat-<页签名>` 已于 2026-07-29 移除：约定了但**实现从来没有统计卡**，
   对应的 S1-CRUD-06 是一条永远失败的用例，已随之删除。）
3. stages 用例是**可执行规格**（executable spec）：开发对应功能时按用例中的选择器实现 UI，测试即验收标准；确需偏离时改用例并在 PR 里说明。

## 与 Issue 的对应

每条 test 的标题就是 `docs/test-cases/` 里的用例 ID（如 `S1-STM-02`），Issue 验收时按 ID 对照回帖。
