import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { getTenant, updateTenant, type TenantUpdateInput } from '@/lib/data/tenant'

export async function GET() {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can(ctx, 'tenant:read')) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const tenant = await getTenant(ctx)
  return Response.json({ tenant })
}

export async function PATCH(request: Request) {
  const ctx = await getRequestContext()
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can(ctx, 'tenant:manage')) return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: TenantUpdateInput
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const allowed: (keyof TenantUpdateInput)[] = [
    'name', 'shortName', 'industry', 'companySize',
    'contactName', 'contactEmail', 'contactPhone',
  ]
  const input: TenantUpdateInput = {}
  for (const key of allowed) {
    if (key in body) {
      const v = body[key]
      if (typeof v !== 'string') {
        return Response.json({ error: `${key} must be a string` }, { status: 400 })
      }
      if (key === 'name' && v.trim() === '') {
        return Response.json({ error: 'name cannot be empty' }, { status: 400 })
      }
      input[key] = v
    }
  }

  await updateTenant(ctx, input)
  const tenant = await getTenant(ctx)
  return Response.json({ tenant })
}
