-- ============================================================
-- 0040：标记平台运营租户（ADR-025 配套）
--
-- 🔴 多组织归属后，同一个人既是平台超管、又是客户租户的 Admin。
-- isPlatformAdmin 若只查 allowlist，他切到客户组织仍带着跨租户权限——
-- 能在客户视角下停用别家租户，审计也分不清当时是哪种身份。
-- 加这个标记后：停在平台运营租户 = 平台超管；切到客户租户 = 纯租户 Admin。
-- ============================================================

alter table public.tenants
  add column if not exists is_platform boolean not null default false;

comment on column public.tenants.is_platform is
  '平台运营租户。平台超管权限只在活跃组织为此类租户时生效（ADR-025）';

-- 当前唯一的运营方租户（原 AIPaddle Demo，已更名为「平台管理团队」）
update public.tenants set is_platform = true where code = 'aipaddle-demo';

-- 🔴 有且只应有一个平台运营租户：多于一个等于开了多个后门，
-- 且 isPlatformAdmin 的语义会变得含糊（在哪个才算数？）
create unique index if not exists uq_tenants_single_platform
  on public.tenants ((true)) where is_platform;
