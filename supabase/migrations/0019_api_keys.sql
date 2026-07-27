-- 4.8.6（通道 G）：对外 API Key 真实签发。
-- 铁律（PRD v1.10 §2.9.0）：Key 明文只在签发时一次性返回，落库只存 sha256 哈希 + 可展示前缀；绝不明文/密文可逆存储。
-- RLS 按 org_id 隔离（比照 ADR-001 current_org_id 模式）；细粒度角色（apikey:manage）在应用层强制。

create table public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.tenants(id),
  name         text not null,
  key_hash     text not null,                     -- 完整 Key 的 sha256（十六进制）；外部调用鉴权时比对
  key_prefix   text not null,                     -- 可展示前缀，如 ap_sk_live_a1f3（仅用于识别，非机密）
  scope        text not null default 'agent'
               check (scope in ('agent','readonly','full')),
  created_by   uuid references public.users(id),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.api_keys is
  '4.8.6 对外 API Key；key_hash=完整 Key 的 sha256，明文仅签发时一次性返回，不可逆、不落明文。';

-- 哈希全局唯一（外部鉴权按哈希查）
create unique index uq_api_keys_hash on public.api_keys (key_hash);
create index idx_api_keys_org on public.api_keys (org_id) where revoked_at is null;

-- RLS：租户隔离
alter table public.api_keys enable row level security;
create policy api_keys_org_select on public.api_keys
  for select using (org_id = public.current_org_id());
create policy api_keys_org_insert on public.api_keys
  for insert with check (org_id = public.current_org_id());
create policy api_keys_org_update on public.api_keys
  for update using (org_id = public.current_org_id());
