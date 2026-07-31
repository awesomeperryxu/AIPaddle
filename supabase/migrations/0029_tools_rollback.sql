-- 回滚 0029_tools.sql
--
-- 会丢失：tools / tool_versions 两表及其全部数据。
-- 前置条件：无其他表的外键指向这两张表。
--   ⚠️ 0031(skill_plugin_dependencies) 的 object_id 逻辑上指向 tools，但为多态列
--      未建外键 —— 回滚前须确认无依赖行残留，否则会留下悬空引用。
-- 顺序：本迁移须**先于** 0028 回滚（tools.plugin_id 引用 plugins）。
-- 幂等：用 if exists，可重复执行。

drop table if exists public.tool_versions;
drop table if exists public.tools;
