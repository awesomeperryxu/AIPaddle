-- BUG-83：企业编码唯一约束改为「只约束在册租户」，与应用层查重语义对齐。
--
-- 现场：注销（软删）过 code=PinQi 的租户后，再用同一编码开通报
-- `duplicate key value violates unique constraint "tenants_code_key"`。
-- 根因：0001 的 `code text not null unique` 是**全表**唯一、不认软删；而
-- provisionTenant 的查重是 `.eq('code',code).is('deleted_at',null)`——认为软删的不占。
-- 两者语义打架 → 应用层放行、数据库拦下、把 Postgres 原文甩给用户。
--
-- 取舍：让**数据库对齐应用层**（注销后编码可复用），而不是反过来禁止复用。
-- 理由是 4.8.9 的注销就是软删，若编码永久占用，等于注销一次就永久烧掉一个编码，
-- 且用户无从得知（表里查不到那条租户）。审计留痕按 tenant_id 记录，不依赖 code。

alter table public.tenants drop constraint if exists tenants_code_key;

create unique index if not exists uq_tenants_code_active
  on public.tenants (code)
  where deleted_at is null;

comment on index public.uq_tenants_code_active is
  'BUG-83：企业编码仅在「在册（deleted_at is null）」租户间唯一；已注销租户的编码可被复用。';
