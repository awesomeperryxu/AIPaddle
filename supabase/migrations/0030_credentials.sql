-- V12-2.3 / PRD v1.13 §3(Credential) / ADR-018 §8：租户范围内受加密与权限控制的连接凭证。
--
-- 为什么不复用 tenant_model_providers：那张表专用于**模型供应商**（provider + base_url + models），
-- 本表面向 Plugin/Tool/DataSource 的通用凭证（OAuth / API Key / JWT / DB Secret），
-- 字段与生命周期都不同。两者共用同一套加密实现 lib/crypto/model-key（AES-256-GCM）。
--
-- 🔴 安全铁律（AC-15，与成员密码同档）：
--   · 密文列只存 AES-256-GCM 密文（v1:iv:tag:ct，base64），绝不存明文；
--   · 未配 MODEL_KEY_ENC_SECRET 时**拒绝保存**，不静默降级存明文；
--   · 密文绝不出现在 API 响应、审计 detail、日志、前端包；读接口只返回脱敏值；
--   · service_role 仅限 lib/db/admin.ts（ADR-002）。
--
-- 迁移类型：纯新建 + 补一条外键（tool_versions.credential_id，0029 建表时留空）。
-- 回滚见 0030_credentials_rollback.sql。

create table public.credentials (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.tenants(id),
  name              text not null,                    -- 凭据名，如「GitHub-生产」
  description       text,
  -- smtp（V12-2.3a，2026-07-31）：SMTP 发信账号。密码/授权码进 secret_ciphertext，
  -- host/port/secure/user 这类非敏感连接参数进 meta。
  kind              text not null check (kind in ('oauth', 'api_key', 'jwt', 'db_secret', 'smtp')),
  -- 🔴 AES-256-GCM 密文（v1:iv:tag:ct，base64）。绝不明文。
  secret_ciphertext text not null,
  -- 非敏感的辅助字段（如 OAuth 的 client_id、DB 的 host/port/database、只读账号名）
  -- ⚠️ 口令/私钥/token 一律进 secret_ciphertext，不得放这里
  meta              jsonb not null default '{}'::jsonb,
  expires_at        timestamptz,                      -- OAuth/JWT 有效期，到期需重新授权
  enabled           boolean not null default true,
  created_by        uuid references public.users(id),
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.credentials is
  'V12-2.3 租户加密凭证（Plugin/Tool/DataSource 共用）。secret_ciphertext = 应用层 AES-256-GCM 密文，仅服务端 lib/crypto/model-key 可解密。🔴 绝不进浏览器、前端包、日志或审计 detail（AC-15）。';
comment on column public.credentials.secret_ciphertext is
  '🔴 AES-256-GCM 密文（v1:iv:tag:ct，base64）。未配 MODEL_KEY_ENC_SECRET 时数据层拒绝保存，绝不降级存明文。';
comment on column public.credentials.meta is
  '仅放非敏感辅助字段（OAuth client_id、DB host/port/database 等）。⚠️ 口令/私钥/token 一律进 secret_ciphertext。';

-- 同租户下凭据名唯一（软删不占用名额）
create unique index if not exists uq_credentials_org_name_active
  on public.credentials (org_id, name)
  where deleted_at is null;
create index if not exists idx_credentials_org_kind
  on public.credentials (org_id, kind)
  where deleted_at is null;
create index if not exists idx_credentials_expiring
  on public.credentials (org_id, expires_at)
  where deleted_at is null and expires_at is not null;

alter table public.credentials enable row level security;
create policy tenant_rls_credentials on public.credentials
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- 补 0029 预留的外键：Tool 版本引用凭据。
-- on delete restrict —— 凭据被 Tool 引用时不得删除（删除保护，ADR-018 §6 N-8）；
-- 需先解绑或下线 Tool 版本，避免"删掉凭据导致线上 Tool 静默失效"。
alter table public.tool_versions
  add constraint tool_versions_credential_id_fkey
  foreign key (credential_id) references public.credentials(id) on delete restrict;

comment on column public.tool_versions.credential_id is
  '引用 credentials 表。on delete restrict：被引用的凭据不得删除，须先解绑（删除保护）。';
