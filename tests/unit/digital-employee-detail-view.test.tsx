/**
 * L2 测试 · DE-4/DE-5 数字员工详情页
 *
 * 这一页要回答的是用户原话的三个问题：由谁组成、谁什么时候建的、现在还能不能用。
 * 「还能不能用」尤其要钉死——下级未发布时页面必须明说，
 * 否则用户看到「已发布」就以为能跑，实际调用时才发现下级是草稿。
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DigitalEmployeeDetail } from '@/lib/data/digital-employee'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

import { DigitalEmployeeDetailView } from '@/components/views/digital-employee-detail-view'

const sub = (id: string, name: string, status: string) =>
  ({ id, name, status, department: '研发部', description: `${name}的简介` }) as never

const base = (over: Partial<DigitalEmployeeDetail> = {}): DigitalEmployeeDetail => ({
  id: 'de1', name: '内容创作专家团', description: '五人协作完成选题、撰写、审核',
  department: '内容创作', status: 'published',
  subAgents: [sub('a1', '文博凯', 'published'), sub('a2', '律守正', 'published')],
  missingSubAgentIds: [],
  createdByName: 'Demo 管理员', createdAt: '2026-07-25 10:30:00',
  updatedAt: '2026-08-01 09:00:00', origin: '用户自建', model: 'qwen-plus',
  ...over,
})

describe('DE-4：由谁组成', () => {
  it('列出全部下级 Agent', () => {
    render(<DigitalEmployeeDetailView detail={base()} canEdit />)
    expect(screen.getByText('文博凯')).toBeTruthy()
    expect(screen.getByText('律守正')).toBeTruthy()
    expect(screen.getByText(/由 2 个 Agent 组成/)).toBeTruthy()
  })

  it('没有下级时说明它是普通 Agent，而不是显示空白', () => {
    render(<DigitalEmployeeDetailView detail={base({ subAgents: [] })} canEdit />)
    expect(screen.getByText(/这是一个普通 Agent，没有下级/)).toBeTruthy()
  })

  it('编辑走编排页，不在本页重造配置 UI', async () => {
    render(<DigitalEmployeeDetailView detail={base()} canEdit />)
    screen.getByRole('button', { name: /编辑配置/ }).click()
    expect(push).toHaveBeenCalledWith('/agents-admin/de1')
  })

  it('无 agent:update 权限时不出现编辑按钮', () => {
    render(<DigitalEmployeeDetailView detail={base()} canEdit={false} />)
    expect(screen.queryByRole('button', { name: /编辑配置/ })).toBeNull()
  })
})

describe('DE-5：创建溯源', () => {
  it('显示创建人 / 创建时间 / 来源', () => {
    render(<DigitalEmployeeDetailView detail={base()} canEdit />)
    expect(screen.getByText('Demo 管理员')).toBeTruthy()
    expect(screen.getByText('2026-07-25 10:30:00')).toBeTruthy()
    expect(screen.getByText('用户自建')).toBeTruthy()
  })

  it('模型为空时显示「租户默认」，不显示空白', () => {
    render(<DigitalEmployeeDetailView detail={base({ model: '' })} canEdit />)
    expect(screen.getByText('租户默认')).toBeTruthy()
  })
})

describe('有效性：下级状态必须暴露', () => {
  it('全部下级已发布时不报警', () => {
    render(<DigitalEmployeeDetailView detail={base()} canEdit />)
    expect(screen.queryByText(/下级 Agent 存在问题/)).toBeNull()
  })

  it('下级是草稿时明确报警并指出是哪一个', () => {
    render(<DigitalEmployeeDetailView
      detail={base({ subAgents: [sub('a1', '文博凯', 'published'), sub('a2', '律守正', 'draft')] })} canEdit />)
    expect(screen.getByText(/下级 Agent 存在问题/)).toBeTruthy()
    expect(screen.getByText(/律守正（草稿）/)).toBeTruthy()
  })

  it('下级已下线同样报警', () => {
    render(<DigitalEmployeeDetailView
      detail={base({ subAgents: [sub('a1', '文博凯', 'offline')] })} canEdit />)
    expect(screen.getByText(/文博凯（已下线）/)).toBeTruthy()
  })

  it('下级被删除时如实说明，不假装组成完整', () => {
    render(<DigitalEmployeeDetailView
      detail={base({ missingSubAgentIds: ['gone-1', 'gone-2'] })} canEdit />)
    expect(screen.getByText(/2 个下级已被删除，无法调用/)).toBeTruthy()
  })

  it('数字员工自身是 published 但下级是草稿时——仍要报警（这正是最容易漏的组合）', () => {
    render(<DigitalEmployeeDetailView
      detail={base({ status: 'published', subAgents: [sub('a1', '文博凯', 'draft')] })} canEdit />)
    expect(screen.getByText(/下级 Agent 存在问题/)).toBeTruthy()
  })
})
