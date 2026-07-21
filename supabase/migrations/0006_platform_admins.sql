-- ============================================================
-- 0006：平台超管 allowlist（ADR-010）
-- platform_admins 成员即平台超管，可跨租户开通/停用/列出全部租户。
-- 授权与 org 角色矩阵(ADR-007)正交。写入只走 service_role（seed/运维）。
-- RLS：仅本人可读自己的记录（供 isPlatformAdmin 自检）。
-- ============================================================

create table if not exists public.platform_admins (
  user_id    uuid primary key references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- 本人可读自己的平台超管记录（isPlatformAdmin 自检用）；写入不开放给请求级客户端。
drop policy if exists platform_admins_self_read on public.platform_admins;
create policy platform_admins_self_read on public.platform_admins
  for select
  using (user_id = auth.uid());
