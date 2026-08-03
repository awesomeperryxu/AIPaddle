-- GAP-1：让 Agent 能直挂 Tool。
--
-- 现状（2026-08-03 实测）：库里有 **161 个已发布 Tool**，而 Agent 一个都够不着——
-- chat 路由读的是 `mcp_servers` 表，那张表在 ADR-021 把 MCP 并入 Plugin 后是 **0 行**。
-- 于是 Plugin 体系整套建完了，能力却传导不到对话链路。
--
-- 本迁移只放开 agent_resources 的枚举，加 'tool'。
-- 🔴 'mcp_server' 暂时保留：ADR-021 定的观察期内不动旧路径，
-- 删枚举会让存量绑定（当前 0 条，但代码路径还活着）直接违约。

alter table public.agent_resources
  drop constraint if exists agent_resources_resource_type_check;

alter table public.agent_resources
  add constraint agent_resources_resource_type_check
    check (resource_type in ('skill', 'knowledge_base', 'workflow', 'mcp_server', 'agent', 'tool'));

comment on column public.agent_resources.resource_type is
  'skill | knowledge_base | workflow | mcp_server | agent | tool。
   tool：Agent 直挂 Plugin 提供的 Tool（GAP-1），只能绑 status=published 的 Tool；
   agent：数字员工挂下级 Agent（ADR-019，仅数字员工可用，普通 Agent 单层）；
   mcp_server：ADR-021 后已废弃，观察期内保留枚举不删。';
