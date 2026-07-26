-- 4.7.1（ADR-016）：租户级模型供应商配置 + 系统默认模型槽。
-- API Key 绝不明文落库——api_key_ciphertext 存应用层 AES-256-GCM 密文（lib/crypto/model-key）。
-- RLS 按 org_id 隔离（比照 ADR-001 current_org_id 模式）；细粒度角色在应用层 requirePermission。

create table public.tenant_model_providers (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.tenants(id),
  provider            text not null,            -- openai-compat / anthropic / bedrock / gemini / custom ...
  credential_name     text not null,            -- 同一供应商可配多份凭据（如「通义-生产」「通义-测试」）
  base_url            text,                     -- OpenAI 兼容 / 自定义端点；原生供应商可空
  api_key_ciphertext  text not null,            -- AES-256-GCM 密文（v1:iv:tag:ct，base64），绝不明文
  models              jsonb not null default '[]'::jsonb,  -- 该凭据可用模型清单（自定义供应商用）
  enabled             boolean not null default true,
  created_by          uuid references public.users(id),
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.tenant_model_providers is
  'ADR-016 租户模型供应商凭据；api_key_ciphertext=应用层AES-256-GCM密文，仅服务端 lib/crypto/model-key 可解密。';

-- 同租户下 (供应商, 凭据名) 唯一（软删不占用）
create unique index uq_tmp_org_provider_cred
  on public.tenant_model_providers (org_id, provider, credential_name)
  where deleted_at is null;
create index idx_tmp_org on public.tenant_model_providers (org_id) where deleted_at is null;

-- 租户系统默认模型 5 槽：{ llm/embedding/rerank/stt/tts: {providerId, model} }
alter table public.tenants
  add column model_settings jsonb not null default '{}'::jsonb;
comment on column public.tenants.model_settings is
  'ADR-016 租户默认系统模型槽 {llm,embedding,rerank,stt,tts}: {providerId,model}；缺失回落平台 env。';

-- updated_at 触发器
create trigger trg_tenant_model_providers_updated
  before update on public.tenant_model_providers
  for each row execute function public.set_updated_at();

-- RLS：租户隔离
alter table public.tenant_model_providers enable row level security;
create policy tenant_model_providers_org_select on public.tenant_model_providers
  for select using (org_id = public.current_org_id() and deleted_at is null);
create policy tenant_model_providers_org_insert on public.tenant_model_providers
  for insert with check (org_id = public.current_org_id());
create policy tenant_model_providers_org_update on public.tenant_model_providers
  for update using (org_id = public.current_org_id());
