-- ============================================================
-- 0039 回滚：撤销多组织归属（ADR-025）
--
-- 🔴 顺序要紧：先把 current_org_id() 改回只读 org_id，再删列。
--    反过来的话，函数还引用着 active_org_id 而列已经没了，
--    所有 RLS 策略会在下一次求值时报错——等于整站数据读不出来。
-- ============================================================

-- ① 地基改回单值归属
create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = public as
$$ select org_id from public.users where id = auth.uid() $$;

-- ② 撤销归属校验
drop trigger if exists trg_assert_active_org on public.users;
drop function if exists public.assert_active_org_membership();

-- ③ 角色唯一索引还原为不含 org_id
--    ⚠️ 若已有人在两个组织各持同名角色，这一步会失败——需先人工决定保留哪条。
drop index if exists public.uq_user_roles_active_org;
create unique index if not exists uq_user_roles_active
  on public.user_roles (user_id, role) where deleted_at is null;

-- ④ 删列与归属表（放最后：此时已无任何东西引用它们）
alter table public.users drop column if exists active_org_id;
drop table if exists public.user_orgs;
