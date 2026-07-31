-- 回滚 0034_extension_identity_and_key_merge.sql
--
-- 会丢失：api_keys 上 Extension 相关的 7 列及其数据（scopes / allowed_origins /
--         rate_limit_per_min / expires_at / extension_id / deleted_at / updated_at）、
--         users.is_service_account、extensions.service_user_id。
-- ⚠️ 回滚前须确认：已无任何 Extension 在用（extensions 表清空或 service_user_id 全为 null），
--    否则外部调用会立刻失去身份来源而全部 401/查空。
-- ⚠️ 本回滚**不重建** extension_api_keys —— 0033 的 rollback 才管那张表；
--    若确需回到 0033 的双表状态，须在本脚本之后再执行 0033_extensions_rollback.sql 的对应片段。
-- 幂等：用 if exists，可重复执行。

drop index if exists public.idx_api_keys_extension;
drop index if exists public.idx_api_keys_active_hash;

alter table public.api_keys
  drop column if exists updated_at,
  drop column if exists deleted_at,
  drop column if exists expires_at,
  drop column if exists rate_limit_per_min,
  drop column if exists allowed_origins,
  drop column if exists scopes,
  drop column if exists extension_id;

drop index if exists public.uq_extensions_service_user;
alter table public.extensions
  drop column if exists service_user_id;

drop index if exists public.idx_users_service_account;
alter table public.users
  drop column if exists is_service_account;
