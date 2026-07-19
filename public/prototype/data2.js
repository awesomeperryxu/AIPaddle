// AIPaddle mock data 2 — 2.10 租户内部管理 / Workflow v1.04 / 运营看板 / Key / 平台账单 / 知识库问答
export const departments = [
  { id: 'd-0', name: '北京品器资产管理有限公司', level: 0, head: '陈雪', costCenter: 'CC-0000', status: '正常', users: 1245, tokenLimit: 10000000, tokenUsed: 8450000, storage: '68.5 / 100 GB', agents: '6 / 20', qps: 200 },
  { id: 'd-1', name: '客服部', level: 1, head: '王芳', costCenter: 'CC-1001', status: '正常', users: 326, tokenLimit: 3400000, tokenUsed: 3120000, storage: '21.0 / 30 GB', agents: '2 / 5', qps: 80 },
  { id: 'd-11', name: '在线客服组', level: 2, head: '刘敏', costCenter: 'CC-1001-A', status: '正常', users: 208, tokenLimit: 2200000, tokenUsed: 2050000, storage: '12.4 / 18 GB', agents: '1 / 3', qps: 50 },
  { id: 'd-12', name: '电话客服组', level: 2, head: '高伟', costCenter: 'CC-1001-B', status: '正常', users: 118, tokenLimit: 1200000, tokenUsed: 1070000, storage: '8.6 / 12 GB', agents: '1 / 2', qps: 30 },
  { id: 'd-2', name: '人力资源部', level: 1, head: '陈雪', costCenter: 'CC-1002', status: '正常', users: 58, tokenLimit: 1800000, tokenUsed: 1690000, storage: '9.8 / 15 GB', agents: '1 / 3', qps: 30 },
  { id: 'd-3', name: '财务部', level: 1, head: '李华', costCenter: 'CC-1003', status: '正常', users: 64, tokenLimit: 1500000, tokenUsed: 1270000, storage: '11.2 / 15 GB', agents: '1 / 3', qps: 30 },
  { id: 'd-4', name: 'IT部', level: 1, head: '张明', costCenter: 'CC-1004', status: '正常', users: 132, tokenLimit: 1400000, tokenUsed: 1010000, storage: '18.9 / 25 GB', agents: '1 / 5', qps: 40 },
  { id: 'd-5', name: '法务部', level: 1, head: '郑倩', costCenter: 'CC-1005', status: '正常', users: 22, tokenLimit: 1000000, tokenUsed: 850000, storage: '5.4 / 8 GB', agents: '1 / 2', qps: 15 },
  { id: 'd-6', name: '战略投资部', level: 1, head: '（空缺）', costCenter: 'CC-1006', status: '冻结', users: 8, tokenLimit: 200000, tokenUsed: 0, storage: '0.2 / 2 GB', agents: '0 / 1', qps: 5 }
];

export const tenantUsers = [
  { id: 'u-01', empNo: 'E1001', name: '张明', email: 'zhangming@company.com', phone: '138****1001', dept: 'IT部', manager: '陈雪', position: '高级 AI 工程师', status: '正常', roles: ['开发者', 'AI 管理员'], joined: '2023-06-12', lastLogin: '2026-07-17 09:32' },
  { id: 'u-02', empNo: 'E1002', name: '李华', email: 'lihua@company.com', phone: '139****1002', dept: '财务部', manager: '陈雪', position: '财务经理', status: '正常', roles: ['财务管理员'], joined: '2022-03-01', lastLogin: '2026-07-16 18:05' },
  { id: 'u-03', empNo: 'E1003', name: '王芳', email: 'wangfang@company.com', phone: '137****1003', dept: '客服部', manager: '陈雪', position: '客服总监', status: '正常', roles: ['部门管理员'], joined: '2021-11-15', lastLogin: '2026-07-17 08:47' },
  { id: 'u-04', empNo: 'E1004', name: '赵强', email: 'zhaoqiang@company.com', phone: '135****1004', dept: 'IT部', manager: '张明', position: '安全工程师', status: '正常', roles: ['安全管理员'], joined: '2023-01-09', lastLogin: '2026-07-17 10:15' },
  { id: 'u-05', empNo: 'E1005', name: '陈雪', email: 'chenxue@company.com', phone: '136****1005', dept: '人力资源部', manager: '-', position: 'HRVP / 企业管理员', status: '正常', roles: ['企业超级管理员'], joined: '2020-05-20', lastLogin: '2026-07-17 11:02' },
  { id: 'u-06', empNo: 'E1006', name: '刘洋', email: 'liuyang@company.com', phone: '188****1006', dept: '客服部', manager: '王芳', position: '客服专员', status: '试用', roles: ['普通用户'], joined: '2026-06-20', lastLogin: '2026-07-16 17:20' },
  { id: 'u-07', empNo: 'E1007', name: '周明', email: 'zhouming@company.com', phone: '186****1007', dept: 'IT部', manager: '张明', position: 'AI 工程师', status: '冻结', roles: ['开发者'], joined: '2024-02-18', lastLogin: '2026-06-30 09:00' },
  { id: 'u-08', empNo: 'E1008', name: '孙丽', email: 'sunli@company.com', phone: '150****1008', dept: '法务部', manager: '郑倩', position: '法务专员', status: '正常', roles: ['普通用户'], joined: '2024-09-01', lastLogin: '2026-07-15 14:30' },
  { id: 'u-09', empNo: 'E1009', name: '吴刚', email: 'wugang@company.com', phone: '151****1009', dept: '销售部', manager: '-', position: '销售经理', status: '离职', roles: [], joined: '2022-08-10', lastLogin: '2026-05-31 18:00' },
  { id: 'u-10', empNo: 'E1010', name: '郑倩', email: 'zhengqian@company.com', phone: '152****1010', dept: '法务部', manager: '陈雪', position: '法务总监', status: '正常', roles: ['部门管理员', '审计员'], joined: '2021-04-06', lastLogin: '2026-07-17 09:58' }
];

export const roles = [
  { id: 'r-1', name: '企业超级管理员', type: '预设', members: 1, dataScope: '全部数据', desc: '全部权限，不可编辑' },
  { id: 'r-2', name: '企业管理员', type: '预设', members: 2, dataScope: '全部数据', desc: '组织、人员、配额管理' },
  { id: 'r-3', name: 'AI 管理员', type: '预设', members: 3, dataScope: '全部数据', desc: 'Agent、Skill、模型管理' },
  { id: 'r-4', name: '安全管理员', type: '预设', members: 2, dataScope: '全部数据', desc: '审计、权限、MCP 审批' },
  { id: 'r-5', name: '财务管理员', type: '预设', members: 1, dataScope: '全部数据', desc: '账单、配额、成本分析' },
  { id: 'r-6', name: '部门管理员', type: '预设', members: 4, dataScope: '本部门及下级', desc: '本部门人员和资源' },
  { id: 'r-7', name: '开发者', type: '预设', members: 28, dataScope: '本部门', desc: '创建 Agent / Skill' },
  { id: 'r-8', name: '普通用户', type: '预设', members: 1204, dataScope: '本人', desc: '使用 Agent / Skill' },
  { id: 'r-9', name: '受限访客（自定义）', type: '自定义', members: 12, dataScope: '本人', desc: '外包/实习/临时协作：仅指定 Agent，禁止导出与上传' }
];

export const permModules = ['Agent 管理', 'Skill 管理', '知识库', '工作流', '成员管理', '配额管理', '审计日志', '账单管理'];
export const permOps = ['查看', '创建', '编辑', '删除', '审批'];
// 每角色默认矩阵（true=允许）：key = roleId
export const permDefaults = {
  'r-3': { 'Agent 管理': [1, 1, 1, 1, 1], 'Skill 管理': [1, 1, 1, 1, 1], '知识库': [1, 1, 1, 0, 0], '工作流': [1, 1, 1, 1, 0], '成员管理': [1, 0, 0, 0, 0], '配额管理': [1, 0, 0, 0, 0], '审计日志': [1, 0, 0, 0, 0], '账单管理': [0, 0, 0, 0, 0] },
  'r-7': { 'Agent 管理': [1, 1, 1, 0, 0], 'Skill 管理': [1, 1, 1, 0, 0], '知识库': [1, 1, 1, 0, 0], '工作流': [1, 1, 1, 0, 0], '成员管理': [0, 0, 0, 0, 0], '配额管理': [0, 0, 0, 0, 0], '审计日志': [0, 0, 0, 0, 0], '账单管理': [0, 0, 0, 0, 0] },
  default: { 'Agent 管理': [1, 0, 0, 0, 0], 'Skill 管理': [1, 0, 0, 0, 0], '知识库': [1, 0, 0, 0, 0], '工作流': [1, 0, 0, 0, 0], '成员管理': [0, 0, 0, 0, 0], '配额管理': [0, 0, 0, 0, 0], '审计日志': [0, 0, 0, 0, 0], '账单管理': [0, 0, 0, 0, 0] }
};

export const ssoProviders = [
  { name: '企业微信', status: 'connected', desc: '已连接 · 每日 02:00 增量同步部门与人员，离职自动禁用', last: '最近同步 2026-07-17 02:00 · 成功 1,245 人' },
  { name: 'Azure AD (Entra ID)', status: 'off', desc: 'SAML 2.0 / OIDC 单点登录', last: '未配置' },
  { name: 'Okta', status: 'off', desc: 'SAML 2.0 单点登录', last: '未配置' },
  { name: '飞书', status: 'off', desc: '组织架构同步 + SSO', last: '未配置' }
];

export const onlineSessions = [
  { user: '陈雪', device: 'macOS · Chrome 138', ip: '203.119.88.201', loc: '北京', start: '2026-07-17 11:02', current: true },
  { user: '张明', device: 'Windows · Edge 138', ip: '203.119.88.15', loc: '北京', start: '2026-07-17 09:32', current: false },
  { user: '赵强', device: 'macOS · Safari 19', ip: '10.8.3.7', loc: '内网', start: '2026-07-17 10:15', current: false },
  { user: '王芳', device: 'iOS · 企业微信', ip: '117.136.38.90', loc: '上海', start: '2026-07-17 08:47', current: false }
];

export const internalAudit = [
  { time: '2026-07-17 11:02', user: '陈雪', event: '用户登录', detail: 'SSO（企业微信）登录成功', ip: '203.119.88.201', result: '成功' },
  { time: '2026-07-17 10:48', user: '陈雪', event: '角色变更', detail: '为 张明 追加角色「AI 管理员」', ip: '203.119.88.201', result: '成功' },
  { time: '2026-07-17 10:21', user: '未知用户', event: '登录失败', detail: '账号 wugang@company.com 已离职禁用，拒绝登录（连续第 3 次）', ip: '112.10.66.208', result: '失败' },
  { time: '2026-07-17 09:58', user: '郑倩', event: '资源访问', detail: '导出「合同审查专家」调用日志（近 30 天）', ip: '10.8.5.12', result: '成功' },
  { time: '2026-07-16 18:40', user: '系统', event: '配额告警', detail: '客服部 Token 用量达 92%（阈值 90%），已通知 王芳', ip: '-', result: '成功' },
  { time: '2026-07-16 17:55', user: '陈雪', event: '部门调整', detail: '冻结部门「战略投资部」，回收未用配额 20 万 Token', ip: '203.119.88.201', result: '成功' },
  { time: '2026-07-16 16:12', user: '张明', event: '配额调整', detail: '在线客服组 Token 月限额 200 万 → 220 万', ip: '203.119.88.15', result: '成功' },
  { time: '2026-07-16 15:03', user: '刘敏', event: '权限变更', detail: '申请「知识库-删除」权限被拒（超出角色范围）', ip: '117.136.40.11', result: '失败' },
  { time: '2026-07-16 11:30', user: '陈雪', event: '用户创建', detail: '批量导入 12 名外包人员（Excel），分配角色「受限访客」', ip: '203.119.88.201', result: '成功' },
  { time: '2026-07-15 09:20', user: '赵强', event: '安全策略', detail: '开启「敏感操作二次验证（TOTP）」，作用于管理员角色', ip: '10.8.3.7', result: '成功' }
];

// ===== Workflow v1.04 =====
export const wfBlocks = {
  start: { label: '开始', icon: 'circle-dot', c: '#22c55e', cat: 'trigger', desc: '定义工作流输入变量' },
  'trigger-webhook': { label: 'Webhook 触发', icon: 'link', c: '#22c55e', cat: 'trigger', desc: '通过 HTTP 回调触发' },
  'trigger-schedule': { label: '定时触发', icon: 'clock', c: '#22c55e', cat: 'trigger', desc: 'Cron 表达式定时执行' },
  'trigger-plugin': { label: '插件触发', icon: 'plug', c: '#22c55e', cat: 'trigger', desc: '由已安装插件事件触发' },
  llm: { label: 'LLM', icon: 'sparkles', c: '#3b82f6', cat: 'ai', desc: '调用大语言模型' },
  agent: { label: 'Agent', icon: 'bot', c: '#3b82f6', cat: 'ai', desc: '自主规划执行的智能体' },
  'question-classifier': { label: '问题分类器', icon: 'tag', c: '#3b82f6', cat: 'ai', desc: '按类别路由用户问题' },
  'parameter-extractor': { label: '参数提取器', icon: 'braces', c: '#3b82f6', cat: 'ai', desc: '从自然语言提取结构化参数' },
  'if-else': { label: 'IF/ELSE', icon: 'diamond', c: '#eab308', cat: 'logic', desc: '条件分支' },
  iteration: { label: '迭代', icon: 'list', c: '#eab308', cat: 'logic', desc: '对数组逐项执行子流程（容器）' },
  loop: { label: '循环', icon: 'refresh-cw', c: '#eab308', cat: 'logic', desc: '满足条件前重复执行（容器）' },
  'human-input': { label: '人工介入', icon: 'user', c: '#eab308', cat: 'logic', desc: '暂停等待人工确认/输入' },
  code: { label: '代码执行', icon: 'code', c: '#06b6d4', cat: 'data', desc: 'Python / JavaScript 沙箱' },
  'template-transform': { label: '模板转换', icon: 'file-code', c: '#06b6d4', cat: 'data', desc: 'Jinja2 模板渲染' },
  'variable-assigner': { label: '变量赋值', icon: 'variable', c: '#06b6d4', cat: 'data', desc: '写入会话/流程变量' },
  'list-operator': { label: '列表操作', icon: 'list', c: '#06b6d4', cat: 'data', desc: '过滤 / 排序 / 取元素' },
  'document-extractor': { label: '文档提取', icon: 'file-text', c: '#06b6d4', cat: 'data', desc: '从文件提取文本' },
  'http-request': { label: 'HTTP 请求', icon: 'globe', c: '#ec4899', cat: 'integration', desc: '调用外部 API' },
  tool: { label: '工具', icon: 'wrench', c: '#ec4899', cat: 'integration', desc: '调用内置/自定义/MCP 工具' },
  'knowledge-retrieval': { label: '知识检索', icon: 'database', c: '#a855f7', cat: 'integration', desc: '从知识库召回相关分段' },
  'data-source': { label: '数据源', icon: 'server', c: '#ec4899', cat: 'integration', desc: '连接数据库/数据仓库' },
  'knowledge-base': { label: '知识写入', icon: 'upload', c: '#a855f7', cat: 'integration', desc: '将内容写入知识库' },
  end: { label: '结束', icon: 'square', c: '#f97316', cat: 'output', desc: 'Workflow 输出（End）' },
  answer: { label: '回复', icon: 'message-square', c: '#f97316', cat: 'output', desc: 'Chatflow 流式回复（Answer）' },
  note: { label: '便签', icon: 'edit', c: '#64748b', cat: 'special', desc: '画布注释，不参与执行' }
};
export const wfCats = [
  ['trigger', '触发器', ['start', 'trigger-webhook', 'trigger-schedule', 'trigger-plugin']],
  ['ai', 'AI', ['llm', 'agent', 'question-classifier', 'parameter-extractor']],
  ['logic', '逻辑控制', ['if-else', 'iteration', 'loop', 'human-input']],
  ['data', '数据处理', ['code', 'template-transform', 'variable-assigner', 'list-operator', 'document-extractor']],
  ['integration', '集成', ['http-request', 'tool', 'knowledge-retrieval', 'data-source', 'knowledge-base']],
  ['output', '输出', ['end', 'answer']],
  ['special', '特殊', ['note']]
];

export const wfVersions = [
  { ver: '当前草稿', time: '2026-07-17 11:20', author: '你', tag: 'draft' },
  { ver: 'v12', time: '2026-05-04 00:17', author: 'PERRY', tag: 'published' },
  { ver: 'v11', time: '2026-05-03 22:40', author: 'PERRY', tag: '' },
  { ver: 'v10', time: '2026-05-01 16:08', author: 'Alice', tag: '' },
  { ver: 'v9', time: '2026-04-28 10:33', author: 'PERRY', tag: '' }
];
export const wfEnvVars = [
  { name: 'API_BASE_URL', type: 'string', secret: false, value: 'https://api.pinqi.cn/v1' },
  { name: 'GITHUB_TOKEN', type: 'secret', secret: true, value: 'ghp_************3f8a' },
  { name: 'MAX_RETRY', type: 'number', secret: false, value: '3' }
];
export const wfConvVars = [
  { name: 'user_intent', type: 'string', def: '""', desc: '最近一次识别的用户意图', refs: 3 },
  { name: 'order_no', type: 'string', def: '""', desc: '会话中提取的订单号', refs: 2 },
  { name: 'retry_count', type: 'number', def: '0', desc: '澄清追问次数', refs: 1 }
];
export const wfSysVars = [
  { name: 'sys.query', type: 'string', desc: '用户最新输入' },
  { name: 'sys.files', type: 'array[file]', desc: '用户上传的文件' },
  { name: 'sys.user_id', type: 'string', desc: '用户唯一标识' },
  { name: 'sys.conversation_id', type: 'string', desc: '会话 ID（Chatflow）' },
  { name: 'sys.dialogue_count', type: 'number', desc: '对话轮次（Chatflow）' },
  { name: 'sys.timestamp', type: 'number', desc: '触发时间戳' }
];
export const wfRunOk = {
  status: 'succeeded', elapsed: '3.42s', tokens: 2841, cost: '¥0.0312', started: '2026-07-17 11:24:05',
  input: '{ "query": "昨天 Github Trending 前 5 名" }',
  output: '{ "report": "## Github 热榜日报（07-16）\\n1. deepseek-ai/Janus — 14.2k ★ …" }',
  steps: [
    { node: '开始', type: 'start', status: 'succeeded', ms: 2, tokens: 0, detail: '输入变量校验通过' },
    { node: 'HTTP 请求', type: 'http-request', status: 'succeeded', ms: 486, tokens: 0, detail: 'GET https://api.github.com/trending → 200，重试 0/3' },
    { node: '列表操作', type: 'list-operator', status: 'succeeded', ms: 4, tokens: 0, detail: '取 Top 5，按 stars 降序' },
    { node: '迭代 ×5', type: 'iteration', status: 'succeeded', ms: 1730, tokens: 1968, detail: '5/5 项成功 · 并行度 3 · 子节点：LLM 摘要', sub: ['第 1 项 · 342ms · 402 tok ✓', '第 2 项 · 371ms · 396 tok ✓', '第 3 项 · 355ms · 388 tok ✓', '第 4 项 · 348ms · 391 tok ✓', '第 5 项 · 314ms · 391 tok ✓'] },
    { node: 'LLM 汇总', type: 'llm', status: 'succeeded', ms: 1140, tokens: 873, detail: 'GPT-4-Turbo · temp 0.3 · 输出 812 字' },
    { node: '模板转换', type: 'template-transform', status: 'succeeded', ms: 6, tokens: 0, detail: 'Markdown 日报模板渲染' },
    { node: '结束', type: 'end', status: 'succeeded', ms: 1, tokens: 0, detail: '输出 report (string)' }
  ]
};
export const wfRunFail = {
  status: 'failed', elapsed: '10.87s', tokens: 402, cost: '¥0.0044', started: '2026-07-17 10:02:41',
  input: '{ "query": "昨日热榜" }',
  output: 'HTTPError: 503 Service Unavailable（已重试 3 次，间隔 1000ms）',
  steps: [
    { node: '开始', type: 'start', status: 'succeeded', ms: 2, tokens: 0, detail: '输入变量校验通过' },
    { node: 'HTTP 请求', type: 'http-request', status: 'failed', ms: 10462, tokens: 0, detail: '503 × 4 次（重试 3/3 已用尽）· 错误处理：无 → 流程中断' },
    { node: '列表操作', type: 'list-operator', status: 'skipped', ms: 0, tokens: 0, detail: '未执行' }
  ]
};
export const wfChecklist = [
  { label: '所有节点均已连接', ok: true },
  { label: 'LLM 节点已配置模型与提示词', ok: true },
  { label: 'End 节点已声明输出变量', ok: true },
  { label: 'HTTP 请求缺少失败分支（建议配置错误处理）', ok: false },
  { label: '插件依赖：serpapi ≥ 1.2 已安装', ok: true }
];
export const wfChatPreview = [
  { role: 'user', content: '帮我查一下订单 ORD-2026-0715 到哪了', time: '11:26:01' },
  { role: 'flow', content: '问题分类器 → 订单查询分支 · 参数提取器 → order_no = "ORD-2026-0715"', time: '11:26:02' },
  { role: 'assistant', content: '您的订单 ORD-2026-0715 正在配送中 🚚\n当前位置：杭州转运中心\n预计送达：明天 12:00 前\n\n对话变量已更新：conversation.order_no = ORD-2026-0715', time: '11:26:03' }
];

// ===== 运营看板 =====
export const saasKpis = { mrr: 6810, mrrDelta: '+18.2%', activeTenants: 6, tenantsDelta: '+1', tokens30d: '24.1M', tokensDelta: '+11.4%', arpu: 1362, overdueSum: 2910 };
export const mrrTrend = [
  { m: '2025-08', v: 2400 }, { m: '09', v: 2870 }, { m: '10', v: 3120 }, { m: '11', v: 3660 },
  { m: '12', v: 4020 }, { m: '2026-01', v: 4480 }, { m: '02', v: 4890 }, { m: '03', v: 5340 },
  { m: '04', v: 5760 }, { m: '05', v: 6120 }, { m: '06', v: 6440 }, { m: '07', v: 6810 }
];
export const tenantGrowth = [
  { m: '02', add: 1, churn: 0 }, { m: '03', add: 2, churn: 0 }, { m: '04', add: 0, churn: 0 },
  { m: '05', add: 1, churn: 1 }, { m: '06', add: 1, churn: 0 }, { m: '07', add: 1, churn: 0 }
];
export const modelCost = [
  { model: 'GPT-4-Turbo', cost: 3420, pct: 50 },
  { model: 'Claude-3-Opus', cost: 1580, pct: 23 },
  { model: 'Qwen-Max', cost: 890, pct: 13 },
  { model: 'GPT-4o', cost: 620, pct: 9 },
  { model: '其他', cost: 300, pct: 5 }
];
export const opsAlerts = [
  { level: 'high', title: '智慧零售有限公司 · 连续 2 期逾期', detail: '逾期 ¥1,230 + 未付 ¥1,230，已发 2 次催缴，建议触发限流', time: '今天 09:00' },
  { level: 'high', title: '云帆物流 · Token 超配额 8%', detail: '本月已用 5.40M / 5.00M，超量部分按 1.5 倍计费中', time: '今天 08:30' },
  { level: 'mid', title: '华润三九医药 · 目录全量同步待校验', detail: 'SSO（企业微信）已接入，已导入 2,134 名员工，待校验部门映射', time: '07-10' },
  { level: 'mid', title: '创新金融集团 · 服务将于 45 天后到期', detail: '2026-08-01 到期，续约商机已同步销售', time: '06-17' }
];

// ===== Key 管理 =====
export const apiKeys = [
  { id: 'k-1', name: '生产环境主 Key', key: 'ap_sk_live_9f3c************8a21', scope: '全部权限', tenant: '品器资产', status: 'active', created: '2024-01-15', lastUsed: '2026-07-17 11:20', calls: 1284500, rate: '200 QPS' },
  { id: 'k-2', name: '企微机器人', key: 'ap_sk_live_77b0************c4d9', scope: 'Agent 调用', tenant: '品器资产', status: 'active', created: '2024-03-02', lastUsed: '2026-07-17 10:58', calls: 486200, rate: '50 QPS' },
  { id: 'k-3', name: 'BI 只读报表', key: 'ap_sk_live_31ae************77f2', scope: '只读（用量/账单）', tenant: '品器资产', status: 'active', created: '2025-06-18', lastUsed: '2026-07-16 23:00', calls: 8921, rate: '10 QPS' },
  { id: 'k-4', name: '旧版集成（已吊销）', key: 'ap_sk_live_c2d4************11a0', scope: '全部权限', tenant: '品器资产', status: 'revoked', created: '2023-09-01', lastUsed: '2026-02-11 08:12', calls: 2210040, rate: '100 QPS' },
  { id: 'k-5', name: '压测临时 Key', key: 'ap_sk_test_58e1************90bc', scope: 'Agent 调用（沙箱）', tenant: '品器资产', status: 'expired', created: '2026-05-01', lastUsed: '2026-05-08 19:45', calls: 50000, rate: '500 QPS' }
];

// ===== 平台账单（跨租户） =====
export const platformRevenue = { month: 6810, ytd: 41230, unpaid: 5020, overdue: 1230 };
export const overdueAging = [
  { bucket: '未逾期（账期内）', amount: 3790 },
  { bucket: '逾期 1-30 天', amount: 1230 },
  { bucket: '逾期 31-60 天', amount: 0 },
  { bucket: '逾期 60 天以上', amount: 0 }
];

// ===== 知识库问答 =====
export const qaHistory = [
  { q: '公司的年假政策是怎样的？', kb: '员工手册', time: '2026-07-17 10:12' },
  { q: '差旅报销需要哪些票据？', kb: '员工手册', time: '2026-07-16 16:40' },
  { q: '智能音箱 X3 支持哪些协议？', kb: '产品文档库', time: '2026-07-16 09:21' }
];
export const qaSamples = {
  '公司的年假政策是怎样的？': {
    answer: '根据《员工手册 v2.0》第 4.2 节：工龄 1-5 年享有 5 天年假；5-10 年 10 天；10 年以上 15 天。年假需提前 3 个工作日在 OA 申请，可分次使用（每次不少于半天），当年未休完可顺延至次年第一季度。',
    latency: '1.24s', model: 'GPT-4-Turbo', mode: '混合检索',
    chunks: [
      { doc: '员工手册 v2.0.pdf', section: '4.2 年假', score: 0.94, text: '员工年假按工龄核定：入职满 1 年不满 5 年者 5 天；满 5 年不满 10 年者 10 天；满 10 年者 15 天……' },
      { doc: '员工手册 v2.0.pdf', section: '4.3 请假流程', score: 0.81, text: '年假申请须提前 3 个工作日提交 OA 审批，由直属上级与 HRBP 会签……' },
      { doc: '福利政策.md', section: '带薪假期', score: 0.72, text: '除法定节假日外，公司提供带薪年假、司龄假与生日假。年假未休部分可顺延至次年 3 月 31 日前……' }
    ]
  },
  '差旅报销需要哪些票据？': {
    answer: '差旅报销需提供：① 交通票据（机票行程单/火车票）；② 住宿增值税专用发票（抬头为公司全称）；③ 补贴无需票据、按出差天数计发。所有票据须在返程后 10 个工作日内提交财务共享中心。',
    latency: '1.08s', model: 'GPT-4-Turbo', mode: '混合检索',
    chunks: [
      { doc: '员工手册 v2.0.pdf', section: '6.1 差旅报销', score: 0.91, text: '报销材料包括交通票据、住宿发票（增值税专用发票，抬头：北京品器资产管理有限公司）……' },
      { doc: '财务制度汇编.docx', section: '报销时效', score: 0.78, text: '出差人员应在行程结束后 10 个工作日内完成报销单提交，逾期需部门负责人特批……' }
    ]
  },
  default: {
    answer: '根据知识库检索结果，未找到与该问题直接相关的条目。建议：① 换用更具体的关键词；② 确认所选知识库是否包含该主题文档；③ 若文档缺失，可在「知识库管理」上传后重新索引。',
    latency: '0.86s', model: 'GPT-4-Turbo', mode: '混合检索',
    chunks: [
      { doc: '（无高相关分段）', section: '-', score: 0.31, text: '最高相关性低于阈值 0.60，已按规则不注入上下文，避免幻觉。' }
    ]
  }
};
