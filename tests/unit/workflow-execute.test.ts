import { describe, it, expect, vi } from 'vitest'

// mock lib/ai 的 chat（不打真实 Qwen）——LLM 节点返回可预期内容。
// 🔴 长度按**最后一条**（user）算：WF-20 起 msgs[0] 是引擎注入的时间锚点 system 消息。
const chatMock = vi.fn(async (msgs: { role: string; content: string }[]) =>
  `LLM回复[输入长度=${msgs[msgs.length - 1].content.length}]`)
vi.mock('@/lib/ai', () => ({ chat: (...args: never[]) => chatMock(...args) }))
// mock 知识检索 RAG
vi.mock('@/lib/kb/rag', () => ({
  retrieveSegments: vi.fn(async (_ctx: unknown, q: string) => [
    { filename: '手册.pdf', snippet: `关于「${q}」的资料`, documentId: 'd1', similarity: 0.9 },
  ]),
}))
// mock 平台 Agent 查询（Agent 节点执行器用）
vi.mock('@/lib/data/agents', () => ({
  getAgentForChat: vi.fn(async (_ctx: unknown, id: string) =>
    id === 'AG1' ? { id: 'AG1', name: '客服', description: '', status: 'published', systemPrompt: '你是客服' } : null,
  ),
}))

import { executeGraph } from '@/lib/workflow/execute'

const ctx = { userId: 'u1', orgId: 'o1', roles: ['User'] } as never

const n = (id: string, type: string, config?: Record<string, unknown>) => ({ id, type, data: { config } })
const e = (source: string, target: string) => ({ source, target })

describe('executeGraph（4.4.3 最小执行引擎）', () => {
  it('start→llm→end 串行执行成功，返回每节点 trace', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('l', 'llm'), n('t', 'end')], edges: [e('s', 'l'), e('l', 't')] },
      '你好',
    )
    expect(r.status).toBe('succeeded')
    expect(r.traces.map((x) => x.nodeId)).toEqual(['s', 'l', 't'])
    expect(r.traces.every((x) => x.status === 'succeeded')).toBe(true)
    // 最终输出 = end 节点输出 = llm 输出透传
    expect(r.output).toContain('LLM回复')
  })

  it('非法图（无 end）→ failed', async () => {
    const r = await executeGraph({ nodes: [n('s', 'start'), n('l', 'llm')], edges: [e('s', 'l')] }, 'x')
    expect(r.status).toBe('failed')
  })

  it('白名单外的节点（code 等）→ skipped 并透传', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('c', 'code'), n('t', 'end')], edges: [e('s', 'c'), e('c', 't')] },
      'passthrough',
    )
    expect(r.status).toBe('succeeded')
    expect(r.traces.find((x) => x.nodeId === 'c')?.status).toBe('skipped')
    expect(r.output).toBe('passthrough') // 透传到 end
  })

  // WF-22：tool 节点改为真调用。
  // 🔴 调不通必须显式 failed，不能像以前那样 skipped 透传——
  // 透传会让下游 LLM 拿着上一步的文本继续跑，整条流程「看起来成功了」，
  // 而它要的外部数据从来没进来过。用户拿到的那篇编造报告就是这么产生的。
  it('tool 节点没绑 Skill → 整条流程 failed，并说清原因', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('tool', 'tool'), n('t', 'end')], edges: [e('s', 'tool'), e('tool', 't')] },
      'passthrough',
      { ctx },
    )
    expect(r.status).toBe('failed')
    const t = r.traces.find((x) => x.nodeId === 'tool')
    expect(t?.status).toBe('failed')
    expect(t?.error).toContain('未绑定 Skill')
  })

  it('缺 ctx 时 tool 节点 failed，不装作跑过', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('tool', 'tool', { tool_id: 'skill-1' }), n('t', 'end')], edges: [e('s', 'tool'), e('tool', 't')] },
      'x',
    )
    expect(r.status).toBe('failed')
    expect(r.traces.find((x) => x.nodeId === 'tool')?.error).toContain('缺少运行上下文')
  })

  it('LLM 节点用 config.prompt 模板（{{input}} 占位）', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('l', 'llm', { prompt: '翻译：{{input}}' }), n('t', 'end')], edges: [e('s', 'l'), e('l', 't')] },
      'hello',
    )
    // chat 被调用，输入长度 = '翻译：hello'.length = 8
    expect(r.output).toContain('输入长度=8')
  })

  // WF-20：模型不知道「今天」是哪天，跑「查当天资讯」时会拿训练语料里的日期作答
  //（用户实测跑出了整篇 2024 年 8 月的假报告）。引擎必须每次运行都把时间事实喂进去。
  describe('WF-20 运行时时间上下文', () => {
    const at = new Date('2026-08-07T02:30:00Z') // 北京时间 2026-08-07 10:30

    it('LLM 节点带上时间锚点 system 消息', async () => {
      chatMock.mockClear()
      await executeGraph(
        { nodes: [n('s', 'start'), n('l', 'llm', { prompt: '总结：{{input}}' }), n('t', 'end')], edges: [e('s', 'l'), e('l', 't')] },
        'x', { now: at },
      )
      const msgs = chatMock.mock.calls[0][0]
      expect(msgs[0].role).toBe('system')
      expect(msgs[0].content).toContain('2026-08-07')
      expect(msgs[0].content).toContain('2026-08-06')
    })

    it('提示词里的 {{today}} / {{yesterday}} 被替换成真实日期', async () => {
      chatMock.mockClear()
      await executeGraph(
        { nodes: [n('s', 'start'), n('l', 'llm', { prompt: '抓取 {{yesterday}} 的资讯' }), n('t', 'end')], edges: [e('s', 'l'), e('l', 't')] },
        '', { now: at },
      )
      const user = chatMock.mock.calls[0][0].at(-1)!
      expect(user.content).toContain('2026-08-06')
      expect(user.content).not.toContain('{{yesterday}}')
    })

    it('模板转换节点同样能用时间占位符（不调 LLM）', async () => {
      const r = await executeGraph(
        { nodes: [n('s', 'start'), n('tt', 'template-transform', { template: '日期={{today}}' }), n('t', 'end')], edges: [e('s', 'tt'), e('tt', 't')] },
        '', { now: at },
      )
      expect(r.output).toBe('日期=2026-08-07')
    })
  })

  // 4.4.8 slice 1：模板转换 + 参数提取器
  it('模板转换节点：{{input}} 替换为节点输入（不调 LLM）', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('tt', 'template-transform', { template: '结果=[{{input}}]' }), n('t', 'end')], edges: [e('s', 'tt'), e('tt', 't')] },
      'ABC',
    )
    expect(r.status).toBe('succeeded')
    const tr = r.traces.find((x) => x.nodeId === 'tt')
    expect(tr?.status).toBe('succeeded')
    expect(r.output).toBe('结果=[ABC]')
  })

  it('模板转换：空模板透传输入', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('tt', 'template-transform', {}), n('t', 'end')], edges: [e('s', 'tt'), e('tt', 't')] },
      'passthru',
    )
    expect(r.output).toBe('passthru')
  })

  it('参数提取器节点：调 LLM 提取（succeeded）', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('pe', 'parameter-extractor', { parameters: [{ name: 'city' }] }), n('t', 'end')], edges: [e('s', 'pe'), e('pe', 't')] },
      '北京天气',
    )
    expect(r.status).toBe('succeeded')
    const tr = r.traces.find((x) => x.nodeId === 'pe')
    expect(tr?.status).toBe('succeeded')
    expect(r.output).toContain('LLM回复') // mock chat 被调用
  })

  // 4.4.8 slice3：知识检索（真实 RAG）
  it('知识检索节点：有 ctx → 检索并拼接片段', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('kr', 'knowledge-retrieval', { dataset_ids: ['kb1'] }), n('t', 'end')], edges: [e('s', 'kr'), e('kr', 't')] },
      '报销流程',
      { ctx },
    )
    expect(r.status).toBe('succeeded')
    expect(r.traces.find((x) => x.nodeId === 'kr')?.status).toBe('succeeded')
    expect(r.output).toContain('报销流程')
    expect(r.output).toContain('手册.pdf')
  })

  it('知识检索节点：无 ctx → skipped 透传', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('kr', 'knowledge-retrieval', {}), n('t', 'end')], edges: [e('s', 'kr'), e('kr', 't')] },
      'x',
    )
    expect(r.traces.find((x) => x.nodeId === 'kr')?.status).toBe('skipped')
    expect(r.output).toBe('x')
  })

  // 4.4.8 slice4：HTTP 请求 + SSRF 防护
  it('HTTP 节点：正常 URL → 输出响应体', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200 }),
    )
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('h', 'http-request', { url: 'https://api.example.com/data', method: 'GET' }), n('t', 'end')], edges: [e('s', 'h'), e('h', 't')] },
      '',
    )
    expect(r.status).toBe('succeeded')
    expect(r.output).toContain('HTTP 200')
    expect(r.output).toContain('"ok":true')
    fetchSpy.mockRestore()
  })

  it('HTTP 节点：内网/本机地址 → SSRF 拦截 → failed', async () => {
    for (const url of ['http://127.0.0.1:8080/', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/', 'file:///etc/passwd']) {
      const r = await executeGraph(
        { nodes: [n('s', 'start'), n('h', 'http-request', { url }), n('t', 'end')], edges: [e('s', 'h'), e('h', 't')] },
        '',
      )
      expect(r.status).toBe('failed')
    }
  })

  // 4.1.10：Agent 节点（引用已发布平台 Agent）
  it('Agent 节点：引用有效 Agent + ctx → 用其人设跑 LLM', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('a', 'agent', { agentId: 'AG1' }), n('t', 'end')], edges: [e('s', 'a'), e('a', 't')] },
      '你好',
      { ctx },
    )
    expect(r.status).toBe('succeeded')
    expect(r.traces.find((x) => x.nodeId === 'a')?.status).toBe('succeeded')
    expect(r.output).toContain('LLM回复')
  })

  it('Agent 节点：未指定 agentId → skipped 透传', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('a', 'agent', {}), n('t', 'end')], edges: [e('s', 'a'), e('a', 't')] },
      'x',
      { ctx },
    )
    expect(r.traces.find((x) => x.nodeId === 'a')?.status).toBe('skipped')
    expect(r.output).toBe('x')
  })

  it('Agent 节点：引用不存在的 Agent → skipped', async () => {
    const r = await executeGraph(
      { nodes: [n('s', 'start'), n('a', 'agent', { agentId: 'NOPE' }), n('t', 'end')], edges: [e('s', 'a'), e('a', 't')] },
      'x',
      { ctx },
    )
    expect(r.traces.find((x) => x.nodeId === 'a')?.status).toBe('skipped')
  })
})
