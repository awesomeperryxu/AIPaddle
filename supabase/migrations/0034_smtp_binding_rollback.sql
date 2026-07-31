-- 回滚 0034_smtp_binding.sql —— 把 binding_type / kind 收回 4 类。
--
-- 🔴 前置条件：库中不能已有 binding_type='smtp' 或 kind='smtp' 的行，
--    否则 add constraint 会因既有数据违约而失败。回滚前先查：
--      select count(*) from tools where binding_type='smtp';
--      select count(*) from credentials where kind='smtp';
--    有数据则须先处理（改类型或软删），不可强行回滚。
-- 幂等：drop 用 if exists，可重复执行。

alter table public.tools drop constraint if exists tools_binding_type_check;
alter table public.tools add constraint tools_binding_type_check
  check (binding_type in ('mcp', 'api', 'db', 'native'));

alter table public.credentials drop constraint if exists credentials_kind_check;
alter table public.credentials add constraint credentials_kind_check
  check (kind in ('oauth', 'api_key', 'jwt', 'db_secret'));
