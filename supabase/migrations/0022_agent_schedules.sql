-- 4.1.25：Agent 定时作业（Schedule Trigger）——配置端。
-- agent_schedules：每 agent 至多一条定时配置（UNIQUE agent_id+org_id）。
-- agent_schedule_runs：执行历史明细（4.1.26 执行端写入）。
-- RLS：租户级隔离，普通客户端只能读写本租户数据；执行端用 service_role 跳过 RLS。

create table public.agent_schedules (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.tenants(id),
  agent_id             uuid not null references public.agents(id) on delete cascade,
  cron_expr            text not null,
  trigger_prompt       text not null,
  is_enabled           boolean not null default true,
  next_run_at          timestamptz,
  last_run_at          timestamptz,
  last_status          text check (last_status in ('success','error')),
  consecutive_failures int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (org_id, agent_id)
);

alter table public.agent_schedules enable row level security;

create policy "tenant_rls_schedules" on public.agent_schedules
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create table public.agent_schedule_runs (
  id          uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.agent_schedules(id) on delete cascade,
  org_id      uuid not null references public.tenants(id),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null check (status in ('running','success','error')),
  reply_snippet text,
  error       text,
  duration_ms int
);

alter table public.agent_schedule_runs enable row level security;

create policy "tenant_rls_schedule_runs" on public.agent_schedule_runs
  using (org_id = current_org_id())
  with check (org_id = current_org_id());
