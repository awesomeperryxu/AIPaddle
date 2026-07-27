-- 4.8.14a（通道 G）：组织架构数据层。
-- 背景：0001 起 users.department 一直是自由文本（"C1：文本字段，切片5 组织架构时再升级"），
-- 无法做树形层级、负责人、成本中心与部门状态管理。本迁移建 departments 树形表并回填存量文本。
--
-- 兼容策略（关键）：users.department 文本字段**保留不删**，作为 department_id 的派生冗余，
-- 由应用层在改部门时同步维护。原因是 mcp_servers.allowed_departments 与其视图按**部门名字符串**
-- 匹配授权（见 0002_mcp_servers.sql），贸然删列会让 MCP 授权整体回归。
-- 收口为单一事实源（department_id）安排在 4.8.14b 之后单独迁移处理。
--
-- 本迁移不含部门级配额列（PRD 2.10.1 的 Token/存储/Agent 数/并发限额）：
-- 配额与已上线的租户级配额（4.8.2）的分配与继承关系尚待拍板，另立迁移。

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.tenants(id),
  parent_id   uuid references public.departments(id),
  name        text not null,
  leader_id   uuid references public.users(id),          -- 部门负责人
  cost_center text,                                       -- 成本中心编码
  status      text not null default 'active'
              check (status in ('active','frozen','revoked')),  -- 正常/冻结/已撤销
  sort_order  int not null default 0,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.departments is
  '4.8.14a 组织架构树；parent_id 自引用，层级 ≤5 与禁止成环由应用层校验（lib/data/departments.ts）。';
comment on column public.users.department is
  '4.8.14a 起为 department_id 的派生冗余（部门名快照），仅供 mcp_servers.allowed_departments 字符串匹配沿用；写入以 department_id 为准。';

-- 同租户同父级下部门名不重复（软删的不算）。parent_id 为空时用全零 uuid 占位参与唯一性。
create unique index uq_departments_sibling_name
  on public.departments (org_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name)
  where deleted_at is null;
create index idx_departments_org    on public.departments (org_id) where deleted_at is null;
create index idx_departments_parent on public.departments (parent_id) where deleted_at is null;

-- RLS：租户隔离（比照 ADR-001/0020 模式；细粒度动作权限 department:manage 在应用层强制）
alter table public.departments enable row level security;
create policy departments_org_select on public.departments
  for select using (org_id = public.current_org_id());
create policy departments_org_insert on public.departments
  for insert with check (org_id = public.current_org_id());
create policy departments_org_update on public.departments
  for update using (org_id = public.current_org_id());

-- ── users 挂接部门 ────────────────────────────────────────
alter table public.users add column if not exists department_id uuid references public.departments(id);
create index idx_users_department on public.users (department_id) where deleted_at is null;

-- ── 存量数据迁移：按 org 去重把文本部门建成一级部门，再回填 department_id ──
insert into public.departments (org_id, name)
select distinct u.org_id, btrim(u.department)
from public.users u
where u.department is not null
  and btrim(u.department) <> ''
  and u.deleted_at is null
on conflict do nothing;

update public.users u
set department_id = d.id
from public.departments d
where d.org_id = u.org_id
  and d.name = btrim(u.department)
  and d.parent_id is null
  and d.deleted_at is null
  and u.department_id is null
  and u.department is not null
  and btrim(u.department) <> '';
