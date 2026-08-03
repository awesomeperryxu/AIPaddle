-- 0037 回滚：把 provider_type 收回 ('mcp','api','db')。
--
-- 🔴 回滚前必须先处理存量：若已有 provider_type='smtp' 的 Plugin，
-- 加约束会直接失败。下面先查再动，宁可报错也不静默删数据。

do $$
declare
  n int;
begin
  select count(*) into n from public.plugins where provider_type = 'smtp';
  if n > 0 then
    raise exception '仍有 % 个 provider_type=smtp 的 Plugin，请先迁移或删除后再回滚', n;
  end if;
end $$;

alter table public.plugins
  drop constraint if exists plugins_provider_type_check;
alter table public.plugins
  add constraint plugins_provider_type_check
    check (provider_type in ('mcp', 'api', 'db'));

comment on column public.plugins.provider_type is
  'mcp | api | db。';
