-- ============================================================
-- AIPaddle migration 0011：Agent 直连 MCP（Path B 解耦）
-- Agent 可直接绑定 approved 状态的 MCP Server，绕过 Skill 封装层。
-- Skill 封装路径（Path A）依然保留——两条路径并存。
-- ============================================================

-- agent_resources 表原 CHECK：resource_type in ('skill','knowledge_base','workflow')
-- 扩展为包含 'mcp_server'

alter table public.agent_resources
  drop constraint agent_resources_resource_type_check;

alter table public.agent_resources
  add constraint agent_resources_resource_type_check
    check (resource_type in ('skill', 'knowledge_base', 'workflow', 'mcp_server'));

comment on column public.agent_resources.resource_type is
  'skill | knowledge_base | workflow | mcp_server；mcp_server 只能绑定 status=approved 的 MCP Server（Path B 直连）。';
