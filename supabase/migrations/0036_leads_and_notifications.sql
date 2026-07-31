-- V12-8.9 / V12-4.8（邮件道，X 道代管）：外部留资与通知投递记录。
--
-- 场景：黑围裙官网访客在咨询窗留下联系方式 → Extension 收下并入库 → 投递企微 + 邮件。
--
-- 🔴 为什么留资单独建表而不塞进 conversations：
--   · 留资是**业务线索**，生命周期与销售跟进绑定（联系过没有、成没成单），
--     与对话记录的生命周期完全不同；
--   · 含手机号等 PII，需要独立的保留期与访问控制，混进对话表会让脱敏无从下手。
--
-- 🔴 通知投递单独记录而不只写 call_logs：
--   投递会部分失败（企微成了、邮件挂了），必须能查"这条线索到底通知到谁了"，
--   否则销售不知道该不该等、运维不知道该不该补发。

create table public.leads (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.tenants(id),
  -- 来源 Extension；外部提交必经 Extension，故非空
  extension_id   uuid not null references public.extensions(id),
  -- 会话关联（可空）：留资未必发生在对话中，也可能是表单直提
  conversation_id uuid,

  -- ── 用户指定的五项（2026-07-31）──
  name           text not null,                    -- 称呼
  contact        text not null,                    -- 联系方式（手机/微信）
  project        text,                             -- 需求项目
  expected_time  text,                             -- 期望进场时间
  site_info      text,                             -- 场地情况：类型/面积/楼层/城市

  -- 附加上下文
  source         text not null default 'website',  -- 来源标识，如 royalblack-website
  summary        text,                             -- 对话摘要（LLM 生成，便于销售快速进入状态）
  raw            jsonb not null default '{}'::jsonb, -- 原始提交体，留作对账
  client_ip      text,                             -- 仅用于风控与去重，不做画像

  -- 跟进状态：留资只是开始，销售侧的流转靠这两列
  status         text not null default 'new'
                   check (status in ('new', 'contacted', 'qualified', 'closed', 'spam')),
  handled_by     uuid references public.users(id),
  handled_at     timestamptz,

  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.leads is
  'V12-8.9 外部留资线索。含 PII（联系方式），RLS 按 org_id 隔离；调用日志不得记录本表的原文字段。';
comment on column public.leads.raw is
  '原始提交体，仅用于对账与排查。🔴 不得把此列整体回显给外部调用方。';

create index if not exists idx_leads_org_created
  on public.leads (org_id, created_at desc) where deleted_at is null;
create index if not exists idx_leads_status
  on public.leads (org_id, status) where deleted_at is null;
create index if not exists idx_leads_extension
  on public.leads (extension_id) where deleted_at is null;

alter table public.leads enable row level security;
create policy leads_org_select on public.leads
  for select using (org_id = public.current_org_id() and deleted_at is null);
create policy leads_org_insert on public.leads
  for insert with check (org_id = public.current_org_id());
create policy leads_org_update on public.leads
  for update using (org_id = public.current_org_id());

-- ── 通知投递记录 ────────────────────────────────────────────────
create table public.notification_deliveries (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.tenants(id),
  lead_id      uuid references public.leads(id) on delete cascade,
  -- 本期两条通道；将来加短信/飞书在此扩枚举
  channel      text not null check (channel in ('wecom', 'email')),
  target       text,                               -- 收件人/接收方（邮箱地址、@all 等）
  success      boolean not null,
  error_code   text,
  error_detail text,                               -- 🔴 只存错误摘要，不存凭证与 PII
  latency_ms   integer,
  created_at   timestamptz not null default now()
);

comment on table public.notification_deliveries is
  'V12-4.8 通知投递逐条记录。部分失败（企微成/邮件败）必须可查，否则销售不知该不该等、运维不知该不该补发。';

create index if not exists idx_notif_lead on public.notification_deliveries (lead_id);
create index if not exists idx_notif_org_created
  on public.notification_deliveries (org_id, created_at desc);

alter table public.notification_deliveries enable row level security;
create policy notif_org_select on public.notification_deliveries
  for select using (org_id = public.current_org_id());
create policy notif_org_insert on public.notification_deliveries
  for insert with check (org_id = public.current_org_id());
