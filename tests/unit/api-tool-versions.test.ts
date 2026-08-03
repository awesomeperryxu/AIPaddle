/**
 * L3 集成测试 · Tool 版本 API 与 OpenAPI 导入
 * 覆盖：401 / 403 不触数据层 / 400 Binding 校验 / 201 创建 /
 *       OpenAPI 按 operation 拆分 / 部分失败如实回报 / 不接受 URL 拉取（SSRF）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestContext } from '@/lib/context'

vi.mock('@/lib/context', () => ({ getRequestContext: vi.fn() }))
vi.mock('@/lib/data/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/lib/data/tool-versions', async () => {
  // 只 mock 落库函数，保留真实的 assertBindingConfig——校验逻辑是本测试的重点
  const actual = await vi.importActual<typeof import('@/lib/data/tool-versions')>(
    '@/lib/data/tool-versions',
  )
  return { ...actual, listToolVersions: vi.fn(), createToolVersion: vi.fn() }
})
vi.mock('@/lib/data/plugins', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/plugins')>('@/lib/data/plugins')
  return { ...actual, getPluginById: vi.fn() }
})
vi.mock('@/lib/data/tools', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/tools')>('@/lib/data/tools')
  return { ...actual, createTool: vi.fn() }
})

import { getRequestContext } from '@/lib/context'
import { GET, POST } from '@/app/api/tools/[id]/versions/route'
import { POST as IMPORT_POST } from '@/app/api/plugins/[id]/import-openapi/route'
import { listToolVersions, createToolVersion } from '@/lib/data/tool-versions'
import { getPluginById } from '@/lib/data/plugins'
import { createTool } from '@/lib/data/tools'
import { BindingConfigError } from '@/lib/plugins/binding'

const mockCtx = vi.mocked(getRequestContext)
const mockList = vi.mocked(listToolVersions)
const mockCreateVersion = vi.mocked(createToolVersion)
const mockGetPlugin = vi.mocked(getPluginById)
const mockCreateTool = vi.mocked(createTool)

const devCtx: RequestContext = { userId: 'u1', orgId: 'org1', roles: ['Developer'] }
const userCtx: RequestContext = { userId: 'u2', orgId: 'org1', roles: ['User'] }

const TOOL_ID = '11111111-1111-4111-8111-111111111111'
const PLUGIN_ID = '22222222-2222-4222-8222-222222222222'
const params = (id: string) => ({ params: Promise.resolve({ id }) })

const req = (body: unknown) =>
  new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) })

const apiDoc = {
  servers: [{ url: 'https://api.example.com/v1' }],
  paths: {
    '/users': { get: { operationId: 'listUsers' }, post: { operationId: 'createUser' } },
    '/users/{id}': { get: { operationId: 'getUser' } },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCtx.mockResolvedValue(devCtx)
  mockList.mockResolvedValue([])
  mockCreateVersion.mockResolvedValue({
    id: 'v1', toolId: TOOL_ID, version: '1.0.0', inputSchema: {}, outputSchema: {},
    bindingConfig: {}, credentialId: null, changelog: '', status: 'draft', createdAt: '',
  })
  mockGetPlugin.mockResolvedValue({ id: PLUGIN_ID, providerType: 'api' } as never)
  mockCreateTool.mockImplementation(async (_c, i) =>
    ({ id: `t-${i.name}`, name: i.name } as never))
})

describe('GET /api/tools/[id]/versions', () => {
  it('未登录 401', async () => {
    mockCtx.mockResolvedValue(null)
    expect((await GET(req({}), params(TOOL_ID))).status).toBe(401)
  })

  it('无 tool:read 权限 403，且不触数据层', async () => {
    mockCtx.mockResolvedValue({ ...userCtx, roles: [] })
    expect((await GET(req({}), params(TOOL_ID))).status).toBe(403)
    expect(mockList).not.toHaveBeenCalled()
  })
})

describe('POST /api/tools/[id]/versions', () => {
  it('无 tool:update 权限 403，且不触数据层', async () => {
    mockCtx.mockResolvedValue(userCtx)
    expect((await POST(req({ version: '1.0.0' }), params(TOOL_ID))).status).toBe(403)
    expect(mockCreateVersion).not.toHaveBeenCalled()
  })

  it('创建成功 201', async () => {
    const res = await POST(req({ version: '1.0.0', bindingConfig: {} }), params(TOOL_ID))
    expect(res.status).toBe(201)
  })

  it('Binding 校验失败回 400（不是 500）', async () => {
    mockCreateVersion.mockRejectedValue(new BindingConfigError('接口地址必须是 https'))
    const res = await POST(req({ version: '1.0.0', bindingConfig: {} }), params(TOOL_ID))
    expect(res.status).toBe(400)
    expect((await res.json()).error.message).toMatch(/https/)
  })

  it('🔴 审计不记录 bindingConfig 本身（含内部拓扑信息）', async () => {
    const { writeAudit } = await import('@/lib/data/audit')
    await POST(req({ version: '1.0.0', bindingConfig: { endpoint: 'https://internal.corp/x' } }),
      params(TOOL_ID))
    const detail = vi.mocked(writeAudit).mock.calls[0]?.[4]
    expect(JSON.stringify(detail)).not.toContain('internal.corp')
  })
})

describe('POST /api/plugins/[id]/import-openapi', () => {
  it('无权限 403，且不触数据层', async () => {
    mockCtx.mockResolvedValue(userCtx)
    const res = await IMPORT_POST(
      req({ document: apiDoc, allowedHosts: ['api.example.com'] }), params(PLUGIN_ID))
    expect(res.status).toBe(403)
    expect(mockCreateTool).not.toHaveBeenCalled()
  })

  it('Plugin 不存在 404', async () => {
    mockGetPlugin.mockResolvedValue(null)
    const res = await IMPORT_POST(
      req({ document: apiDoc, allowedHosts: ['api.example.com'] }), params(PLUGIN_ID))
    expect(res.status).toBe(404)
  })

  it('非 API 类型 Plugin 拒绝导入', async () => {
    mockGetPlugin.mockResolvedValue({ id: PLUGIN_ID, providerType: 'mcp' } as never)
    const res = await IMPORT_POST(
      req({ document: apiDoc, allowedHosts: ['api.example.com'] }), params(PLUGIN_ID))
    expect(res.status).toBe(400)
  })

  it('按 operation 拆成多个 Tool（AC-02）', async () => {
    const res = await IMPORT_POST(
      req({ document: apiDoc, allowedHosts: ['api.example.com'] }), params(PLUGIN_ID))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.imported).toBe(3)
    expect(mockCreateTool).toHaveBeenCalledTimes(3)
    expect(mockCreateVersion).toHaveBeenCalledTimes(3)
  })

  it('🔴 只收请求体里的文档，不接受 URL 让服务端去拉（SSRF）', async () => {
    // 传 url 而非 document —— 必须报「缺 paths」而不是去请求那个地址
    const res = await IMPORT_POST(
      req({ url: 'http://169.254.169.254/latest/meta-data/', allowedHosts: ['api.example.com'] }),
      params(PLUGIN_ID))
    expect(res.status).toBe(400)
    expect((await res.json()).error.message).toMatch(/paths/)
    expect(mockCreateTool).not.toHaveBeenCalled()
  })

  it('域名白名单为空时拒绝整批导入', async () => {
    const res = await IMPORT_POST(req({ document: apiDoc, allowedHosts: [] }), params(PLUGIN_ID))
    expect(res.status).toBe(400)
    expect(mockCreateTool).not.toHaveBeenCalled()
  })

  it('🔴 部分失败如实回报，不用成功数盖过去', async () => {
    mockCreateTool.mockImplementation(async (_c, i) => {
      if (i.name === 'createUser') throw new Error('boom')
      return { id: `t-${i.name}`, name: i.name } as never
    })
    const res = await IMPORT_POST(
      req({ document: apiDoc, allowedHosts: ['api.example.com'] }), params(PLUGIN_ID))
    const body = await res.json()
    expect(body.imported).toBe(2)
    expect(body.total).toBe(3)
    expect(body.failed).toHaveLength(1)
    expect(body.failed[0].name).toBe('createUser')
  })
})
