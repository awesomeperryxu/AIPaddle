-- 4.1.17 / ADR-013：Agent 来源分类，四类与 Skill(migration 0007) 同构。
--   一 平台内置·强制 = origin='platform' 且 mandatory=true（全员默认下发、不可卸载）
--   二 平台市场       = origin='platform' 且 mandatory=false
--   三 用户自用       = origin='user' 且 status='draft'
--   四 用户推送市场   = origin='user' 且 status ∈ (pending, published, offline)
alter table public.agents
  add column if not exists origin text not null default 'user'
    check (origin in ('platform','user')),
  add column if not exists mandatory boolean not null default false;

comment on column public.agents.origin is 'platform=平台管理员发布(类一/二)；user=租户用户创建(类三/四)';
comment on column public.agents.mandatory is '类一 平台内置强制：全员默认下发、不可卸载（仅 origin=platform 有意义）';
