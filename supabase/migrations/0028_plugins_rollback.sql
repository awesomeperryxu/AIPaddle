-- 回滚 0028_plugins.sql
--
-- 会丢失：plugins / plugin_versions 两表及其全部数据。
-- 前置条件：无其他表的外键指向这两张表。
--   ⚠️ 0029(tools) 的 tools.plugin_id 引用 plugins(id) —— 若 0029 已 apply，
--      必须先回滚 0029 再回滚本迁移，否则 drop 会被外键阻断。
-- 幂等：用 if exists，可重复执行。

drop table if exists public.plugin_versions;
drop table if exists public.plugins;
