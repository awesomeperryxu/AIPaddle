-- ============================================================
-- 0003：软删除 RLS 修复
-- 问题：迁移 0001 给所有业务表的 SELECT 策略加了 `deleted_at IS NULL`。
--       PostgreSQL 在 UPDATE 时要求"更新后的行仍满足 SELECT 策略"，
--       软删除（set deleted_at = now()）会让行 deleted_at 非空 → 不再满足
--       SELECT 策略 → 报 "new row violates row-level security policy"。
--       结果：C6 约定的"应用层 update deleted_at 软删除"在 RLS 下无法执行。
-- 修复：SELECT 策略只按租户隔离（org_id / tenants.id = current_org_id()），
--       去掉 deleted_at 条件；软删除的过滤交给应用层查询（lib/data/* 一律
--       `.is('deleted_at', null)`）。这是 Supabase 软删除的推荐模式。
-- 影响：RLS 层现在能查到软删行，但应用层默认过滤；隔离（按 org）不变。
-- ============================================================

do $$
declare r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and cmd = 'SELECT'
      and qual ilike '%deleted_at%'
      and tablename <> 'tenants'
  loop
    execute format(
      'alter policy %I on public.%I using (org_id = public.current_org_id())',
      r.policyname, r.tablename
    );
  end loop;

  -- tenants 用 id 而非 org_id
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tenants'
      and policyname = 'tenant_read' and qual ilike '%deleted_at%'
  ) then
    execute 'alter policy tenant_read on public.tenants using (id = public.current_org_id())';
  end if;
end $$;
