-- 回滚 0036_leads_and_notifications.sql
--
-- ⚠️ 会丢失全部留资线索与通知记录 —— leads 是**真实商机数据**，删掉不可复原。
-- 回滚前务必先导出：
--   \copy (select * from public.leads where deleted_at is null) to 'leads_backup.csv' csv header
--
-- 顺序：先删 notification_deliveries（外键指向 leads），再删 leads。
-- 幂等：用 if exists，可重复执行。

drop table if exists public.notification_deliveries;
drop table if exists public.leads;
