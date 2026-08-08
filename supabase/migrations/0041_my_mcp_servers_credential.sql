-- 修 0040 的疏漏：视图 my_mcp_servers 没跟着表加列。
--
-- 🔴 根因（Postgres 既定行为，很容易踩）：
-- 视图定义写的是 `select m.*`，但 Postgres 在**创建视图时就把 `*` 展开成
-- 当时的具体列清单并固化**。此后给基表 ALTER TABLE ADD COLUMN，视图**不会**跟着变。
-- 于是 0040 给 mcp_servers 加了 credential_id 之后：
--   · listMcpServers 查表   → 正常（MCP 页没事，看不出问题）
--   · listMyMcpServers 查视图 → `column my_mcp_servers.credential_id does not exist`
-- 数据层拿到 error 直接 throw，而 /skill-hub 是 Server Component，
-- 抛错即整页渲染失败——e2e 里表现为「locator('main') 找不到」，
-- 一个看不出跟数据库有任何关系的报错。12 个路由里只有它挂，正因为它是唯一
-- 用到这个视图的页面。
--
-- 教训：ALTER TABLE ADD COLUMN 之后必须检查依赖视图，
-- `select *` 的视图尤其危险——它看起来「自动包含所有列」，实际并不会。
--
-- create or replace 而非 drop+create：保留既有权限与依赖，
-- 且新列追加在末尾符合 replace 的约束（不改变已有列的顺序与类型）。

create or replace view public.my_mcp_servers as
select m.*
from public.mcp_servers m
where m.deleted_at is null
  and m.status = 'approved'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.deleted_at is null
      and ur.role = any (m.allowed_roles)
  )
  and (
    m.allowed_departments = '{}'
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.department = any (m.allowed_departments)
    )
  );

comment on view public.my_mcp_servers is
  '当前用户按角色+部门权限可见的已审批 MCP 清单——Skill 创建表单的 Server 下拉数据源。
   ⚠️ 本视图用 select m.*，但 Postgres 会在创建时固化列清单：
   给 mcp_servers 加列后，必须重跑一次 create or replace view，否则新列查不到。';
