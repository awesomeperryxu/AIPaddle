-- BUG-87/88：把「带软删列的表」上的全表唯一约束统一改为**只约束在册行**的部分唯一索引。
--
-- 病因（与已修的 BUG-83 tenants.code 完全同构）：
--   数据层查重一律带 `.is('deleted_at', null)`（认为软删的不占用），
--   而 0001/0002 建表时写的是全表 `unique(...)`（不认软删）。
--   两者语义相反 → 应用层放行、数据库拦下、把 Postgres 原文甩给用户。
--
-- 已实测复现（psql 事务内试插 + rollback）：
--   · user_roles_user_id_role_key：角色 A→B 再改回 A，或重新邀请曾被移除的成员并授予原角色 → 撞
--   · agent_resources_..._key：移除 Agent 资源后再加回同一个 → 撞
-- 同构未实测（两表当前无软删数据，约束定义一致，必然同病）：
--   · mcp_servers_org_id_name_key：删掉 MCP Server 后用同名重建 → 撞
--   · skill_installs_skill_id_user_id_key：卸载 Skill 后重装 → 撞
--
-- 不含 users_email_key：users.id 是主键且引用 auth.users(id)，光放开 email 仍会撞 users_pkey
--   （invite 对已注册邮箱会复用同一 auth uid）。users 走「复活软删行」的数据层方案，见 lib/data/members.ts。
--
-- 前置核对（apply 前已在生产库确认）：四张表的**在册行**内均无重复 key，故部分唯一索引可直接建立。

-- ── user_roles：软删旧角色行是「角色变更历史」，不应挡住重新授予同一角色 ──
alter table public.user_roles drop constraint if exists user_roles_user_id_role_key;
create unique index if not exists uq_user_roles_active
  on public.user_roles (user_id, role)
  where deleted_at is null;
comment on index public.uq_user_roles_active is
  'BUG-87：同一用户的同一角色仅在「未撤销（deleted_at is null）」时唯一；已撤销的历史行不占用。';

-- ── mcp_servers：删除后同名重建是正常运维动作 ──
alter table public.mcp_servers drop constraint if exists mcp_servers_org_id_name_key;
create unique index if not exists uq_mcp_servers_org_name_active
  on public.mcp_servers (org_id, name)
  where deleted_at is null;
comment on index public.uq_mcp_servers_org_name_active is
  'BUG-88：MCP Server 名称仅在本租户「在册」范围内唯一；已删除的不占名。';

-- ── skill_installs：卸载后重装 ──
alter table public.skill_installs drop constraint if exists skill_installs_skill_id_user_id_key;
create unique index if not exists uq_skill_installs_active
  on public.skill_installs (skill_id, user_id)
  where deleted_at is null;
comment on index public.uq_skill_installs_active is
  'BUG-88：同一用户对同一 Skill 的安装记录仅在「未卸载」时唯一；已卸载的不占用。';

-- ── agent_resources：移除资源后再加回 ──
alter table public.agent_resources drop constraint if exists agent_resources_agent_id_resource_type_resource_id_key;
create unique index if not exists uq_agent_resources_active
  on public.agent_resources (agent_id, resource_type, resource_id)
  where deleted_at is null;
comment on index public.uq_agent_resources_active is
  'BUG-88：Agent 的资源绑定仅在「未移除」时唯一；已移除的历史行不占用。';
