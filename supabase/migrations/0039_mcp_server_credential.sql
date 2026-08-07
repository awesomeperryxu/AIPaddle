-- MCP Server 凭证走加密引用（ADR-024 收尾）。
--
-- 现状（2026-08-07 实测）：22 个 MCP Server 里 8 个配了真实 endpoint，
-- 从生产服务器实测这 8 个**全部返回 HTTP 401**——官方远程 MCP
-- （GitHub / Notion / Linear / Stripe / Sentry / Cloudflare / Atlassian / 汇联易）
-- 几乎都强制 OAuth 或 API Key，匿名 tools/list 一律拒绝。
-- 也就是说「点开 Server 看 tools」这条链路，在配上凭证之前一个都点不开。
--
-- 🔴 为什么加 credential_id 而不是往 auth_config 里塞 key：
-- 0002 建表时 auth_config 的注释写的是「凭据经 Vault 加密引用，不存明文」，
-- 但表里从没有过引用字段，而 chat 路由直接读 auth_config.api_key 当明文用——
-- 设计意图与实现对不上。趁 auth_config 目前 **0 条有值**（谁都还没配过），
-- 按正确方式补上引用，不必清理历史明文。
--
-- 凭证本体复用 credentials 表（0030）：AES-256-GCM 密文、读接口只返回脱敏值、
-- 未配 MODEL_KEY_ENC_SECRET 时拒绝保存。与 tool_versions.credential_id 同一套模型。
--
-- 回滚见 0039_mcp_server_credential_rollback.sql。

alter table public.mcp_servers
  add column if not exists credential_id uuid references public.credentials(id);

comment on column public.mcp_servers.credential_id is
  '连接该 MCP Server 所用凭证，引用 credentials（AES-256-GCM 加密存储）。
   🔴 密文绝不落本表；auth_config 仅可放非敏感辅助字段（如 OAuth client_id）。
   为空 = 未配凭证，多数远程 MCP 会因此在 initialize 阶段返回 401。';

-- 按凭证反查引用它的 Server（删除凭证前要检查占用，见 lib/data/credentials.ts 的 in_use 判定）
create index if not exists idx_mcp_servers_credential
  on public.mcp_servers (credential_id)
  where credential_id is not null and deleted_at is null;
