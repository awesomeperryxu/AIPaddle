-- 0038 回滚：把 'tool' 从 agent_resources 枚举中移除。
-- 🔴 先查存量：有 tool 绑定时加约束会直接失败。宁可报错也不静默删数据。

do $$
declare n int;
begin
  select count(*) into n from public.agent_resources where resource_type = 'tool';
  if n > 0 then
    raise exception '仍有 % 条 resource_type=tool 的绑定，请先解绑后再回滚', n;
  end if;
end $$;

alter table public.agent_resources
  drop constraint if exists agent_resources_resource_type_check;
alter table public.agent_resources
  add constraint agent_resources_resource_type_check
    check (resource_type in ('skill', 'knowledge_base', 'workflow', 'mcp_server', 'agent'));
