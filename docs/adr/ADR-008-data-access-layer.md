# ADR-008：统一数据层与 API 客户端设计

- 状态：**已采纳**（2026-07-20，Perry 拍板通过）
- 对应任务：ROADMAP 2.5（统一 API 客户端与数据层设计），交付=约定写入 CLAUDE.md
- 决策人：Perry
- 起草：Claude
- 依赖：2.2（ADR-002，请求契约与两类客户端）、2.4（数据模型）、2.3（ADR-007，权限矩阵）

---

## 背景

现状：11 个视图组件（`components/views/*.tsx`）**直接 `import lib/mock-data.ts`** 取业务数据。要变成真实产品，必须把"组件↔数据"之间插一层，否则每个页面各写各的取数、鉴权、隔离逻辑，无法收口，也没法从 mock 平滑切真实 API。

本 ADR 定这一层的**形状与铁律**，让 3.5「第一个页面切真实 API」以及后续每个切片有统一模板可循。

---

## 决策

### 1. 四层单向依赖

```
组件(Client/Server Component)
  │  只调 ①API Route(客户端组件) 或 ②数据层函数(服务端组件/Action)
  ▼
API Route / Server Action        ← 鉴权入口：ADR-007 requirePermission()
  │  组装 ctx={userId,orgId,roles}(ADR-002)，调数据层
  ▼
数据层 / Repository  lib/data/<entity>.ts   ← 唯一碰数据库的地方
  │  用请求级 Supabase 客户端(ADR-002)，返回领域对象
  ▼
Supabase 客户端  lib/supabase/server.ts (请求级) / lib/supabase/admin.ts (service，唯一封装)
```

**依赖只能自上而下**，禁止跨层或反向。组件永远不认识 Supabase，数据层永远不认识 HTTP。

### 2. 铁律（写入 CLAUDE.md）

1. **组件禁止直接 import `lib/mock-data.ts`**；也禁止在组件里直接 import `@supabase/*` 或 `lib/supabase/*`。组件取数只有两条路：客户端组件 `fetch('/api/...')`；服务端组件/Action 调 `lib/data/*` 函数。
2. **`lib/data/*` 是唯一访问数据库的层**，每个函数**第一个参数固定为 `ctx: RequestContext`**（`{userId, orgId, roles}`，来自 ADR-002），内部用请求级客户端（RLS 生效），不接受"裸调用"。
3. **数据层是 server-only**：文件顶部 `import 'server-only'`，防止误打包进浏览器泄露逻辑或密钥。
4. **鉴权在 API/Action 入口做**（ADR-007），数据层假定"到我这一步动作已授权"，只管数据隔离由 RLS 兜底——即"入口查动作权限、RLS 兜数据归属"，两道不重复但都在。
5. **类型单一来源**：领域类型放 `lib/types/*`（首版手写，后续可切 Supabase 生成类型）。组件、数据层、API 共用同一套类型，不各写各的 `interface`。

### 3. 迁移期：Repository 模式包住 mock，逐页替换（配合 3.5）

不搞"一次性全切"。每个实体的数据层函数先给两套实现，用开关切：

```ts
// lib/data/agents.ts
import 'server-only'
export async function listAgents(ctx: RequestContext): Promise<Agent[]> {
  if (USE_MOCK) return mockAgents            // 迁移期回退，切完即删
  const db = getRequestClient(ctx)           // 请求级客户端，RLS 生效
  const { data } = await db.from('agents').select('*').is('deleted_at', null)
  return data ?? []
}
```

- 组件从"直连 mock"改成"调 `listAgents(ctx)`"后，**接口不变、切换只在数据层内部**，一页一页迁，风险可控。
- 一个实体切完真实 API 且验收通过，就删掉它的 mock 分支和 `mock-data.ts` 里对应导出。**全部切完 = `mock-data.ts` 删除**（这是切片 0/各切片的收尾信号）。

### 4. API 客户端（浏览器侧）

- 客户端组件统一用一个薄封装 `lib/api/client.ts`：包 `fetch`，自动带会话 Cookie、统一处理 401→跳登录、403→提示无权限、错误结构 `{error: {code, message}}`。
- **浏览器只打自己域名的 `/api/*`**（呼应 ADR-001：永不直连 Supabase）。
- 约定 API 返回结构统一：成功 `{data}`，失败 `{error:{code,message}}` + 对应 HTTP 状态码（403/404/422…）。

---

## 命名对齐（现状 reconcile）

ADR-002 曾写 `lib/db/server.ts` / `lib/db/admin.ts`；A 道 3.1/3.2 实际建的是 `lib/supabase/server.ts`（请求级）+ `lib/supabase/client.ts`。**以现状 `lib/supabase/` 为准**：请求级 = `lib/supabase/server.ts`；service 客户端新增 `lib/supabase/admin.ts`（ADR-002 的"唯一封装文件"铁律照旧，只是路径从 `lib/db/admin.ts` 改到 `lib/supabase/admin.ts`）。ESLint 禁读 `SUPABASE_SERVICE_ROLE_KEY` 的例外文件相应改为 `lib/supabase/admin.ts`。

---

## 被否决的备选

| 方案 | 否决原因 |
|------|---------|
| 组件里直接调 `supabase-js`（Supabase 标准玩法） | 违背 ADR-001（浏览器不直连）+ 鉴权/隔离散落各组件，不可收口 |
| 引入重型 ORM/数据框架 | 单人团队 + Supabase 官方 client 够用，增复杂度无收益（呼应 ADR-001 不造轮子） |
| 一次性全量替换 mock | 11 个视图同时改风险大、不可回退；Repository 模式逐页切更稳 |
| 每个组件自己 `fetch`，不封装 client | 401/403/错误处理重复且易漏；统一薄封装成本低收益高 |

## 连带决定与落地清单（配合 3.5）

- 新建 `lib/data/<entity>.ts`（agents/skills/knowledge/workflows/members/…）——各切片按需建。
- 新建 `lib/api/client.ts`（浏览器薄封装）、`lib/types/*`（领域类型）、`lib/context.ts`（`RequestContext` 类型，与 ADR-002 一致）。
- 新增 `lib/supabase/admin.ts`（service 客户端唯一封装，ADR-002）。
- ESLint 规则：`components/**` 禁止 import `lib/mock-data` 与 `lib/supabase/*`；仅 `lib/supabase/admin.ts` 可读 service key——写入 `eslint.config.mjs`。
- 3.5 首个落地页 = Dashboard：`components/views/dashboard-view.tsx` 从 mock 切 `lib/data` + `/api/dashboard`，删该页 mock 引用。

## 复审条件

- 若引入 Supabase 生成类型 / tRPC 等，第 5 条类型来源与第 4 条 client 形态需复审。
- 若未来出现大量纯服务端渲染页面，可评估用 Server Action 直调数据层、减少 `/api/*` 中转（当前保留 API 层以统一鉴权与错误处理）。
