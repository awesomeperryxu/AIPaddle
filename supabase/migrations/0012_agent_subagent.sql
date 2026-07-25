-- 4.1.18 / ADR-014：agent_resources 增 resource_type='agent'——数字员工引用的子 Agent（成员）。
-- 数字员工 = 引用了 ≥1 个子 Agent 的上层 Agent（同 agents 表派生）；嵌套仅 1 层（子 Agent 须为普通 Agent）。
alter table public.agent_resources
  drop constraint agent_resources_resource_type_check;

alter table public.agent_resources
  add constraint agent_resources_resource_type_check
    check (resource_type in ('skill', 'knowledge_base', 'workflow', 'mcp_server', 'agent'));

comment on column public.agent_resources.resource_type is
  'skill | knowledge_base | workflow | mcp_server | agent(子Agent=数字员工成员，ADR-014，嵌套仅1层)';
