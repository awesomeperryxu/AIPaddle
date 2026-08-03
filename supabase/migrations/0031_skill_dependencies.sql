-- V12-3.1 / PRD v1.13 §8.3 / ADR-018 §3：Skill 的依赖关系表。
--
-- 【为什么是 skill_plugin_dependencies 而不是 skill_tool_dependencies】
-- v1.12 原文写「Skill 可以调用任意 Tool 对象」——这是笔误，v1.13 的 D-04 修正为
-- 「Skill 可以调用 **Plugin 的任意对象**」。依赖粒度是 Plugin 对象（Tool / Provider 能力 /
-- Connector 能力），不是仅 Tool。用 object_type 区分种类，将来加 Provider/Connector
-- 依赖时不必再改表。
--
-- 【为什么锁版本】
-- D-19：上层资产发布时锁定下层版本。Skill v3 依赖 Tool v1.2，Tool 升到 v1.3 不影响
-- 已发布的 Skill v3——否则下层一改，线上所有依赖它的 Skill 行为都会突变。
--
-- 🔴 D-05：object_type 的 CHECK **故意不含 workflow**。
-- 三道防线的第一道（最硬那道）就在这里：DB 直接拒绝，应用层再拒一次，前端选择器不给选。
-- 只在应用层拦不算数——绕过 API 直接写库就破功了。
--
-- 迁移类型：纯新建。编号 0031 取自 MIGRATION_PLAN_v1.13 §1 占用登记表（S 道预留）。
-- 回滚见 0031_skill_dependencies_rollback.sql。

create table public.skill_plugin_dependencies (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.tenants(id),
  skill_id       uuid not null references public.skills(id) on delete cascade,
  -- 🔴 被依赖对象的种类。**不含 workflow**（D-05/D-06）
  object_type    text not null check (object_type in ('tool', 'provider', 'connector')),
  object_id      uuid not null,
  -- 锁定的版本号（D-19）。null = 跟随最新，仅草稿态允许；发布时必须锁定具体版本
  object_version text,
  -- 该依赖是否必需：可选依赖缺失时降级运行，必需依赖缺失时拒绝发布/运行
  required       boolean not null default true,
  created_by     uuid references public.users(id),
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.skill_plugin_dependencies is
  'V12-3.1 Skill → Plugin 对象的版本化依赖（D-04 修正后的粒度：Plugin 对象而非仅 Tool）。🔴 object_type 故意不含 workflow——Skill 禁止依赖 Workflow（D-05），DB 层直接堵死。';
comment on column public.skill_plugin_dependencies.object_type is
  'tool | provider | connector。🔴 不含 workflow：Skill 依赖 Workflow 会让「方法」与「编排」职责混淆，且 Workflow 的多步/长时语义无法作为 Skill 的原子依赖。';
comment on column public.skill_plugin_dependencies.object_version is
  '锁定版本（D-19）。null 仅草稿态允许；发布时必须锁定，否则下层升版会让已发布 Skill 行为突变。';

-- 同一 Skill 对同一对象只能有一条在册依赖（软删不占用）
create unique index if not exists uq_skill_plugin_dep_active
  on public.skill_plugin_dependencies (skill_id, object_type, object_id)
  where deleted_at is null;
create index if not exists idx_skill_plugin_dep_skill
  on public.skill_plugin_dependencies (skill_id)
  where deleted_at is null;
-- 反查热路径：Tool 下线时要快速找出「哪些 Skill 依赖了它」（AC-17）
create index if not exists idx_skill_plugin_dep_object
  on public.skill_plugin_dependencies (object_type, object_id)
  where deleted_at is null;

alter table public.skill_plugin_dependencies enable row level security;
create policy tenant_rls_skill_plugin_deps on public.skill_plugin_dependencies
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());


-- ── Skill → 知识库依赖 ─────────────────────────────────────────────────────
-- 单独成表而非并进上表：知识库不是 Plugin 对象，它有自己的可见性与检索配置；
-- 混在一起会让 object_type 变成「什么都往里塞」的杂物字段。

create table public.skill_kb_dependencies (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.tenants(id),
  skill_id          uuid not null references public.skills(id) on delete cascade,
  knowledge_base_id uuid not null references public.knowledge_bases(id),
  required          boolean not null default false,
  created_by        uuid references public.users(id),
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.skill_kb_dependencies is
  'V12-3.1 Skill → 知识库依赖。单独成表而非并入 plugin_dependencies：知识库不是 Plugin 对象，有自己的可见性与检索配置。';

create unique index if not exists uq_skill_kb_dep_active
  on public.skill_kb_dependencies (skill_id, knowledge_base_id)
  where deleted_at is null;
create index if not exists idx_skill_kb_dep_skill
  on public.skill_kb_dependencies (skill_id)
  where deleted_at is null;

alter table public.skill_kb_dependencies enable row level security;
create policy tenant_rls_skill_kb_deps on public.skill_kb_dependencies
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());


-- ── skills 扩展字段（PRD v1.13 §8.1）────────────────────────────────────────
-- Skill 是「业务方法」：目标、SOP、规则、正反例、输入输出定义。
-- 这些此前全塞在 documentation 一个 text 字段里，无法结构化校验与检索。
-- 全部可空——存量 40 行不受影响，迁移（V12-3.7）时再逐步回填。

alter table public.skills
  add column if not exists goal        text,   -- 目标及适用条件
  add column if not exists sop         text,   -- SOP / 执行步骤
  add column if not exists rules       text,   -- 业务规则
  add column if not exists examples    jsonb,  -- 正反例 [{good|bad, content}]
  add column if not exists io_schema   jsonb,  -- 输入输出定义
  -- 迁移完成标记：V12-3.7 双读校验期间用它区分「已迁 / 未迁」，切换后可清理
  add column if not exists migrated_at timestamptz;

comment on column public.skills.migrated_at is
  'V12-3.7 迁移标记。双读校验期用于区分已迁/未迁；切换完成并观察期结束后可清理该列。';
