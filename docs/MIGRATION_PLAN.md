# 迁移编号占用表

`scripts/apply-migration.sh` 每次执行后都会提示「记得把本次迁移登记到 docs/MIGRATION_PLAN 的编号占用表」，
但这个文件此前**从来没有被创建过**——提示指向一个不存在的台账。
2026-08-07 因此撞车：两条并行道同时取了 `0039`（`mcp_server_credential` 与 `multi_org_membership`），
数据库层面各建各的没坏，但编号重复会让「按序重放迁移」失去确定性。本文件即为补上这个台账。

## 规矩

1. **动工前先占号**：新建迁移前先在下表登记，占号的 PR 可以只改本文件，先合先得。
2. **编号连续、不复用**：即使某个迁移被废弃，编号也不回收——留空比复用安全。
3. **每个迁移配回滚文件**：`NNNN_xxx_rollback.sql`，且回滚脚本要先查存量、有数据时报错而非静默删除。
4. **迁移改了表结构，检查依赖视图**：`select *` 的视图不会自动跟随基表加列
   （列清单在建视图时已固化）。查依赖：

   ```sql
   select distinct dependent_ns.nspname||'.'||dependent_view.relname as view_name
     from pg_depend d
     join pg_rewrite r on r.oid = d.objid
     join pg_class dependent_view on dependent_view.oid = r.ev_class
     join pg_namespace dependent_ns on dependent_ns.oid = dependent_view.relnamespace
     join pg_class source_table on source_table.oid = d.refobjid
    where source_table.relname = '<改动的表名>'
      and dependent_view.relname <> '<改动的表名>';
   ```

   防回归守卫：`tests/integration/view-column-sync.test.ts`。

## 占用表

> 只记编号与归属，详细意图看迁移文件头部注释。

| 编号 | 文件 | 说明 | 状态 |
|---|---|---|---|
| 0038 | `agent_tool_resource` | agent_resources 枚举放开 `tool`（GAP-1） | 已应用 |
| 0039 | `multi_org_membership` | 一个账号归属多组织 + 组织切换（ADR-025） | 已应用 |
| 0040 | `mcp_server_credential` | `mcp_servers.credential_id` 引用加密凭证（ADR-024） | 已应用 |
| 0041 | `my_mcp_servers_credential` | 重建 `my_mcp_servers` 视图，跟随 0040 加列 | 已应用 |

> 0038 之前的编号见 `supabase/migrations/` 目录，未逐条回填。

## 下一个可用编号

**0042**
