-- 回滚 0031_skill_dependencies.sql
--
-- 会丢失：两张依赖表及其全部数据；skills 的 6 个扩展列及其内容。
-- 🔴 若 V12-3.7 已执行迁移，skills 的 goal/sop/rules/examples/io_schema 里可能已有
--    从 documentation 拆出来的真实业务内容——回滚前必须确认这些内容在别处仍有副本，
--    否则是**真实数据丢失**。
-- 幂等：用 if exists，可重复执行。

drop table if exists public.skill_kb_dependencies;
drop table if exists public.skill_plugin_dependencies;

alter table public.skills
  drop column if exists goal,
  drop column if exists sop,
  drop column if exists rules,
  drop column if exists examples,
  drop column if exists io_schema,
  drop column if exists migrated_at;
