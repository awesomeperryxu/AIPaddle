-- 0007：Skill 四类来源分类支持（#46）
-- 直接在 skills 存 origin(平台/用户) + mandatory(强制)，避开 platform_admins 的 RLS 限制。
-- 类别派生（数据层）：
--   一 平台内置·强制 = origin='platform' 且 mandatory=true
--   二 平台市场       = origin='platform' 且 mandatory=false
--   三 用户自用       = origin='user' 且 status='draft'
--   四 用户推送市场   = origin='user' 且 status ∈ (pending, published)
alter table public.skills
  add column if not exists origin text not null default 'user'
    check (origin in ('platform','user')),
  add column if not exists mandatory boolean not null default false;

comment on column public.skills.origin is 'platform=平台管理员发布(类一/二)；user=租户用户创建(类三/四)';
comment on column public.skills.mandatory is '类一 平台内置强制：全员默认安装、不可卸载（仅 origin=platform 有意义）';
