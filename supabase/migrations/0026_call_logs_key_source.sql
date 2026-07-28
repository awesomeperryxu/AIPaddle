-- 4.8.17a：call_logs 记录「这次调用用的是谁的 Key」。
--
-- 背景：ADR-016 / 4.8.5 起租户可自带 API Key（BYO）——那些调用平台零成本。
-- 但 call_logs 只有 org_id/model/tokens，**无法区分 BYO 与平台调用**，导致：
--   · 平台成本被高估（把 BYO 的 token 也按平台单价算进去）
--   · 租户管理页的「收入趋势」实为成本估算，且混入了平台根本没花钱的部分
-- 运行时其实早就知道来源（lib/ai/resolve.ts 的 ResolvedClient.source），只是没落库。
--
-- ⚠️ 历史数据无法追溯：本迁移之前的调用一律为 NULL，只能从现在起区分。
-- 统计口径因此定为：key_source = 'platform' 才计入平台成本；
-- NULL（历史）单独归类为「未知来源」，不硬塞进任何一边，避免制造假精确。

alter table public.call_logs
  add column if not exists key_source text
    check (key_source in ('tenant', 'platform')),
  add column if not exists provider text;

comment on column public.call_logs.key_source is
  '4.8.17a：tenant=租户自配 Key（BYO，平台零成本）/ platform=平台 env Key；NULL=本迁移前的历史数据，来源未知。';
comment on column public.call_logs.provider is
  '4.8.17a：供应商标识（openai-compat / openai / custom / platform-env …），用于按供应商分摊成本。';

-- 成本聚合按 (org_id, key_source, created_at) 过滤，建组合索引
create index if not exists idx_call_logs_org_source_created
  on public.call_logs (org_id, key_source, created_at desc)
  where deleted_at is null;
