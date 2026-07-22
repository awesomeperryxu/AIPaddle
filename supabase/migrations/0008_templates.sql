-- migration 0008: 统一模板库
-- 存放内置模板（来自 Dify 开源仓库，Apache-2.0，注明来源）+ 未来用户自建模板

create table public.templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  -- agent / assistant / chatflow / workflow / text-generation
  type            text not null check (type in ('agent','assistant','chatflow','workflow','text-generation')),
  category        text not null default '新手入门',
  description     text,
  icon            text not null default '🤖',
  icon_background text not null default '#FFEAD5',
  tags            text[] not null default '{}',
  -- DSL：对于 agent 类型存 {systemPrompt, model, temperature, variables, tools}
  --       对于 workflow/chatflow 类型存 {nodes, edges, variables}
  dsl             jsonb not null default '{}',
  source          text not null default 'dify',  -- 'dify' | 'user'
  license         text not null default 'Apache-2.0',
  is_built_in     boolean not null default true,
  -- 用户自建模板属于某租户（内置模板 org_id 为 null）
  org_id          uuid references public.tenants(id) on delete cascade,
  created_at      timestamptz not null default now()
);

create index idx_templates_type     on public.templates(type);
create index idx_templates_category on public.templates(category);
create index idx_templates_org_id   on public.templates(org_id);

-- RLS：内置模板所有登录用户可读；租户自建模板只能本租户读
alter table public.templates enable row level security;

create policy "templates_read_builtin" on public.templates
  for select using (
    is_built_in = true
    and auth.uid() is not null
  );

create policy "templates_read_tenant" on public.templates
  for select using (
    is_built_in = false
    and org_id = public.current_org_id()
  );
