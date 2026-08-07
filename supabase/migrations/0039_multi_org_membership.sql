-- ============================================================
-- 0039：一个账号归属多组织 + 活跃组织切换（ADR-025）
--
-- 🔴 本迁移改动 current_org_id() —— 全站 RLS 隔离的地基。任何疏漏都是跨租户数据泄露。
--    回填策略保证「跑完之后行为与跑之前完全一致」：每人一条归属、活跃组织=原组织。
--    这是能分步上线的前提，也是出问题时判断「是迁移引入的还是本来就有的」的基线。
-- ============================================================

-- ── ① 归属集合：这个人可以进哪些组织 ──────────────────────────
create table if not exists public.user_orgs (
  user_id    uuid not null references public.users(id) on delete cascade,
  org_id     uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

alter table public.user_orgs enable row level security;

-- 本人可读自己的归属（组织切换器要列出可选项）；写入只走 service_role / 运维。
drop policy if exists user_orgs_self_read on public.user_orgs;
create policy user_orgs_self_read on public.user_orgs
  for select using (user_id = auth.uid());

-- 回填：每个现存用户 = 一条归属（含已软删用户，避免恢复后归属缺失）
insert into public.user_orgs (user_id, org_id)
select id, org_id from public.users
on conflict do nothing;

-- ── ② 活跃组织：此刻以哪个组织的身份操作 ──────────────────────
alter table public.users
  add column if not exists active_org_id uuid references public.tenants(id);

update public.users set active_org_id = org_id where active_org_id is null;

-- ── ③ 角色按组织区分 ─────────────────────────────────────────
-- 原索引是 (user_id, role)，同一个人无法在两个组织各持一个 Admin。
-- 角色本就该是「在某组织里的角色」。
drop index if exists public.uq_user_roles_active;
create unique index if not exists uq_user_roles_active_org
  on public.user_roles (user_id, org_id, role) where deleted_at is null;

-- ── ④ RLS 地基改为读活跃组织 ─────────────────────────────────
-- coalesce 兜底：active_org_id 为空时退回主组织，任何时刻都能解析出一个租户，
-- 不会因为空值让 current_org_id() 返回 null 而把人的数据全部挡住。
create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = public as
$$ select coalesce(active_org_id, org_id) from public.users where id = auth.uid() $$;

-- ── ⑤ 🔴 安全底线：活跃组织只能切到自己归属的组织 ──────────────
-- active_org_id 直接决定 RLS 放行哪一家的数据。若能自行改成任意 uuid，
-- 等于一键越权到任意租户。应用层会校验，但这里是绕不过去的最后一道。
create or replace function public.assert_active_org_membership() returns trigger
language plpgsql as $$
begin
  if new.active_org_id is not null
     and new.active_org_id is distinct from old.active_org_id
     and not exists (
       select 1 from public.user_orgs uo
       where uo.user_id = new.id and uo.org_id = new.active_org_id
     )
  then
    raise exception '不能切换到未归属的组织（user=% org=%）', new.id, new.active_org_id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_assert_active_org on public.users;
create trigger trg_assert_active_org
  before update of active_org_id on public.users
  for each row execute function public.assert_active_org_membership();

-- ── ⑥ 本次业务数据：两个平台超管同时归属「平台管理团队」与「北京品器」 ──
-- 品器有两条同名租户记录（code 均为 PinQi），取有历史成员的那条（成员迁出前 zhangdd 所在）。
with pinqi as (
  select id from public.tenants where name = '北京品器管理咨询有限公司' limit 1
), platform as (
  select id from public.tenants where code = 'aipaddle-demo' limit 1
), targets as (
  select id as user_id from public.users
  where email in ('perry@aipaddle.net', 'zhangdd@aipaddle.net')
)
insert into public.user_orgs (user_id, org_id)
select t.user_id, o.id
from targets t
cross join (select id from pinqi union all select id from platform) o
on conflict do nothing;

-- 在品器也给 Admin 角色（新唯一索引含 org_id，与平台管理团队的 Admin 并存）
with pinqi as (
  select id from public.tenants where name = '北京品器管理咨询有限公司' limit 1
)
insert into public.user_roles (org_id, user_id, role)
select p.id, u.id, 'Admin'
from public.users u cross join pinqi p
where u.email in ('perry@aipaddle.net', 'zhangdd@aipaddle.net')
  and not exists (
    select 1 from public.user_roles r
    where r.user_id = u.id and r.org_id = p.id and r.role = 'Admin' and r.deleted_at is null
  );
