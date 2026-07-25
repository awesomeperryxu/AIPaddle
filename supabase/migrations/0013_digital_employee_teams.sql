-- 4.1.19 / ADR-014：数字员工团队 = 多个数字员工的扁平组合（最多 1 级，无团队套团队）。
-- 成员必须是数字员工（引用了子 Agent 的 Agent）；门控在服务端做，此处只存关联。
-- 镜像现有 org 范围实体（agents/workflows）：org_id + status + 软删 + 按租户 RLS。

create table public.digital_employee_teams (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.tenants(id),
  name        text not null,
  description text,
  status      text not null default 'draft'
              check (status in ('draft','pending','published','offline')),
  created_by  uuid references public.users(id),
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 团队成员：成员只能是 agent（数字员工），天然不含 team → 团队不套团队。
create table public.team_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.tenants(id),
  team_id    uuid not null references public.digital_employee_teams(id) on delete cascade,
  agent_id   uuid not null references public.agents(id),
  ord        int  not null default 0,
  created_at timestamptz not null default now(),
  unique (team_id, agent_id)
);

alter table public.digital_employee_teams enable row level security;
alter table public.team_members enable row level security;

-- RLS：仅本租户可见/可写（org 由可信会话推导，见 ADR-002；写法参照 0009 workflow_versions）。
create policy digital_employee_teams_org_select on public.digital_employee_teams
  for select using (org_id = public.current_org_id());
create policy digital_employee_teams_org_insert on public.digital_employee_teams
  for insert with check (org_id = public.current_org_id());
create policy digital_employee_teams_org_update on public.digital_employee_teams
  for update using (org_id = public.current_org_id());

create policy team_members_org_select on public.team_members
  for select using (org_id = public.current_org_id());
create policy team_members_org_insert on public.team_members
  for insert with check (org_id = public.current_org_id());
create policy team_members_org_update on public.team_members
  for update using (org_id = public.current_org_id());

create index idx_team_members_team on public.team_members (team_id);
