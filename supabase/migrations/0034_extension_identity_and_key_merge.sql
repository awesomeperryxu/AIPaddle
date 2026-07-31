-- V12-8.1（修正）/ ADR-020：Extension 机器用户身份 + Key 体系归一。
--
-- 背景：0033 先于 ADR-020 落地，有两处与 ADR 冲突，本迁移纠正：
--   ① 建了 extension_api_keys 新表 —— 与 0020 的 api_keys 构成**两套 Key 体系**。
--      签发/撤销/审计要写两遍、管理页要做两个、租户认知负担翻倍。ADR-020 §4 定：归一到 api_keys。
--      但 0033 那张表的设计确实更完善（scopes 数组 / 过期 / 软删 / 限流覆盖），
--      故本迁移**把它的设计搬到 api_keys 上**，而不是简单加三列，再 drop 掉它。
--   ② 缺机器用户相关列 —— ADR-020 §3 的核心决策没有落点。
--
-- 🔴 为什么要机器用户（ADR-020 §3）：
--   全库 79 条 RLS 策略统一走 current_org_id() = `select org_id from users where id = auth.uid()`。
--   外部 Key 调用没有 Supabase 会话 → auth.uid() 为 null → 策略全判假 → 查不到任何数据。
--   解法是给每个 Extension 配一个非真人用户，外部请求经 Key 验证后以该身份签发短期 token，
--   于是 auth.uid() 有值、既有 79 条策略**一条都不用改**。
--   已实测：以 SUPABASE_JWT_SECRET 原始字符串自签的 token，REST 返回 200 且只返回该身份所属租户。
--   明确拒绝的做法：service_role + 应用层 where org_id 自觉过滤（ADR-002 禁止）。
--
-- 安全前置：三张表当前均为空（api_keys/extension_api_keys/extensions 行数皆 0），
-- 故 drop 与扩列无数据迁移风险。回滚见 0034_..._rollback.sql。

-- ── ① 机器用户标记 ────────────────────────────────────────────────
-- 非真人账号：不能登录后台、不占席位、不计费、不进成员列表。
-- 成员列表与计费口径必须显式排除 is_service_account = true（应用层 V12-8.4 落实）。
alter table public.users
  add column if not exists is_service_account boolean not null default false;

comment on column public.users.is_service_account is
  'ADR-020：true=Extension 机器用户（非真人）。仅用于让外部 Key 调用取得可被 RLS 识别的身份；不得登录、不占席位、不计费、不出现在成员列表。';

-- 热路径：按机器用户反查时排除真人；成员列表按此列过滤
create index if not exists idx_users_service_account
  on public.users (org_id)
  where is_service_account = true;

-- ── ② Extension ↔ 机器用户绑定 ──────────────────────────────────
alter table public.extensions
  add column if not exists service_user_id uuid references public.users(id);

comment on column public.extensions.service_user_id is
  'ADR-020 §3：该 Extension 对应的机器用户。外部请求验 Key 通过后，以此身份签发 5 分钟短期 token 交给请求级客户端，使 RLS 照常生效。创建 Extension 时经 lib/db/admin.ts 建立，删除 Extension 时一并清理。';

-- 一个 Extension 一个机器用户，不共用（共用会让调用日志分不清是谁）
create unique index if not exists uq_extensions_service_user
  on public.extensions (service_user_id)
  where service_user_id is not null and deleted_at is null;

-- ── ③ api_keys 归一：吸收 0033 的更优设计 ──────────────────────
alter table public.api_keys
  -- 绑定到某个 Extension；null = 4.8.6 的租户级通用 Key（两种语义共存于一张表，
  -- 靠此列区分。选择合表而非分表：Key 的签发/撤销/审计/防泄露逻辑完全一致，
  -- 分两张表等于把同一套安全逻辑写两遍，漏一处就是一个洞）
  add column if not exists extension_id       uuid references public.extensions(id),
  -- 细粒度权限。0020 的 scope 单值列（agent/readonly/full）保留给 4.8.6 既有代码，
  -- Extension 场景用本列：["chat"] / ["chat","leads"] / ["chat","leads","handoff"]
  add column if not exists scopes             jsonb not null default '[]'::jsonb,
  -- 来源白名单（ADR-020 §6）。空数组 = 仅服务端调用，带 Origin 头一律拒
  add column if not exists allowed_origins    jsonb not null default '[]'::jsonb,
  -- 限流（ADR-020 §7）。null = 用 extensions.rate_limit_per_min 的默认值
  add column if not exists rate_limit_per_min integer,
  add column if not exists expires_at         timestamptz,
  add column if not exists deleted_at         timestamptz,
  add column if not exists updated_at         timestamptz not null default now();

comment on column public.api_keys.extension_id is
  'ADR-020：非空=该 Key 属于此 Extension（对外调用）；null=4.8.6 的租户级通用 Key。';
comment on column public.api_keys.scopes is
  'ADR-020 §5 细粒度权限数组，默认空=最小权限（默认拒绝）。Extension 场景取值 chat / leads / handoff。0020 的 scope 单值列保留给 4.8.6 既有代码，两者不冲突。';
comment on column public.api_keys.allowed_origins is
  'ADR-020 §6 来源白名单。空数组=仅服务端调用，带 Origin 头的请求一律拒绝。注意：Origin 可伪造，这是纵深防御而非鉴权替代。';

-- 鉴权热路径：按 hash 查未撤销、未过期、未软删的 Key
create index if not exists idx_api_keys_active_hash
  on public.api_keys (key_hash)
  where revoked_at is null and deleted_at is null;
create index if not exists idx_api_keys_extension
  on public.api_keys (extension_id)
  where deleted_at is null;

-- ── ④ 撤下重复的 Key 表 ────────────────────────────────────────
-- 空表（0 行）+ 零代码引用，drop 无损。保留它才是债：两套 Key 体系并存，
-- 后来者不知道该往哪张表签发。
drop table if exists public.extension_api_keys;
