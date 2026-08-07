/**
 * L1 测试 · 顶部多窗口标签的视图判定与标题解析（WF-19）
 *
 * 用户实测反馈：在个人助理里说「建个查全网 AI 大事件的流程」，系统自动跳到了
 * 工作流编辑页，页面本身正常，但**它没有出现在顶部可切换的标签里**——
 * 切到别的页面后就再也切不回来了。
 *
 * 根因：可钉住判定拿整条路径去查白名单，`workflows/<uuid>` 自然查不到。
 * 判定必须看一级段。
 */
import { describe, it, expect } from 'vitest'
import { isPinnableView, resolveTabTitle, VIEW_TITLES } from '@/lib/nav/views'

describe('isPinnableView', () => {
  it('一级视图可钉住', () => {
    expect(isPinnableView('workflows')).toBe(true)
    expect(isPinnableView('assistant')).toBe(true)
  })

  it('详情页可钉住——这正是本次修的 bug', () => {
    expect(isPinnableView('workflows/9f3c1a2b-0000-4444-8888-aaaabbbbcccc')).toBe(true)
    expect(isPinnableView('agents-admin/42')).toBe(true)
  })

  it('侧栏里的二级 href 可钉住', () => {
    expect(isPinnableView('plugins/mcp')).toBe(true)
    expect(isPinnableView('plugins/api')).toBe(true)
  })

  it('白名单外的路径不钉住，避免登录页之类被当成标签', () => {
    expect(isPinnableView('login')).toBe(false)
    expect(isPinnableView('')).toBe(false)
  })
})

describe('resolveTabTitle', () => {
  it('一级视图用白名单名', () => {
    expect(resolveTabTitle('workflows')).toBe('工作流管理')
  })

  it('精确命中的二级 href 优先于「父名 · 详情」回落', () => {
    expect(resolveTabTitle('plugins/mcp')).toBe('MCP')
  })

  it('详情页带上页面上报的名字，两条流程的标签才区分得开', () => {
    const reported = { 'workflows/a': '查全网AI大事件', 'workflows/b': '日报汇总' }
    expect(resolveTabTitle('workflows/a', reported)).toBe('工作流管理 · 查全网AI大事件')
    expect(resolveTabTitle('workflows/b', reported)).toBe('工作流管理 · 日报汇总')
  })

  it('页面还没上报时回落到「父名 · 详情」，不显示裸 uuid', () => {
    expect(resolveTabTitle('workflows/9f3c1a2b')).toBe('工作流管理 · 详情')
  })

  it('完全认不出的路径原样返回，不编造标题', () => {
    expect(resolveTabTitle('whatever/x')).toBe('whatever/x')
  })
})

describe('白名单与侧栏对齐', () => {
  // 侧栏能点到的页面必须都能钉成标签，否则又会出现「切走回不来」
  it.each(['dashboard', 'assistant', 'ai-activity', 'agents-admin', 'agents', 'agent-schedules',
    'skill-hub', 'my-skills', 'plugins/mcp', 'plugins/api', 'plugins/db', 'plugins/smtp',
    'knowledge-admin', 'knowledge', 'workflows', 'security', 'members', 'extensions', 'keys',
  ])('侧栏项 %s 已登记', (href) => {
    expect(VIEW_TITLES[href]).toBeTruthy()
  })
})
