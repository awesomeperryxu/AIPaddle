/**
 * L3 集成测试 · app/api/departments（GET/POST/PATCH/DELETE）
 * 覆盖：401 未登录 / 403 权限（读放开、写仅 Admin）/ 400 入参 / 409 业务冲突 / 404 跨租户。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/departments', () => ({
  listDepartments: vi.fn().mockResolvedValue([]),
  listDepartmentTree: vi.fn().mockResolvedValue([]),
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  deleteDepartment: vi.fn(),
}))

import { getRequestContext } from '@/lib/context'
import { GET, POST } from '@/app/api/departments/route'
import { PATCH, DELETE } from '@/app/api/departments/[id]/route'
import {
  listDepartments, listDepartmentTree, createDepartment, updateDepartment, deleteDepartment,
} from '@/lib/data/departments'

const mockCtx = vi.mocked(getRequestContext)
const mockFlat = vi.mocked(listDepartments)
const mockTree = vi.mocked(listDepartmentTree)
const mockCreate = vi.mocked(createDepartment)
const mockUpdate = vi.mocked(updateDepartment)
const mockDelete = vi.mocked(deleteDepartment)

const adminCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Admin'] }
const devCtx: RequestContext = { userId: 'u2', orgId: 'org1', roles: ['Developer'] }
const userCtx: RequestContext = { userId: 'u3', orgId: 'org1', roles: ['User'] }

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init)

// ──────────────────────────────────────────────────────────────────────────────
describe('GET /api/departments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await GET(req('/api/departments'))).status).toBe(401)
  })

  it('普通成员可读（选部门要用）→ 200 树形', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    mockTree.mockResolvedValueOnce([])
    const res = await GET(req('/api/departments'))
    expect(res.status).toBe(200)
    expect(mockTree).toHaveBeenCalled()
  })

  it('?flat=1 → 返回扁平列表', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockFlat.mockResolvedValueOnce([])
    const res = await GET(req('/api/departments?flat=1'))
    expect(res.status).toBe(200)
    expect(mockFlat).toHaveBeenCalled()
    expect(mockTree).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('POST /api/departments', () => {
  beforeEach(() => vi.clearAllMocks())

  const post = (body: unknown) =>
    POST(req('/api/departments', { method: 'POST', body: JSON.stringify(body) }))

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await post({ name: '研发部' })).status).toBe(401)
  })

  it('Developer 建部门 → 403（写仅 Admin）', async () => {
    mockCtx.mockResolvedValueOnce(devCtx)
    expect((await post({ name: '研发部' })).status).toBe(403)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('名称为空 → 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    expect((await post({ name: '   ' })).status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('Admin 建部门 → 201', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockCreate.mockResolvedValueOnce({
      id: 'd1', parentId: null, name: '研发部', leaderId: null,
      costCenter: null, status: 'active', sortOrder: 0, memberCount: 0,
    })
    const res = await post({ name: '研发部' })
    expect(res.status).toBe(201)
    expect((await res.json()).department.id).toBe('d1')
  })

  it('层级超限 → 409', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockCreate.mockRejectedValueOnce(new Error('部门层级不能超过 5 级'))
    const res = await post({ name: '第六级', parentId: 'l5' })
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('conflict')
  })

  it('同级同名 → 409', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockCreate.mockRejectedValueOnce(new Error('同级已存在同名部门'))
    expect((await post({ name: '研发部' })).status).toBe(409)
  })

  it('上级部门跨租户 → 404', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockCreate.mockRejectedValueOnce(new Error('上级部门不存在或无权限'))
    expect((await post({ name: '研发部', parentId: 'other-org' })).status).toBe(404)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/departments/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  const patch = (body: unknown, id = 'd1') =>
    PATCH(req(`/api/departments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), params(id))

  it('非 Admin → 403', async () => {
    mockCtx.mockResolvedValueOnce(userCtx)
    expect((await patch({ name: '新名' })).status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('状态非法 → 400', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    expect((await patch({ status: 'deleted' })).status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('parentId 传 null → 透传为提升顶级', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockUpdate.mockResolvedValueOnce(undefined)
    expect((await patch({ parentId: null })).status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(adminCtx, 'd1', { parentId: null })
  })

  it('改名 + 负责人 + 成本中心 + 状态 → 200 全量透传', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockUpdate.mockResolvedValueOnce(undefined)
    const res = await patch({ name: '平台部', leaderId: 'u9', costCenter: 'CC-01', status: 'frozen' })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(adminCtx, 'd1', {
      name: '平台部', leaderId: 'u9', costCenter: 'CC-01', status: 'frozen',
    })
  })

  it('移动成环 → 409', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockUpdate.mockRejectedValueOnce(new Error('不能把部门移动到自己或其下级之下'))
    expect((await patch({ parentId: 'child' })).status).toBe(409)
  })

  it('跨租户部门 → 404', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockUpdate.mockRejectedValueOnce(new Error('部门不存在或无权限'))
    expect((await patch({ name: 'x' }, 'other-org-dept')).status).toBe(404)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
describe('DELETE /api/departments/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  const del = (id: string) => DELETE(req(`/api/departments/${id}`, { method: 'DELETE' }), params(id))

  it('未登录 → 401', async () => {
    mockCtx.mockResolvedValueOnce(null)
    expect((await del('d1')).status).toBe(401)
  })

  it('非 Admin → 403', async () => {
    mockCtx.mockResolvedValueOnce(devCtx)
    expect((await del('d1')).status).toBe(403)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('Admin 删空部门 → 200', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockDelete.mockResolvedValueOnce(undefined)
    expect((await del('d1')).status).toBe(200)
  })

  it('部门下有成员 → 409', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockDelete.mockRejectedValueOnce(new Error('该部门下还有成员，请先转移成员'))
    const res = await del('d1')
    expect(res.status).toBe(409)
    expect((await res.json()).error.message).toContain('请先转移成员')
  })

  it('部门下有子部门 → 409', async () => {
    mockCtx.mockResolvedValueOnce(adminCtx)
    mockDelete.mockRejectedValueOnce(new Error('该部门下还有子部门，请先移除或转移'))
    expect((await del('d1')).status).toBe(409)
  })
})
