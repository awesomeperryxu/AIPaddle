-- 0040 回滚：移除 mcp_servers.credential_id。
-- 🔴 先查存量：已有 Server 绑定凭证时直接删列会丢掉绑定关系。
--    宁可报错让人工确认，也不静默丢数据。

do $$
declare n int;
begin
  select count(*) into n
    from public.mcp_servers
   where credential_id is not null and deleted_at is null;
  if n > 0 then
    raise exception '仍有 % 个 MCP Server 绑定着凭证，请先解绑后再回滚', n;
  end if;
end $$;

drop index if exists public.idx_mcp_servers_credential;

alter table public.mcp_servers
  drop column if exists credential_id;
