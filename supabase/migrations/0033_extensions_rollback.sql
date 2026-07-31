-- 回滚 0033_extensions.sql
--
-- 会丢失：extensions / extension_versions / extension_api_keys 三表及全部数据。
-- 🔴 含已签发的 Key 哈希——回滚后所有外部接入方（如黑围裙官网）的 Key 立即失效，
--    且无法恢复（明文本就不落库）。回滚前须通知接入方。
-- 前置条件：确认无 extension_calls 等后续表的外键指向（本期未建）。
-- 幂等：用 if exists，可重复执行。

drop table if exists public.extension_api_keys;
drop table if exists public.extension_versions;
drop table if exists public.extensions;
