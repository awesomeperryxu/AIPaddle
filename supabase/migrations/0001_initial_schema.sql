-- ============================================================
-- AIPaddle 初始数据库结构 v1.0
-- 依据：docs/design/ERD-数据库设计确认页.html（2026-07-18 用户确认）
-- 决策：C1 部门文本字段 | C2 统一中间表 | C3 对话/计量分表
--       C4 多角色 user_roles | C5 向量 1536 维 | C6 全业务表软删除
-- 约定：所有业务表带 org_id + RLS；audit_logs 只插不改不删
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists vector;

-- ── 通用：updated_at 自动维护 ──────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── 租户 ──────────────────────────────────────────────────
create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  code          text not null unique,
  short_name    text,
  industry      text,
  company_size  text,
  country       text,
  timezone      text default 'Asia/Shanghai',
  logo_url      text,
  contact_name  text,
  contact_email text,
  contact_phone text,
  plan_type     text not null default 'free'
                check (plan_type in ('free','standard','pro','enterprise')),
  billing_mode  text default 'usage' check (billing_mode in ('usage','monthly')),
  token_quota   bigint not null default 1000000,
  qps_limit     int    not null default 10,
  storage_quota bigint not null default 21474836480, -- 20GB
  status        text not null default 'active' check (status in ('active','suspended')),
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── 成员（关联 Supabase Auth）──────────────────────────────
create table public.users (
  id             uuid primary key references auth.users(id) on delete cascade,
  org_id         uuid not null references public.tenants(id),
  name           text not null,
  email          text not null unique,
  department     text,                    -- C1：文本字段，切片5 组织架构时再升级
  status         text not null default 'active' check (status in ('active','inactive')),
  last_active_at timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- C4：多角色
create table public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.tenants(id),
  user_id    uuid not null references public.users(id) on delete cascade,
  role       text not null check (role in ('Admin','Developer','User','Auditor')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- ── Agent（PRD 2.2）───────────────────────────────────────
create table public.agents (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.tenants(id),
  created_by       uuid not null references public.users(id),
  name             text not null,
  description      text,
  department       text,
  status           text not null default 'draft'
                   check (status in ('draft','pending','published','offline')),
  usage_scenarios  text[] not null default '{}',
  config           jsonb not null default '{}',
  metrics_calls    bigint not null default 0,
  metrics_success  bigint not null default 0,
  metrics_avg_ms   int    not null default 0,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- C2：统一资源关联中间表
create table public.agent_resources (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.tenants(id),
  agent_id      uuid not null references public.agents(id) on delete cascade,
  resource_type text not null check (resource_type in ('skill','knowledge_base','workflow')),
  resource_id   uuid not null,            -- 指向对应表；同租户校验在应用层+触发器
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (agent_id, resource_type, resource_id)
);

-- ── 知识库（PRD 2.4）──────────────────────────────────────
create table public.knowledge_bases (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.tenants(id),
  name        text not null,
  description text,
  department  text,
  status      text not null default 'active' check (status in ('active','indexing','error')),
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.tenants(id),
  kb_id        uuid not null references public.knowledge_bases(id) on delete cascade,
  filename     text not null,
  storage_path text not null,
  size_bytes   bigint not null default 0,
  status       text not null default 'uploading'
               check (status in ('uploading','parsing','active','error')),
  error_msg    text,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.chunks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.tenants(id),
  document_id uuid not null references public.documents(id) on delete cascade,
  content     text not null,
  metadata    jsonb not null default '{}',   -- 页码、段落序号等
  embedding   vector(1536),                   -- C5：1536 维
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- ── Skill（PRD 2.3）───────────────────────────────────────
create table public.skills (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.tenants(id),
  publisher_id  uuid not null references public.users(id),
  name          text not null,
  description   text,
  type          text not null check (type in ('MCP','API','DB','Workflow','Prompt')),
  version       text not null default '1.0.0',
  installs      bigint not null default 0,
  rating        numeric(2,1) default 0,
  risk_level    text not null default 'low' check (risk_level in ('low','medium','high')),
  status        text not null default 'draft' check (status in ('draft','pending','published')),
  tags          text[] not null default '{}',
  documentation text,
  config        jsonb not null default '{}',
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.skill_installs (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.tenants(id),
  skill_id   uuid not null references public.skills(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (skill_id, user_id)               -- 安装幂等
);

-- ── 工作流（PRD 2.5）──────────────────────────────────────
create table public.workflows (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.tenants(id),
  created_by        uuid not null references public.users(id),
  name              text not null,
  type              text not null default 'workflow' check (type in ('workflow','chatflow')),
  graph             jsonb not null default '{"nodes":[],"edges":[]}',
  version           int  not null default 1,
  published_version int,
  status            text not null default 'draft' check (status in ('draft','published')),
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.workflow_runs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.tenants(id),
  workflow_id  uuid not null references public.workflows(id) on delete cascade,
  triggered_by uuid references public.users(id),
  status       text not null default 'running'
               check (status in ('waiting','running','succeeded','failed','exception','paused')),
  input        jsonb,
  output       jsonb,
  node_traces  jsonb not null default '[]',  -- 每节点状态/耗时/错误
  duration_ms  int,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ── 对话（C3：内容与计量分表）─────────────────────────────
create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.tenants(id),
  agent_id   uuid references public.agents(id),
  user_id    uuid not null references public.users(id),
  title      text,
  source     text not null default 'agents' check (source in ('agents','assistant')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.tenants(id),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  content         text not null,
  tokens          int not null default 0,
  citations       jsonb not null default '[]',  -- RAG 引用：[{document_id, chunk_id, filename}]
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

create table public.call_logs (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.tenants(id),
  agent_id   uuid references public.agents(id),
  user_id    uuid references public.users(id),
  model      text,
  tokens_in  int not null default 0,
  tokens_out int not null default 0,
  latency_ms int,
  success    boolean not null default true,
  error_code text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── 安全与审计（PRD 2.7 / 2.9.7）──────────────────────────
create table public.security_reviews (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.tenants(id),
  type         text not null check (type in ('agent','skill','knowledge','permission')),
  resource_id  uuid not null,
  submitter_id uuid not null references public.users(id),
  risk_level   text not null default 'medium' check (risk_level in ('low','medium','high')),
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_id  uuid references public.users(id),
  comments     text,
  reviewed_at  timestamptz,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.tenants(id),
  actor_id    uuid references public.users(id),
  action      text not null,               -- 如 agent.publish / review.approve
  target_type text,
  target_id   uuid,
  detail      jsonb not null default '{}',
  ip          inet,
  created_at  timestamptz not null default now()
  -- 注意：无 deleted_at / updated_at —— 审计不可篡改
);

-- ── 索引 ──────────────────────────────────────────────────
create index idx_users_org        on public.users (org_id) where deleted_at is null;
create index idx_user_roles_user  on public.user_roles (user_id) where deleted_at is null;
create index idx_agents_org       on public.agents (org_id, status) where deleted_at is null;
create index idx_agent_res_agent  on public.agent_resources (agent_id) where deleted_at is null;
create index idx_kb_org           on public.knowledge_bases (org_id) where deleted_at is null;
create index idx_docs_kb          on public.documents (kb_id) where deleted_at is null;
create index idx_chunks_doc       on public.chunks (document_id) where deleted_at is null;
create index idx_chunks_embedding on public.chunks using hnsw (embedding vector_cosine_ops);
create index idx_skills_org       on public.skills (org_id, type) where deleted_at is null;
create index idx_workflows_org    on public.workflows (org_id) where deleted_at is null;
create index idx_wf_runs_wf       on public.workflow_runs (workflow_id);
create index idx_conv_user        on public.conversations (user_id) where deleted_at is null;
create index idx_msgs_conv        on public.messages (conversation_id) where deleted_at is null;
create index idx_call_logs_org    on public.call_logs (org_id, created_at);
create index idx_reviews_org      on public.security_reviews (org_id, status) where deleted_at is null;
create index idx_audit_org        on public.audit_logs (org_id, created_at);

-- ── updated_at 触发器 ─────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['tenants','users','agents','knowledge_bases','documents',
                           'skills','workflows','conversations']
  loop
    execute format('create trigger trg_%s_updated before update on public.%I
                    for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ── RLS：租户隔离（ADR-001 双层防护的数据库层）─────────────
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as
$$ select org_id from public.users where id = auth.uid() $$;

do $$
declare t text;
begin
  foreach t in array array['tenants','users','user_roles','agents','agent_resources',
                           'knowledge_bases','documents','chunks','skills','skill_installs',
                           'workflows','workflow_runs','conversations','messages','call_logs',
                           'security_reviews','audit_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- tenants：成员只能读自己租户
create policy tenant_read on public.tenants
  for select using (id = public.current_org_id() and deleted_at is null);

-- 业务表统一策略：同租户可读写（细粒度角色控制在应用层做，见 ADR-002）
do $$
declare t text;
begin
  foreach t in array array['users','user_roles','agents','agent_resources',
                           'knowledge_bases','documents','chunks','skills','skill_installs',
                           'workflows','workflow_runs','conversations','messages','call_logs',
                           'security_reviews']
  loop
    execute format('create policy %I_org_select on public.%I for select
                    using (org_id = public.current_org_id() and deleted_at is null)', t, t);
    execute format('create policy %I_org_insert on public.%I for insert
                    with check (org_id = public.current_org_id())', t, t);
    execute format('create policy %I_org_update on public.%I for update
                    using (org_id = public.current_org_id())', t, t);
  end loop;
end $$;

-- call_logs 无 update 需求，撤销刚建的 update 策略
drop policy call_logs_org_update on public.call_logs;

-- audit_logs：只可插入与读取，禁止改删（数据库层强制）
create policy audit_select on public.audit_logs
  for select using (org_id = public.current_org_id());
create policy audit_insert on public.audit_logs
  for insert with check (org_id = public.current_org_id());
revoke update, delete on public.audit_logs from authenticated, anon;

-- C6：全业务表软删除 —— 应用层一律 update deleted_at，禁用物理 delete
revoke delete on all tables in schema public from authenticated, anon;
