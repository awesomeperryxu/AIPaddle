-- 4.8.17c：模型定价表，取代散落在代码里的硬编码单价。
--
-- 背景：单价此前是 lib/data/dashboard.ts 里的常量 QWEN_PLUS_PRICE={in:0.0008,out:0.002}，
-- 被监控看板 / 账单页 / 租户管理页三处共用。两个问题：
--   ① 改一次单价，**历史月份的成本会跟着变**，趋势图失真；
--   ② 阿里云 2026 年已调价（Qwen3.5-Plus 输出 4.8 元/百万 ≈ 0.0048/1K），硬编码值已漂移。
--
-- 关于「实时 API 取单价」：DashScope **没有公开的价格查询 API**（只有
-- GET /api/v1/deployments/models 查可部署模型，不含价格），价格仅在文档页公示。
-- 因此这里落为「可维护的定价表 + 生效时间」，并把取价抽象成 lib/pricing 的单一入口；
-- 将来若供应商提供价格 API，替换该入口的实现即可，调用方不动。
--
-- 关键设计：**带 effective_from 的版本化定价**。成本按调用发生当时生效的那条单价算，
-- 改价不会篡改历史。同一 (provider, model) 下按 effective_from 取「不晚于调用时间」的最新一条。

create table public.model_pricing (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null,                    -- platform-env / openai-compat / openai / ...
  model           text not null,                    -- qwen-plus / qwen-max / gpt-4o ...
  input_per_1k    numeric(12,6) not null,           -- 输入单价（元 / 1K token）
  output_per_1k   numeric(12,6) not null,           -- 输出单价（元 / 1K token）
  currency        text not null default 'CNY',
  effective_from  timestamptz not null default now(),
  source_note     text,                             -- 价格出处（如官方定价页 URL + 查询日期）
  created_by      uuid references public.users(id),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.model_pricing is
  '4.8.17c 模型定价（版本化）。成本按调用当时生效的单价计算，改价不篡改历史。DashScope 无价格 API，需人工维护并记录 source_note。';
comment on column public.model_pricing.effective_from is
  '该单价的生效起始时间；同一 (provider,model) 取不晚于调用时间的最新一条。';

-- 同一 (provider, model, effective_from) 唯一（在册行）。
-- 遵 4.9.1 契约：带 deleted_at 的表一律用部分唯一索引，不用全表 unique。
create unique index if not exists uq_model_pricing_active
  on public.model_pricing (provider, model, effective_from)
  where deleted_at is null;
create index if not exists idx_model_pricing_lookup
  on public.model_pricing (provider, model, effective_from desc)
  where deleted_at is null;

-- 定价是平台级数据（非租户数据），RLS 只读放开给已登录用户，写入仅经服务端 admin client
-- （API 入口 isPlatformAdmin 门控，与 tenants 同一模式）。
alter table public.model_pricing enable row level security;
create policy model_pricing_read on public.model_pricing for select using (true);

-- 种子：迁移前代码里硬编码的那组值，生效时间回溯到项目起点，
-- 保证历史成本口径与迁移前完全一致（不制造数据跳变）。
insert into public.model_pricing (provider, model, input_per_1k, output_per_1k, effective_from, source_note)
values
  ('platform-env', 'qwen-plus', 0.000800, 0.002000, '2026-01-01T00:00:00Z',
   '迁移 0027 前代码硬编码值 QWEN_PLUS_PRICE（lib/data/dashboard.ts），回溯生效以保持历史口径一致'),
  ('platform-env', '*',         0.000800, 0.002000, '2026-01-01T00:00:00Z',
   '兜底档：未单独配价的模型按 qwen-plus 估算，与迁移前行为一致')
on conflict do nothing;
