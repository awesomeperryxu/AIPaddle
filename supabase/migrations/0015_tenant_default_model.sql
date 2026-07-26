-- 以租户为单位的默认 LLM 模型（ADR-002 RLS / ADR-007 权限）。
-- 每个租户一个默认模型，租户管理员可改、其他角色只读。
-- 不加 DB check：模型清单会随时间演进，合法值校验放应用层（对齐 AGENT_MODELS）。
alter table public.tenants
  add column default_model text not null default 'qwen-plus';

comment on column public.tenants.default_model is
  '租户默认 LLM 模型；合法值由应用层校验（lib/agents/config.ts 的 AGENT_MODELS），tenant:manage 可改。';
