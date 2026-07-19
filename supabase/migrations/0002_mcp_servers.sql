-- ============================================================
-- AIPaddle migration 0002：MCP Server 注册中心（ADR-004）
-- 规则：平台内全部 MCP 能力经 Skill 封装；本表是连接层的唯一注册与授权点
-- ============================================================

create table public.mcp_servers (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.tenants(id),
  created_by     uuid not null references public.users(id),
  name           text not null,
  description    text,
  type           text not null default 'enterprise'
                 check (type in ('builtin','enterprise','third_party','private')),  -- PRD 2.9.4 分类
  endpoint       text not null,
  auth_type      text not null default 'api_key' check (auth_type in ('api_key','oauth','jwt','none')),
  auth_config    jsonb not null default '{}',    -- 凭据经 Vault 加密引用，不存明文（ADR-004 补足条款3）
  scope          text,                            -- 可访问资源说明
  rate_limit_tps int not null default 10,        -- Server 级限流（保护企业系统）
  audit_enabled  boolean not null default true,
  security_level text not null default 'medium' check (security_level in ('low','medium','high')),
  status         text not null default 'draft'
                 check (status in ('draft','pending','approved','disabled')),      -- 注册审批状态机
  -- ADR-004 规则3：MCP 权限按用户权限分配——角色与部门双维授权
  allowed_roles       text[] not null default '{Admin}',   -- 哪些角色可见/可封装
  allowed_departments text[] not null default '{}',        -- 空数组 = 不限部门
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (org_id, name)
);

create index idx_mcp_org on public.mcp_servers (org_id, status) where deleted_at is null;

create trigger trg_mcp_servers_updated before update on public.mcp_servers
  for each row execute function public.set_updated_at();

alter table public.mcp_servers enable row level security;

-- 基础租户隔离
create policy mcp_org_select on public.mcp_servers for select
  using (org_id = public.current_org_id() and deleted_at is null);
create policy mcp_org_insert on public.mcp_servers for insert
  with check (org_id = public.current_org_id());
create policy mcp_org_update on public.mcp_servers for update
  using (org_id = public.current_org_id());

-- 按权限过滤的"我的可用 MCP 清单"视图（应用层查询入口；角色过滤在此实现）
create or replace view public.my_mcp_servers as
select m.*
from public.mcp_servers m
where m.deleted_at is null
  and m.status = 'approved'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.deleted_at is null
      and ur.role = any (m.allowed_roles)
  )
  and (
    m.allowed_departments = '{}'
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.department = any (m.allowed_departments)
    )
  );

comment on table public.mcp_servers is
  'MCP 连接注册中心（ADR-004）。平台内调用必须经 Skill 封装（skills.config.mcp_server_id 引用本表）；Server 禁用时应用层须联动禁用引用它的 Skill。';
comment on view public.my_mcp_servers is
  '当前用户按角色+部门权限可见的已审批 MCP 清单——Skill 创建表单的 Server 下拉数据源。';

-- 软删除纪律与 0001 一致
revoke delete on public.mcp_servers from authenticated, anon;
