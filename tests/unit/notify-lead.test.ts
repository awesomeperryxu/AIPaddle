/**
 * L2 测试 · V12-4.8 通知能力 + V12-8.9 留资
 * - 两条通道互不阻塞：一条挂了另一条照发
 * - sendLeadNotification 永不抛：通知失败不能连累留资入库
 * - 投递明细逐条落库（部分失败必须可查）
 * - createLead：必填校验 + 超长截断而非拒绝
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  sendWecomLead: vi.fn(),
  sendEmailLead: vi.fn(),
  insert: vi.fn(),
  single: vi.fn(),
}))

vi.mock('@/lib/notify/wecom', () => ({ sendWecomLead: h.sendWecomLead }))
vi.mock('@/lib/notify/email', () => ({ sendEmailLead: h.sendEmailLead }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      insert: (...a: unknown[]) => {
        h.insert(...a)
        return { select: () => ({ single: h.single }) }
      },
    }),
  }),
}))

import { sendLeadNotification } from '@/lib/notify'
import { createLead, LeadValidationError } from '@/lib/data/leads'

const ctx = { userId: 'svc-1', orgId: 'org-1', roles: [] as never[] }
const lead = { name: '张先生', contact: '13800138000', project: '写字楼日常保洁' }

beforeEach(() => {
  Object.values(h).forEach(f => f.mockReset())
  h.sendWecomLead.mockResolvedValue({ success: true, target: '@all', latencyMs: 10 })
  h.sendEmailLead.mockResolvedValue({ success: true, target: 'a@b.com', latencyMs: 20 })
})

describe('sendLeadNotification 双通道', () => {
  it('两条都成功 → email/wecom 均 true', async () => {
    const r = await sendLeadNotification(ctx, lead)
    expect(r).toMatchObject({ email: true, wecom: true })
    expect(r.deliveries).toHaveLength(2)
  })

  it('企微挂了，邮件照发（互不阻塞）', async () => {
    h.sendWecomLead.mockResolvedValue({ success: false, errorCode: '60020', latencyMs: 5 })
    const r = await sendLeadNotification(ctx, lead)
    expect(r).toMatchObject({ wecom: false, email: true })
    expect(h.sendEmailLead).toHaveBeenCalledOnce()
  })

  it('通道抛异常也不向上抛 —— 通知失败绝不能连累留资', async () => {
    h.sendWecomLead.mockRejectedValue(new Error('网络炸了'))
    h.sendEmailLead.mockRejectedValue(new Error('SMTP 超时'))
    const r = await sendLeadNotification(ctx, lead)
    expect(r).toMatchObject({ email: false, wecom: false })
  })

  it('带 leadId 时逐条落投递记录（部分失败可查）', async () => {
    h.sendEmailLead.mockResolvedValue({
      success: false, target: 'a@b.com', errorCode: 'auth_failed', errorDetail: 'bad login', latencyMs: 30,
    })
    await sendLeadNotification(ctx, lead, { leadId: 'lead-1' })
    const rows = h.insert.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows.find(r => r.channel === 'wecom')).toMatchObject({ success: true, org_id: 'org-1', lead_id: 'lead-1' })
    expect(rows.find(r => r.channel === 'email')).toMatchObject({ success: false, error_code: 'auth_failed' })
  })

  it('落库失败不影响返回结果（通知已经发出去了）', async () => {
    h.insert.mockImplementation(() => { throw new Error('db down') })
    const r = await sendLeadNotification(ctx, lead, { leadId: 'lead-1' })
    expect(r).toMatchObject({ email: true, wecom: true })
  })
})

describe('createLead 校验', () => {
  beforeEach(() => {
    h.single.mockResolvedValue({
      data: {
        id: 'lead-1', name: '张先生', contact: '13800138000', project: null,
        expected_time: null, site_info: null, source: 'website', status: 'new',
        created_at: '2026-07-31T00:00:00Z',
      },
      error: null,
    })
  })

  it.each([
    ['称呼为空', { name: '  ', contact: '138' }, /称呼/],
    ['联系方式为空', { name: '张先生', contact: '' }, /联系方式/],
  ])('%s → LeadValidationError', async (_n, input, re) => {
    await expect(
      createLead(ctx, { extensionId: 'ext-1', ...input }),
    ).rejects.toThrow(LeadValidationError)
    await expect(
      createLead(ctx, { extensionId: 'ext-1', ...input }),
    ).rejects.toThrow(re)
  })

  it('超长字段截断而非拒绝 —— 访客多打几个字不该丢线索', async () => {
    await createLead(ctx, {
      extensionId: 'ext-1', name: '张'.repeat(200), contact: '1'.repeat(300),
      siteInfo: '场'.repeat(1000),
    })
    const row = h.insert.mock.calls[0][0] as Record<string, string>
    expect(row.name.length).toBe(50)
    expect(row.contact.length).toBe(100)
    expect(row.site_info.length).toBe(500)
  })

  it('org_id 取自服务端 ctx，不采信外部传入', async () => {
    await createLead(ctx, { extensionId: 'ext-1', name: '张先生', contact: '138' })
    expect((h.insert.mock.calls[0][0] as Record<string, unknown>).org_id).toBe('org-1')
  })
})
