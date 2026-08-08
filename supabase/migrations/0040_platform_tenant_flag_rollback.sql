-- 0040 回滚：撤销平台运营租户标记
-- ⚠️ 撤销后 isPlatformAdmin 会退回「只查 allowlist」，
--    平台超管切到客户组织将重新带着跨租户权限——需同步回退 lib/auth/platform.ts。
drop index if exists public.uq_tenants_single_platform;
alter table public.tenants drop column if exists is_platform;
