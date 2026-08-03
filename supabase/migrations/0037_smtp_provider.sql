-- V12-4.9：Plugin 菜单第四类 —— SMTP Provider。
--
-- 为什么要单开一类而不是复用 provider_type='api'：
-- SMTP 不是 HTTP，它的连接参数（host/port/secure/user）、鉴权方式、
-- 以及「发一封信」的语义都与 API Plugin 不同。混进 api 里会让
-- 「API」页同时列出两种根本不同的东西，用户分不清哪个能配 endpoint。
--
-- 🔴 凭证仍然一律进 credentials（kind='smtp'，0035 已加该枚举）：
-- 密码/授权码 → secret_ciphertext；host/port/secure/user → meta。
-- 本迁移不碰凭证结构，只放开 Plugin 的 provider_type 枚举。

alter table public.plugins
  drop constraint if exists plugins_provider_type_check;
alter table public.plugins
  add constraint plugins_provider_type_check
    check (provider_type in ('mcp', 'api', 'db', 'smtp'));

comment on column public.plugins.provider_type is
  'mcp | api | db | smtp。Plugin 是能力提供方，provider_type 决定它以何种形态接入；
   其提供的 Tool 由 tools.binding_type 决定调用方式（两者不必一一对应：
   如 smtp Plugin 下的 Tool 用 binding_type=''smtp''）。';
