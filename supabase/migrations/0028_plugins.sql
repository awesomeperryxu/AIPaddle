-- V12-2.1 / PRD v1.13 §7.1 / ADR-018：Plugin —— 能力交付与 Provider 治理单元。
--
-- Plugin 是「包」，Tool 是包里的「原子操作」（Tool 见 0029）。一个 Plugin 可提供
-- 一个或多个 Provider 类型及一个或多个 Tool（AC-02）。
--
-- 为什么要 plugin_versions 独立成表：D-19 要求上层资产发布时锁定下层版本——
-- Skill v3 依赖 Tool v1.2，Tool 升到 v1.3 不影响已发布的 Skill v3。可执行细节
-- （command / transport / credential_schema）随版本变化，故放版本表而非主表。
--
-- 迁移类型：纯新建，无既有对象改动 ⇒ 回滚 = drop table（见 0028_plugins_rollback.sql）。

create table public.plugins (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.tenants(id),
  name            text not null,
  description     text,
  provider_type   text not null check (provider_type in ('mcp', 'api', 'db')),
  -- 上游元数据（迁移 25 条 Skill Hub 市场目录时来自 skills.config）
  repo            text,                                  -- 上游仓库，如 microsoft/playwright-mcp
  license         text,
  docs_url        text,
  stars           integer,                               -- 上游热度，仅用于市场排序展示
  -- 发布审核状态机（PRD §14：Plugin 亦有状态机；复用 lib/agents/status.ts 的 TRANSITIONS 模式）
  status          text not null default 'draft'
                    check (status in ('draft', 'pending', 'published', 'offline')),
  -- 来源四分类，沿用 ADR-011/ADR-013 的 origin + mandatory 派生口径
  origin          text not null default 'user' check (origin in ('user', 'platform')),
  mandatory       boolean not null default false,
  created_by      uuid references public.users(id),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.plugins is
  'V12-2.1 Plugin：能力交付与 Provider 治理单元（MCP/API/DB）。一个 Plugin 可提供多个 Tool（AC-02）。不等同于 Tool 或 Skill（ADR-018 §2）。';
comment on column public.plugins.provider_type is
  'mcp | api | db —— 三类 Provider。⚠️ 不含 workflow：Workflow 不是 Plugin 的 Provider 类型，也不得成为 Tool Binding（D-06）。';
comment on column public.plugins.stars is
  '上游仓库 star 数，仅用于市场目录排序展示，非业务字段。';

-- 遵 4.9.1 契约：带 deleted_at 的表一律用部分唯一索引，不用全表 unique。
-- 全表 unique 会导致软删后名称被永久占用，用户重建即报 PG 原文（0025 的 5 处地雷）。
create unique index if not exists uq_plugins_org_name_active
  on public.plugins (org_id, name)
  where deleted_at is null;
create index if not exists idx_plugins_org_status
  on public.plugins (org_id, status)
  where deleted_at is null;
create index if not exists idx_plugins_provider_type
  on public.plugins (org_id, provider_type)
  where deleted_at is null;

alter table public.plugins enable row level security;
create policy tenant_rls_plugins on public.plugins
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());


-- ── Plugin 版本 ────────────────────────────────────────────────────────────
-- 可执行细节按版本保存。credential_schema 只声明「需要哪些凭证字段」，
-- 🔴 绝不存凭证值本身——值在 credentials 表加密存储（0030）。

create table public.plugin_versions (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.tenants(id),
  plugin_id          uuid not null references public.plugins(id) on delete cascade,
  version            text not null,                      -- 语义化版本，如 1.0.0
  -- 连接与启动方式（MCP: command/transport；API: base_url；DB: 连接经 credentials）
  command            text,                               -- 如 npx -y @playwright/mcp@latest
  transport          text check (transport in ('stdio', 'http')),
  remote_url         text,                               -- 托管型 MCP/API 的地址
  base_url           text,                               -- API Provider 的基础地址
  credential_schema  jsonb not null default '{}'::jsonb,  -- 需要哪些凭证字段（不含值）
  changelog          text,
  status             text not null default 'draft'
                       check (status in ('draft', 'pending', 'published', 'offline')),
  created_by         uuid references public.users(id),
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.plugin_versions is
  'V12-2.1 Plugin 版本。上层资产发布时锁定下层版本（D-19）；被已发布资产依赖的版本不得硬删，只能下线（AC-17）。';
comment on column public.plugin_versions.credential_schema is
  '🔴 只声明需要哪些凭证字段（如 ["GITHUB_PERSONAL_ACCESS_TOKEN"]），绝不存值。值在 credentials 表加密存储。';

create unique index if not exists uq_plugin_versions_active
  on public.plugin_versions (plugin_id, version)
  where deleted_at is null;
create index if not exists idx_plugin_versions_plugin
  on public.plugin_versions (plugin_id, created_at desc)
  where deleted_at is null;

alter table public.plugin_versions enable row level security;
create policy tenant_rls_plugin_versions on public.plugin_versions
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
