-- V12-2.2 / PRD v1.13 §7.2-7.3 / ADR-018：Tool —— 有明确输入输出 Schema、可被结构化调用的原子操作。
--
-- Tool 由 Plugin 提供（一个 Plugin 可提供多个 Tool，AC-02）。五类 Binding：
--   mcp    —— MCP Server + Tool Name；须 Server 审批 + 工具白名单 + 参数约束 + 脱敏 + 限流
--   api    —— Endpoint + Method + OpenAPI Operation；须域名白名单 + 服务端存 Secret + 超时重试
--   db     —— Connection + Query Template；须只读账号 + 库表白名单 + select-only + 行数限制 + 脱敏
--   native —— 平台注册的内置 Handler；🔴 不执行用户任意代码
--   smtp   —— SMTP 邮件发送（V12-2.2a，2026-07-31 用户拍板新增）。单列一类而非塞进 native：
--             SMTP 是独立协议，与 api(HTTP) 平行；凭证形状（host/port/secure/user/pass）也不同。
--             塞进 native 会让"平台内置 Handler"退化成杂物抽屉，后续每加一个协议都往里堆。
--
-- 🔴 D-06：Workflow **不是** Tool Binding 类型。理由不只是"规定"——Workflow 的多步、
-- 长时、可暂停语义装不进 Tool 的单次调用模型；且一旦允许，Skill 就能经 Tool 间接
-- 调用 Workflow，绕过 D-05。故 binding_type 的 CHECK 里没有 workflow，DB 层直接堵死。
--
-- 迁移类型：纯新建。回滚见 0029_tools_rollback.sql（须先于 0028 回滚）。

create table public.tools (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.tenants(id),
  plugin_id      uuid not null references public.plugins(id),
  name           text not null,                      -- Tool 名，如 browser_navigate
  display_name   text,
  description    text,
  -- 🔴 四类 Binding，**不含 workflow**（D-06 / AC-05）
  binding_type   text not null check (binding_type in ('mcp', 'api', 'db', 'native', 'smtp')),
  -- 风险等级（PRD §14）：high 的调用需人工确认。
  -- ⚠️ 这是**运行时确认流程**，不是 RBAC action——勿把风险确认做成权限（见 RBAC_ACTIONS_v1.13 §1.2）
  risk_level     text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  status         text not null default 'draft'
                   check (status in ('draft', 'pending', 'published', 'offline')),
  created_by     uuid references public.users(id),
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.tools is
  'V12-2.2 Tool：可结构化调用的原子操作，由 Plugin 提供。🔴 Workflow 不得注册为 Tool Binding（D-06/AC-05），binding_type 的 CHECK 已在 DB 层堵死。';
comment on column public.tools.binding_type is
  'mcp | api | db | native | smtp。🔴 故意不含 workflow：Workflow 的多步/长时/可暂停语义装不进 Tool 的单次调用模型，且会让 Skill 经 Tool 间接调用 Workflow 从而绕过 D-05。';
comment on column public.tools.risk_level is
  'low | medium | high。high 需运行时人工确认（PRD §14）。⚠️ 这是运行时流程而非权限，勿新增 action。';

create unique index if not exists uq_tools_plugin_name_active
  on public.tools (plugin_id, name)
  where deleted_at is null;
create index if not exists idx_tools_org_status
  on public.tools (org_id, status)
  where deleted_at is null;
create index if not exists idx_tools_plugin
  on public.tools (plugin_id)
  where deleted_at is null;
create index if not exists idx_tools_risk
  on public.tools (org_id, risk_level)
  where deleted_at is null;

alter table public.tools enable row level security;
create policy tenant_rls_tools on public.tools
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());


-- ── Tool 版本 ──────────────────────────────────────────────────────────────
-- 输入输出 Schema 与 Binding 配置按版本保存：Skill 依赖锁到 tool_version，
-- Tool 升版不影响已发布的 Skill（D-19）。

create table public.tool_versions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.tenants(id),
  tool_id         uuid not null references public.tools(id) on delete cascade,
  version         text not null,
  input_schema    jsonb not null default '{}'::jsonb,   -- JSON Schema
  output_schema   jsonb not null default '{}'::jsonb,
  -- Binding 具体配置。按 binding_type 取不同形状：
  --   mcp:    { mcp_tool_name, param_constraints, mask_fields, rate_limit }
  --   api:    { endpoint, method, operation_id, allowed_hosts, timeout_ms, retry, response_filter }
  --   db:     { query_template, param_schema, allowed_tables, select_only, max_rows, mask_fields }
  --   native: { handler_id }
  --   smtp:   { from_address, from_name, to, cc, subject_template, body_template, reply_to }
  --           连接参数（host/port/secure/user/pass）不在此处，全部经 credential_id 引用
  -- 🔴 一律不含凭证值——凭证经 credential_id 引用 credentials 表（0030）
  binding_config  jsonb not null default '{}'::jsonb,
  credential_id   uuid,                                 -- 0030 建表后补外键
  changelog       text,
  status          text not null default 'draft'
                    check (status in ('draft', 'pending', 'published', 'offline')),
  created_by      uuid references public.users(id),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.tool_versions is
  'V12-2.2 Tool 版本。Skill 依赖锁到具体 version（D-19）；被已发布资产依赖的版本不得硬删，只能下线（AC-17）。';
comment on column public.tool_versions.binding_config is
  '🔴 只放非敏感配置（endpoint/query模板/白名单/限流等），凭证值一律经 credential_id 引用 credentials 表，绝不内联。';

create unique index if not exists uq_tool_versions_active
  on public.tool_versions (tool_id, version)
  where deleted_at is null;
create index if not exists idx_tool_versions_tool
  on public.tool_versions (tool_id, created_at desc)
  where deleted_at is null;

alter table public.tool_versions enable row level security;
create policy tenant_rls_tool_versions on public.tool_versions
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
