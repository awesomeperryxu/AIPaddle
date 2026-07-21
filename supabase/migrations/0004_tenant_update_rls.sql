-- 4.5.2: 允许租户 Admin 更新本租户基础信息（名称/联系方式等）
-- 角色级限制（Admin only）在应用层 API 通过 requirePermission(ctx, 'tenant:manage') 强制，见 ADR-002。
create policy tenant_update on public.tenants
  for update
  using (id = public.current_org_id() and deleted_at is null)
  with check (id = public.current_org_id());
