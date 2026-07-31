-- V12-8.1 / PRD v1.13 §13 / ADR-018：Extension —— 供**其他应用调用 AIPaddle** 的受治理入口。
--
-- 🔴 与 Plugin 的方向恰好相反，这是二者不能合并的根本原因：
--     Plugin    ：AIPaddle → 外部系统（我们关心「自家 Credential 别泄漏」）
--     Extension ：外部系统 → AIPaddle（我们关心「别人的 Key 有什么 Scope、能不能撤销」）
--   鉴权模型、限流对象、审计视角完全不同，合表会让权限模型无法自洽。
--
-- 本期只做 **API Endpoint** 一类（PRD 首期四类中）：
--   · Webhook Endpoint / Channel Adapter —— 依赖任务包 7 Trigger，留下期
--   · Web Widget —— 首个接入方（黑围裙官网）自建 UI，本期不做
--
-- 与既有 api_keys(4.8.6) 的分工：
--   api_keys            —— 平台管理菜单下的**平台级通用 Key**，org 级 scope，无目标绑定
--   extension_api_keys  —— 绑定到**具体 Extension**，带 Origin 白名单与按 Key 限流
--   两者共用 sha256 哈希与「明文仅签发时一次性返回」的铁律（复用 lib/data/api-keys 的
--   generateApiKey/hashApiKey，不重复实现）。
--
-- 迁移类型：纯新建。编号 0033 取自 MIGRATION_PLAN_v1.13 §1 的占用登记表
-- （0028-0030 已被 P 道用掉、0031-0032 已被 S 道预留；并行道**不得**按本地
--  `ls | tail -1` 取号，那会撞车——ERD §5.1 的 3 组历史重号就是这么来的）。

create table public.extensions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.tenants(id),
  name           text not null,
  description    text,
  -- 本期只实现 api；其余三类先登记枚举，避免将来改约束
  kind           text not null default 'api'
                   check (kind in ('api', 'webhook', 'channel', 'widget')),
  -- 调用目标：Agent / 数字员工（也是 agents 行）/ Workflow
  target_type    text not null check (target_type in ('agent', 'workflow')),
  target_id      uuid not null,
  -- 🔴 目标版本绑定（D-19）：外部调用打到的是**发布时锁定的版本**，
  -- 目标升版不会让线上外部调用的行为突变
  target_version text,
  -- 来源限制：Origin 白名单（空数组=拒绝所有跨域来源，不是放行所有）
  allowed_origins jsonb not null default '[]'::jsonb,
  -- 限流：每分钟请求数上限，按 Key 与 IP 双维度计（0=不限，仅内部测试用）
  rate_limit_per_min integer not null default 60,
  status         text not null default 'draft'
                   check (status in ('draft', 'pending', 'published', 'offline')),
  created_by     uuid references public.users(id),
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.extensions is
  'V12-8.1 Extension：供外部应用调用 AIPaddle 资产的受治理入口。🔴 方向与 Plugin 相反（Plugin 是 AIPaddle 调外部），故不合表（ADR-018 §2）。';
comment on column public.extensions.allowed_origins is
  '🔴 Origin 白名单。空数组 = 拒绝所有跨域来源（默认拒绝），不是放行所有——默认放行会让新建的 Extension 立刻对全网敞开。';
comment on column public.extensions.target_version is
  '目标资产的锁定版本（D-19）。外部调用打到发布时锁定的版本，目标升版不影响线上外部调用。';

create unique index if not exists uq_extensions_org_name_active
  on public.extensions (org_id, name)
  where deleted_at is null;
create index if not exists idx_extensions_org_status
  on public.extensions (org_id, status)
  where deleted_at is null;
create index if not exists idx_extensions_target
  on public.extensions (target_type, target_id)
  where deleted_at is null;

alter table public.extensions enable row level security;
create policy tenant_rls_extensions on public.extensions
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());


-- ── Extension 版本 ─────────────────────────────────────────────────────────

create table public.extension_versions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.tenants(id),
  extension_id   uuid not null references public.extensions(id) on delete cascade,
  version        text not null,
  -- 该版本冻结的配置快照（目标、白名单、限流），发布后不可改
  config_snapshot jsonb not null default '{}'::jsonb,
  changelog      text,
  status         text not null default 'draft'
                   check (status in ('draft', 'pending', 'published', 'offline')),
  created_by     uuid references public.users(id),
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.extension_versions is
  'V12-8.1 Extension 版本。发布即冻结配置快照；被已签发 Key 引用的版本不得硬删，只能下线（AC-17）。';

create unique index if not exists uq_extension_versions_active
  on public.extension_versions (extension_id, version)
  where deleted_at is null;

alter table public.extension_versions enable row level security;
create policy tenant_rls_extension_versions on public.extension_versions
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());


-- ── Extension API Key ──────────────────────────────────────────────────────
-- 🔴 铁律（同 4.8.6 api_keys、同成员密码）：
--   · 只落 sha256 哈希，**绝不存明文**；明文仅签发时一次性返回，之后无法找回；
--   · key_prefix 仅供界面识别与审计对账，非机密；
--   · 撤销走 revoked_at 而非删除——删掉就查不出「这个 Key 曾经调过什么」。

create table public.extension_api_keys (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.tenants(id),
  extension_id   uuid not null references public.extensions(id),
  name           text not null,
  key_hash       text not null,                  -- 完整 Key 的 sha256（十六进制）
  key_prefix     text not null,                  -- 可展示前缀，如 ap_ext_a1f3（非机密）
  -- 权限范围：本期只放 chat（调对话）与 leads（提交留资），默认最小
  scopes         jsonb not null default '["chat"]'::jsonb,
  rate_limit_per_min integer,                    -- 覆盖 Extension 级默认值；null=用 Extension 的
  last_used_at   timestamptz,
  expires_at     timestamptz,
  revoked_at     timestamptz,
  created_by     uuid references public.users(id),
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.extension_api_keys is
  'V12-8.1 Extension 对外调用 Key。🔴 key_hash=sha256，明文仅签发时一次性返回，绝不落库/进日志/进响应（AC-15）。撤销用 revoked_at 而非删除，保留可审计性。';
comment on column public.extension_api_keys.key_prefix is
  '可展示前缀（非机密），供界面识别与调用日志对账。';
comment on column public.extension_api_keys.scopes is
  '权限范围数组，默认最小 ["chat"]。本期支持 chat（对话）/ leads（留资提交）。';

-- key_hash 全局唯一：校验时按 hash 反查，撞 hash 等于两个 Key 等价
create unique index if not exists uq_extension_api_keys_hash
  on public.extension_api_keys (key_hash)
  where deleted_at is null;
create index if not exists idx_extension_api_keys_ext
  on public.extension_api_keys (extension_id)
  where deleted_at is null;
-- 鉴权热路径：按 hash 查未撤销未过期的 Key
create index if not exists idx_extension_api_keys_active
  on public.extension_api_keys (key_hash)
  where deleted_at is null and revoked_at is null;

alter table public.extension_api_keys enable row level security;
create policy tenant_rls_extension_api_keys on public.extension_api_keys
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
