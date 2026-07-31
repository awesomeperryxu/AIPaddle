-- 回滚 0030_credentials.sql
--
-- 会丢失：credentials 表及其全部数据（含加密凭证密文，不可恢复）。
-- 🔴 回滚前务必确认：租户是否已在此表配置真实凭证。若有，回滚等于让用户重配全部凭据。
-- 前置条件：先摘除 tool_versions 的外键，再 drop 表。
-- 幂等：用 if exists，可重复执行。

alter table if exists public.tool_versions
  drop constraint if exists tool_versions_credential_id_fkey;

drop table if exists public.credentials;
