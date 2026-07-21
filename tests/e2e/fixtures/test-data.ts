/**
 * AIPaddle E2E 测试数据
 * 依据：PRD_Core_v1.04 各模块数据模型与用户流程
 * 约定（2026-07-19 用户拍板反转）：**seed 脚本（`supabase/seed.ts`）是租户与账号的权威来源**，
 *   本文件的 TENANTS / USERS / BAD_CREDENTIALS 必须与 seed 实际创建的两租户五账号保持一致。
 *   seed 密码从环境变量 `SEED_PASSWORD` 读取（勿硬编码进 git，仓库公开后的安全铁律）；
 *   本地放 `.env.local`、CI 放 Secret，由 playwright.config 加载；账号为 Supabase Auth 已确认邮箱，不发真实邮件。
 *   其余为功能尚未落库的测试夹具（Agent/Skill/Workflow/租户开通/成员邀请），用 @aipaddle-test.local 占位。
 */

// ─── 租户（与 seed 一致：aipaddle-demo / acme-corp）────────────
export const TENANTS = {
  orgA: { name: 'AIPaddle Demo', code: 'aipaddle-demo', plan: 'pro' },
  orgB: { name: 'Acme Corp',     code: 'acme-corp',     plan: 'standard' },
} as const;

// ─── 账号与角色（与 seed 一致；PRD 2.8：Admin/Developer/User/Auditor）────────
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? '';
export const USERS = {
  adminA:   { email: 'admin-demo@aipaddle.dev', password: SEED_PASSWORD, name: 'Demo 管理员', role: 'Admin',     org: 'orgA' },
  devA:     { email: 'dev@aipaddle.dev',        password: SEED_PASSWORD, name: 'Demo 开发者', role: 'Developer', org: 'orgA' },
  userA:    { email: 'user@aipaddle.dev',       password: SEED_PASSWORD, name: 'Demo 用户',   role: 'User',      org: 'orgA' },
  auditorA: { email: 'auditor@aipaddle.dev',    password: SEED_PASSWORD, name: 'Demo 审计员', role: 'Auditor',   org: 'orgA' },
  adminB:   { email: 'admin-acme@acme.dev',     password: SEED_PASSWORD, name: 'Acme 管理员', role: 'Admin',     org: 'orgB' },
} as const;

export const BAD_CREDENTIALS = [
  { email: 'admin-demo@aipaddle.dev', password: 'wrong-password', expect: '密码错误' },
  { email: 'nobody@aipaddle.dev',     password: SEED_PASSWORD,    expect: '账号不存在或密码错误' },
  { email: 'not-an-email',            password: 'x',              expect: '邮箱格式' },
] as const;

// ─── Agent（PRD 2.2.1 数据模型 + 4.1 流程）────────────────────
export const AGENTS = {
  valid: [
    { name: '客服问答助手',  description: '基于产品手册回答客户咨询', department: '市场部', scenarios: ['web', 'wecom'] },
    { name: '合同审查员',    description: '审查采购合同的风险条款',   department: '合规部', scenarios: ['api'] },
    { name: '数据分析师',    description: '解读销售周报并生成摘要',   department: '研发部', scenarios: ['web', 'api', 'local-cc'] },
  ],
  invalid: [
    { name: '',                          department: '市场部', expectError: '名称不能为空' },
    { name: 'A'.repeat(101),             department: '市场部', expectError: '名称过长' },
    { name: '非法场景测试', department: '市场部', scenarios: ['telegram'], expectError: '不支持的使用场景' },
  ],
} as const;

/** 状态机矩阵（PRD 2.2.1：draft/pending/published/offline）*/
export const AGENT_STATE_MATRIX = {
  legal: [
    { from: 'draft',     to: 'pending',   action: '提交审核' },
    { from: 'pending',   to: 'published', action: '审核通过', actor: 'Admin' },
    { from: 'pending',   to: 'draft',     action: '审核驳回', actor: 'Admin' },
    { from: 'published', to: 'offline',   action: '下线' },
    { from: 'offline',   to: 'pending',   action: '重新上线（再审）' },
  ],
  illegal: [
    { from: 'draft',     to: 'published', reason: '跳过审核' },
    { from: 'draft',     to: 'offline',   reason: '未发布不可下线' },
    { from: 'pending',   to: 'offline',   reason: '审核中不可下线' },
    { from: 'published', to: 'draft',     reason: '需先下线' },
    { from: 'published', to: 'pending',   reason: '需先下线' },
    { from: 'offline',   to: 'draft',     reason: '不支持回退草稿' },
  ],
} as const;

/** 角色 × 操作权限矩阵（PRD 2.8）：allow = 期待成功；deny = 期待 403 */
export const ROLE_MATRIX = [
  { role: 'Admin',     action: 'agent:create', allow: true },
  { role: 'Admin',     action: 'agent:review', allow: true },
  { role: 'Admin',     action: 'member:manage', allow: true },
  { role: 'Developer', action: 'agent:create', allow: true },
  { role: 'Developer', action: 'agent:review', allow: false },
  { role: 'Developer', action: 'member:manage', allow: false },
  { role: 'User',      action: 'agent:create', allow: false },
  { role: 'User',      action: 'agent:chat',   allow: true },
  { role: 'Auditor',   action: 'agent:review', allow: true },
  { role: 'Auditor',   action: 'agent:create', allow: false },
  { role: 'Auditor',   action: 'audit:read',   allow: true },
] as const;

// ─── 知识库（PRD 2.4）与 RAG 金标准 ───────────────────────────
/** 固定语料：切片 2 用脚本生成这 3 份 PDF 放 tests/fixtures/docs/ */
export const KNOWLEDGE_DOCS = [
  { file: 'product-manual.pdf', kb: '产品知识库', title: 'AIPaddle 智能路由器 X1 产品手册', facts: ['X1 支持 Wi-Fi 7', '保修期为 3 年', '最大接入设备数 128 台', '客服热线 400-800-1234'] },
  { file: 'price-table.pdf',    kb: '产品知识库', title: '2026 价格表', facts: ['X1 标准版定价 599 元', 'X1 Pro 定价 899 元', '企业批采 50 台起享 8 折'] },
  { file: 'hr-policy.pdf',      kb: '制度知识库', title: '员工休假制度', facts: ['年假 10 天起', '病假需 48 小时内提交证明', '婚假 3 天'] },
] as const;

/** 金标准问答集样例（完整 20+ 条在 tests/fixtures/golden-set.json，按此格式扩充）*/
export const GOLDEN_SET_SAMPLE = [
  { q: 'X1 路由器支持什么无线协议？', expectPoints: ['Wi-Fi 7'], source: 'product-manual.pdf', type: 'fact' },
  { q: 'X1 的保修期多久？',           expectPoints: ['3 年'], source: 'product-manual.pdf', type: 'fact' },
  { q: 'X1 标准版和 Pro 版分别多少钱？', expectPoints: ['599', '899'], source: 'price-table.pdf', type: 'fact' },
  { q: '公司买 60 台 X1 能打折吗？',   expectPoints: ['8 折', '50 台起'], source: 'price-table.pdf', type: 'synthesis' },
  { q: '新员工年假有几天？',           expectPoints: ['10 天'], source: 'hr-policy.pdf', type: 'fact' },
  { q: '病假报销流程是什么？',         expectPoints: ['未找到'], source: null, type: 'refusal' }, // 语料无此信息，必须拒答
  { q: 'X1 能接多少台设备，够 100 人办公室用吗？', expectPoints: ['128 台'], source: 'product-manual.pdf', type: 'synthesis' },
  { q: '竞品华硕路由器怎么样？',       expectPoints: ['未找到'], source: null, type: 'refusal' },
] as const;

export const UPLOAD_REJECTS = [
  { file: 'malware.exe',    reason: '不支持的格式' },
  { file: 'huge-60mb.pdf',  reason: '超出大小限制' },
  { file: 'corrupted.pdf',  reason: '解析失败' },
] as const;

// ─── Skill（PRD 2.3：五种类型）────────────────────────────────
export const SKILLS = [
  { name: '企业通讯录查询', type: 'MCP',      riskLevel: 'medium', description: '通过 MCP 查询企业通讯录' },
  { name: '天气查询',       type: 'API',      riskLevel: 'low',    description: '调用天气 API' },
  { name: '销售数据查询',   type: 'DB',       riskLevel: 'high',   description: '只读查询销售库' },
  { name: '报告生成流程',   type: 'Workflow', riskLevel: 'medium', description: '调用报告生成工作流' },
  { name: '邮件润色模板',   type: 'Prompt',   riskLevel: 'low',    description: '商务邮件润色 Prompt' },
] as const;

// ─── Workflow（PRD 2.5：最小执行引擎目标）─────────────────────
export const WORKFLOWS = {
  minimal: {
    name: '文档摘要流',
    nodes: [
      { type: 'start', title: '开始' },
      { type: 'llm',   title: '生成摘要', prompt: '请把输入文本总结为 3 句话' },
      { type: 'end',   title: '结束' },
    ],
    testInput: 'AIPaddle 是企业级 AI 运营管理平台，支持 Agent、Skill、知识库与工作流的统一管理，提供多租户与安全审计能力。',
    expectOutputContains: ['AIPaddle'],
  },
  invalidGraphs: [
    { name: '无开始节点', nodes: ['llm', 'end'],            expectError: '缺少开始节点' },
    { name: '孤立节点',   nodes: ['start', 'llm(未连线)', 'end'], expectError: '存在未连接节点' },
    { name: '成环',       nodes: ['start', 'llm→llm(自环)', 'end'], expectError: '不允许循环连接' },
  ],
} as const;

// ─── 租户开通（PRD 2.9.8 四区块表单）──────────────────────────
export const TENANT_ONBOARDING = {
  valid: {
    basic:   { name: '新奇点智能有限公司', code: 'XQD-AI', shortName: '新奇点', industry: '零售', size: '小型', country: '中国', timezone: 'Asia/Shanghai' },
    contact: { name: '周新', position: 'CTO', email: 'zhou.xin@aipaddle-test.local', phone: '13800138000' },
    plan:    { type: '标准版', billing: '按量付费', tokenQuota: 1_000_000, warningThreshold: 0.8, qpsLimit: 10, storageQuotaGB: 20 },
    advanced:{ mcpEnabled: false, isolation: '逻辑隔离', notes: 'E2E 测试租户' },
  },
  invalid: [
    { field: 'code',  value: 'aipaddle-demo', expectError: '编码已存在' },  // 与 orgA 冲突
    { field: 'email', value: 'not-email', expectError: '邮箱格式' },
    { field: 'tokenQuota', value: -1,     expectError: '配额必须为正数' },
  ],
} as const;

// ─── 成员管理（PRD 2.8/2.10）──────────────────────────────────
export const MEMBER_INVITES = [
  { email: 'new.dev@aipaddle-test.local',  name: '吴新人', role: 'Developer', department: '研发部' },
  { email: 'new.user@aipaddle-test.local', name: '郑试用', role: 'User',      department: '市场部' },
] as const;
