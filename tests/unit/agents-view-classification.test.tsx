/**
 * L2 测试 · DE-1/2/3 数字员工页归类与团队渲染
 *
 * 这三条是同一次排查里查出来的，都属于「数据在库里、页面上是另一回事」：
 *   DE-1 两个 tab 的归类完全反了——「数字员工」tab 列的是普通 Agent；
 *   DE-2 团队成员按 department 名瞎猜，与真实 memberIds 无关；
 *   DE-3 团队从 /api/teams 取回来了，但渲染层读的是另一个变量，用户永远看不见。
 *
 * 三条都不是崩溃型 bug，页面照常渲染、不报错——所以必须用断言钉住，
 * 靠肉眼看「页面出来了」是发现不了的。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

const apiFetch = vi.fn()
vi.mock('@/lib/api/client', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }))

import { AgentsView } from '@/components/views/agents-view'

const agent = (id: string, name: string, department = '研发部') =>
  ({ id, name, department, description: `${name}的简介`, status: 'published', model: 'qwen-plus', calls: 0 }) as never

// 三个普通 Agent + 一个数字员工（de1 挂了 a1/a2）
const AGENTS = [
  agent('de1', '内容创作专家团'),
  agent('a1', '文博凯'),
  agent('a2', '律守正'),
  agent('a3', '票证核验专家', '法务安全'),
]
const DE_IDS = ['de1'] // 服务端算出来的：挂了下级 Agent 的那个

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockResolvedValue({ teams: [] })
})

describe('DE-1：两个 tab 的归类', () => {
  it('「数字员工」tab 列的是挂了下级的那个，不是普通 Agent', () => {
    render(<AgentsView agents={AGENTS} digitalEmployeeIds={DE_IDS} canManage />)
    // 计数直接暴露归类是否反了：4 个 Agent 里只有 1 个是数字员工
    expect(screen.getByRole('tab', { name: /数字员工 \(1\)/ })).toBeTruthy()
  })

  it('普通 Agent 不出现在数字员工列表里', () => {
    render(<AgentsView agents={AGENTS} digitalEmployeeIds={DE_IDS} canManage />)
    expect(screen.getAllByText('内容创作专家团').length).toBeGreaterThan(0)
    // 旧代码这里会把三个普通 Agent 全列出来
    expect(screen.queryByText('票证核验专家')).toBeNull()
  })

  it('「数字团队」tab 的计数来自 /api/teams，与 agents 无关', async () => {
    // 🔴 团队数（2）必须与 agents 里的数字员工数（1）不同，
    //    否则旧代码（拿 digitalTeams.length 充数）也会碰巧通过，这条断言就是空转的
    apiFetch.mockResolvedValue({
      teams: [
        { id: 't1', name: '增长小队', description: '', status: 'published', memberIds: ['de1'], updatedAt: '' },
        { id: 't2', name: '合规小队', description: '', status: 'draft', memberIds: ['a3'], updatedAt: '' },
      ],
    })
    render(<AgentsView agents={AGENTS} digitalEmployeeIds={DE_IDS} canManage />)
    await userEvent.click(screen.getByRole('tab', { name: /数字团队/ }))
    await waitFor(() => expect(screen.getByRole('tab', { name: /数字团队 \(2\)/ })).toBeTruthy())
  })
})

describe('DE-3：建出来的团队必须显示', () => {
  it('/api/teams 有数据时，团队卡片出现在列表里', async () => {
    apiFetch.mockResolvedValue({
      teams: [{ id: 't1', name: '增长小队', description: '负责增长', status: 'published', memberIds: ['de1'], updatedAt: '' }],
    })
    render(<AgentsView agents={AGENTS} digitalEmployeeIds={DE_IDS} canManage />)
    await userEvent.click(screen.getByRole('tab', { name: /数字团队/ }))
    // 旧代码渲染的是 agents 派生的 digitalTeams，这个名字永远出不来
    await waitFor(() => expect(screen.getByText('增长小队')).toBeTruthy())
  })

  it('/api/teams 为空时显示空态，而不是拿 agents 凑数', async () => {
    render(<AgentsView agents={AGENTS} digitalEmployeeIds={DE_IDS} canManage />)
    await userEvent.click(screen.getByRole('tab', { name: /数字团队/ }))
    await waitFor(() => expect(screen.getByText('暂无数字团队')).toBeTruthy())
  })
})

describe('DE-2：成员来自 memberIds，不按部门猜', () => {
  it('成员数 = memberIds 命中的 Agent 数', async () => {
    // 🔴 跨部门取 3 个成员：旧代码按 department 匹配算不出 3，
    //    fixture 必须让新旧两种算法结果不同，否则这条断言证明不了任何事
    apiFetch.mockResolvedValue({
      teams: [{ id: 't1', name: '增长小队', description: '', status: 'published', memberIds: ['a1', 'a2', 'a3'], updatedAt: '' }],
    })
    render(<AgentsView agents={AGENTS} digitalEmployeeIds={DE_IDS} canManage />)
    await userEvent.click(screen.getByRole('tab', { name: /数字团队/ }))
    await waitFor(() => expect(screen.getByText(/3 名数字员工/)).toBeTruthy())
  })

  it('同部门但不在 memberIds 里的 Agent 不算成员', async () => {
    // a1/a2/de1 都是「研发部」。按旧的 department 匹配会算出 3 个；
    // 按 memberIds 只有 a1 一个。这条正是用来钉死旧行为的。
    apiFetch.mockResolvedValue({
      teams: [{ id: 't1', name: '增长小队', description: '', status: 'published', memberIds: ['a1'], updatedAt: '' }],
    })
    render(<AgentsView agents={AGENTS} digitalEmployeeIds={DE_IDS} canManage />)
    await userEvent.click(screen.getByRole('tab', { name: /数字团队/ }))
    await waitFor(() => expect(screen.getByText(/1 名数字员工/)).toBeTruthy())
  })

  it('memberIds 里有查不到的 id 时如实标注，不假装成员齐全', async () => {
    apiFetch.mockResolvedValue({
      teams: [{ id: 't1', name: '增长小队', description: '', status: 'published', memberIds: ['a1', 'deleted-id'], updatedAt: '' }],
    })
    render(<AgentsView agents={AGENTS} digitalEmployeeIds={DE_IDS} canManage />)
    await userEvent.click(screen.getByRole('tab', { name: /数字团队/ }))
    await waitFor(() => expect(screen.getByText(/1 名不可用/)).toBeTruthy())
  })
})
