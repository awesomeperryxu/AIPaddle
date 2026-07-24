-- 4.4.10 工作流版本快照：发布时存图快照，支持查看历史版本 + 回滚。
-- 编号 0009（避让 T 道 templates 的 0008）。版本为不可变快照，仅 select/insert。

create table public.workflow_versions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.tenants(id),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  version     int  not null,
  graph       jsonb not null,
  note        text,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  unique (workflow_id, version)
);

alter table public.workflow_versions enable row level security;

-- RLS：仅本租户可见/可写（org 由可信会话推导，见 ADR-002）。快照不可改/删。
create policy workflow_versions_org_select on public.workflow_versions
  for select using (org_id = public.current_org_id());
create policy workflow_versions_org_insert on public.workflow_versions
  for insert with check (org_id = public.current_org_id());

create index idx_workflow_versions on public.workflow_versions (workflow_id, version desc);
