// AIPaddle mock data — 复刻 lib/mock-data.ts + PRD v1.03/1.04 租户多级页面测试数据
export const agents = [
  { id: 'agent-001', name: '智能客服助手', description: '处理客户咨询、投诉和售后问题，支持多轮对话和工单创建', department: '客服部', status: 'published', calls: 15680, successRate: 96.5, tokenUsage: 2450000, createdAt: '2024-01-15', model: 'GPT-4-Turbo', avatar: '🤖' },
  { id: 'agent-002', name: 'HR政策顾问', description: '解答员工关于公司政策、福利、请假等人事问题', department: '人力资源部', status: 'published', calls: 8920, successRate: 94.2, tokenUsage: 1280000, createdAt: '2024-02-01', model: 'Claude-3-Opus', avatar: '👥' },
  { id: 'agent-003', name: '财务报销助手', description: '协助员工完成报销流程，审核发票，生成报销单', department: '财务部', status: 'published', calls: 5430, successRate: 98.1, tokenUsage: 890000, createdAt: '2024-02-15', model: 'GPT-4-Turbo', avatar: '💰' },
  { id: 'agent-004', name: '技术支持工程师', description: 'IT技术问题诊断、故障排查和解决方案推荐', department: 'IT部', status: 'pending', calls: 3210, successRate: 91.8, tokenUsage: 560000, createdAt: '2024-03-01', model: 'GPT-4-Turbo', avatar: '🔧' },
  { id: 'agent-005', name: '销售线索助手', description: '分析销售线索、生成客户画像、推荐跟进策略', department: '销售部', status: 'draft', calls: 0, successRate: 0, tokenUsage: 0, createdAt: '2024-03-10', model: 'Claude-3-Sonnet', avatar: '📈' },
  { id: 'agent-006', name: '合同审查专家', description: '自动审查合同条款、识别风险点、提供修改建议', department: '法务部', status: 'published', calls: 2890, successRate: 97.3, tokenUsage: 1120000, createdAt: '2024-01-20', model: 'GPT-4-Turbo', avatar: '📋' }
];

export const skills = [
  { id: 'skill-001', name: 'CRM客户查询', type: 'API', description: '通过API查询CRM系统中的客户信息', installs: 156, calls: 45600, version: '2.1.0', publisher: '系统管理员', riskLevel: 'low', status: 'published' },
  { id: 'skill-002', name: 'ERP库存查询', type: 'DB', description: '直接查询ERP数据库获取库存信息', installs: 89, calls: 23400, version: '1.5.2', publisher: 'IT部', riskLevel: 'medium', status: 'published' },
  { id: 'skill-003', name: '邮件发送服务', type: 'MCP', description: '通过MCP协议发送企业邮件', installs: 234, calls: 78900, version: '3.0.1', publisher: '系统管理员', riskLevel: 'low', status: 'published' },
  { id: 'skill-004', name: '报销单生成', type: 'Workflow', description: '自动生成报销单并提交审批流程', installs: 67, calls: 12300, version: '1.2.0', publisher: '财务部', riskLevel: 'medium', status: 'published' },
  { id: 'skill-005', name: '敏感信息检测', type: 'Prompt', description: '检测用户输入中的敏感信息', installs: 312, calls: 156000, version: '2.0.0', publisher: '安全部', riskLevel: 'low', status: 'published' },
  { id: 'skill-006', name: 'HR系统接口', type: 'API', description: '查询员工信息、请假记录等HR数据', installs: 145, calls: 34500, version: '1.8.0', publisher: '人力资源部', riskLevel: 'high', status: 'pending' },
  { id: 'skill-007', name: '财务数据库查询', type: 'DB', description: '查询财务系统数据库', installs: 23, calls: 8900, version: '1.0.0', publisher: '财务部', riskLevel: 'high', status: 'pending' },
  { id: 'skill-008', name: '文档解析器', type: 'MCP', description: '解析PDF、Word等文档内容', installs: 189, calls: 45600, version: '2.3.0', publisher: '系统管理员', riskLevel: 'low', status: 'published' }
];

export const knowledgeBases = [
  { id: 'kb-001', name: '员工手册', description: '公司规章制度、福利政策、行为准则等', documents: 45, vectorStatus: 'completed', lastUpdated: '2024-03-01', size: '12.5 MB' },
  { id: 'kb-002', name: '产品文档库', description: '产品说明书、技术规格、使用指南', documents: 128, vectorStatus: 'completed', lastUpdated: '2024-03-08', size: '89.2 MB' },
  { id: 'kb-003', name: '客服FAQ', description: '常见问题解答、故障排查指南', documents: 234, vectorStatus: 'completed', lastUpdated: '2024-03-10', size: '23.1 MB' },
  { id: 'kb-004', name: '技术架构文档', description: '系统架构、API文档、开发规范', documents: 67, vectorStatus: 'processing', lastUpdated: '2024-03-12', size: '45.8 MB' },
  { id: 'kb-005', name: '销售培训资料', description: '销售话术、客户案例、行业分析', documents: 89, vectorStatus: 'completed', lastUpdated: '2024-02-28', size: '34.6 MB' }
];

export const securityReviews = [
  { id: 'review-001', resourceType: 'skill', resourceName: 'HR系统接口', submitter: '张明', riskLevel: 'high', sensitiveDataFound: ['员工身份证号', '银行账户信息', '薪资数据'], illegalInstructions: [], dbRisks: ['SELECT * 查询可能导致数据泄露'], status: 'pending', submittedAt: '2024-03-12 10:30' },
  { id: 'review-002', resourceType: 'skill', resourceName: '财务数据库查询', submitter: '李华', riskLevel: 'high', sensitiveDataFound: ['财务报表', '交易记录'], illegalInstructions: ['可能执行DELETE操作'], dbRisks: ['未限制查询范围', '缺少字段白名单'], status: 'pending', submittedAt: '2024-03-12 11:15' },
  { id: 'review-003', resourceType: 'agent', resourceName: '技术支持工程师', submitter: '王芳', riskLevel: 'medium', sensitiveDataFound: [], illegalInstructions: [], dbRisks: ['调用了高风险Skill: ERP库存查询'], status: 'pending', submittedAt: '2024-03-12 09:00' },
  { id: 'review-004', resourceType: 'workflow', resourceName: '合同审批流程', submitter: '赵强', riskLevel: 'low', sensitiveDataFound: [], illegalInstructions: [], dbRisks: [], status: 'approved', submittedAt: '2024-03-11 14:00' }
];

export const usageMetrics = [
  { date: '03/01', agentCalls: 4520, tokenUsage: 890000, cost: 45.6, activeUsers: 234 },
  { date: '03/02', agentCalls: 4890, tokenUsage: 920000, cost: 48.2, activeUsers: 256 },
  { date: '03/03', agentCalls: 3210, tokenUsage: 650000, cost: 32.5, activeUsers: 189 },
  { date: '03/04', agentCalls: 5120, tokenUsage: 1020000, cost: 52.1, activeUsers: 278 },
  { date: '03/05', agentCalls: 5890, tokenUsage: 1180000, cost: 58.9, activeUsers: 312 },
  { date: '03/06', agentCalls: 6230, tokenUsage: 1250000, cost: 62.5, activeUsers: 345 },
  { date: '03/07', agentCalls: 5670, tokenUsage: 1130000, cost: 56.5, activeUsers: 298 },
  { date: '03/08', agentCalls: 4980, tokenUsage: 990000, cost: 49.5, activeUsers: 267 },
  { date: '03/09', agentCalls: 3450, tokenUsage: 680000, cost: 34.2, activeUsers: 178 },
  { date: '03/10', agentCalls: 2890, tokenUsage: 570000, cost: 28.5, activeUsers: 145 },
  { date: '03/11', agentCalls: 5430, tokenUsage: 1080000, cost: 54.3, activeUsers: 289 },
  { date: '03/12', agentCalls: 6780, tokenUsage: 1350000, cost: 67.8, activeUsers: 367 }
];

export const members = [
  { id: 'user-001', name: '张明', email: 'zhangming@company.com', department: 'IT部', role: 'ai_engineer', status: 'active', lastLogin: '2024-03-12 16:30' },
  { id: 'user-002', name: '李华', email: 'lihua@company.com', department: '财务部', role: 'employee', status: 'active', lastLogin: '2024-03-12 15:45' },
  { id: 'user-003', name: '王芳', email: 'wangfang@company.com', department: '客服部', role: 'employee', status: 'active', lastLogin: '2024-03-12 14:20' },
  { id: 'user-004', name: '赵强', email: 'zhaoqiang@company.com', department: '安全部', role: 'security', status: 'active', lastLogin: '2024-03-12 16:00' },
  { id: 'user-005', name: '陈雪', email: 'chenxue@company.com', department: '人力资源部', role: 'admin', status: 'active', lastLogin: '2024-03-12 10:30' },
  { id: 'user-006', name: '刘洋', email: 'liuyang@company.com', department: '销售部', role: 'employee', status: 'active', lastLogin: '2024-03-11 18:00' },
  { id: 'user-007', name: '周明', email: 'zhouming@company.com', department: 'IT部', role: 'ai_engineer', status: 'disabled', lastLogin: '2024-02-28 09:00' }
];

export const dashboardStats = {
  totalAgents: 6, publishedAgents: 4, totalSkills: 8, publishedSkills: 6,
  totalCalls: 52840, todayCalls: 6780, totalTokens: 8450000, todayTokens: 1350000,
  totalCost: 590.6, todayCost: 67.8, activeUsers: 367, totalUsers: 1245,
  successRate: 95.8, riskBlocked: 23, pendingReviews: 3,
  topAgents: [
    { name: '智能客服助手', calls: 15680 }, { name: 'HR政策顾问', calls: 8920 },
    { name: '财务报销助手', calls: 5430 }, { name: '技术支持工程师', calls: 3210 },
    { name: '合同审查专家', calls: 2890 }
  ],
  topSkills: [
    { name: '敏感信息检测', calls: 156000 }, { name: '邮件发送服务', calls: 78900 },
    { name: 'CRM客户查询', calls: 45600 }, { name: '文档解析器', calls: 45600 },
    { name: 'HR系统接口', calls: 34500 }
  ]
};

export const conversations = [
  {
    id: 'conv-001', agentId: 'agent-001', agentName: '智能客服助手', timestamp: '2024-03-12 14:30',
    messages: [
      { role: 'user', content: '我想查询订单 ORD-2024-0312 的物流状态', timestamp: '14:30:15' },
      { role: 'assistant', content: '好的，我帮您查询一下订单 ORD-2024-0312 的物流信息。\n\n📦 订单状态: 配送中\n🚚 快递公司: 顺丰速运\n📍 当前位置: 上海市浦东新区配送站\n⏰ 预计送达: 今天 18:00 前\n\n您还有其他问题需要咨询吗？', timestamp: '14:30:18' },
      { role: 'user', content: '可以改地址吗？', timestamp: '14:30:45' },
      { role: 'assistant', content: '抱歉，订单已经在配送途中，暂时无法修改收货地址。\n\n建议方案:\n1. 联系快递员协商派送时间\n2. 选择代收点自取\n3. 如果无法签收，快递将会返回配送站，您可以重新预约派送\n\n需要我帮您联系快递员吗？', timestamp: '14:30:50' }
    ]
  },
  {
    id: 'conv-002', agentId: 'agent-002', agentName: 'HR政策顾问', timestamp: '2024-03-12 10:15',
    messages: [
      { role: 'user', content: '公司的年假政策是怎样的？', timestamp: '10:15:00' },
      { role: 'assistant', content: '根据公司《员工手册》的规定，年假政策如下：\n\n📋 年假天数:\n- 工龄 1-5 年：5 天\n- 工龄 5-10 年：10 天\n- 工龄 10 年以上：15 天\n\n📅 使用规则:\n- 年假需提前 3 个工作日申请\n- 可分次使用，每次不少于半天\n- 当年未休完可顺延至次年第一季度\n\n您目前的工龄是多少年呢？我可以帮您计算具体的年假天数。', timestamp: '10:15:05' }
    ]
  }
];

export const workflowApps = [
  { id: '1', name: 'Github热榜日报', description: '自动抓取Github热榜并生成每日报告', type: 'workflow', tags: ['自动化', '日报'], lastEditedBy: 'PERRY', lastEditedAt: '2026/05/04 00:17', status: 'published', executions: 1234, successRate: 98.5 },
  { id: '2', name: '代码转换器', description: '提供多种代码语言转换能力，将用户输入的代码转换成他们需要的代码语言', type: 'workflow', tags: ['代码', '转换'], lastEditedBy: 'PERRY', lastEditedAt: '2026/05/03 23:57', status: 'published', executions: 567, successRate: 95.2 },
  { id: '3', name: '每日行业分析报告', description: '关于家居行业的分析', type: 'text-generation', tags: ['分析', '报告'], lastEditedBy: 'PERRY', lastEditedAt: '2026/04/29 22:15', status: 'published', executions: 89, successRate: 100 },
  { id: '4', name: '智能客服助手', description: '处理用户咨询和问题解答的智能对话流程', type: 'chatflow', tags: ['客服', '对话'], lastEditedBy: 'Alice', lastEditedAt: '2026/05/02 14:30', status: 'published', executions: 3456, successRate: 97.8 },
  { id: '5', name: '数据分析 Agent', description: '自主完成数据分析任务的智能 Agent', type: 'agent', tags: ['数据', 'Agent'], lastEditedBy: 'Bob', lastEditedAt: '2026/05/01 10:20', status: 'draft', executions: 0, successRate: 0 }
];

// ===== 租户管理 v1.03 多级页面测试数据 =====
export const tenants = [
  {
    id: 't-001', name: '北京品器资产管理有限公司', shortName: '品器资产', code: 'TENANT_20240115_0001',
    industry: '金融', size: '1000人以上', country: '中国', region: '北京 · 海淀区', timezone: 'UTC+8 (北京时间)',
    adminEmail: 'admin@pinqi.cn', contactName: '陈雪', contactPosition: '技术负责人', contactPhone: '+86 138 0013 8000', backupEmail: 'ops@pinqi.cn',
    package: 'enterprise', billingMode: '包年', status: 'active',
    members: 1245, agents: 6, tokenUsage: 8450000, tokenQuota: 10000000, quotaWarn: 80,
    qps: 200, qpsPeak: 173, storageUsed: 68.5, storageQuota: 100, monthlyBill: 2890,
    totalSpend: 28560, unpaid: 2890, overdue: 0,
    createdAt: '2024-01-15', serviceStart: '2024-01-15', serviceEnd: '2027-01-14',
    mcpEnabled: true, isolation: '物理隔离', notes: '重点客户，续约窗口 2026 Q4，商务对接：王铭'
  },
  {
    id: 't-002', name: '创新金融集团', shortName: '创新金融', code: 'TENANT_20240201_0002',
    industry: '金融', size: '501-1000人', country: '中国', region: '上海 · 浦东新区', timezone: 'UTC+8 (北京时间)',
    adminEmail: 'admin@finance.com', contactName: '刘一鸣', contactPosition: 'CIO', contactPhone: '+86 139 1688 6688', backupEmail: 'it@finance.com',
    package: 'pro', billingMode: '包月', status: 'active',
    members: 856, agents: 4, tokenUsage: 5230000, tokenQuota: 8000000, quotaWarn: 85,
    qps: 150, qpsPeak: 121, storageUsed: 32.2, storageQuota: 50, monthlyBill: 1560,
    totalSpend: 12480, unpaid: 0, overdue: 0,
    createdAt: '2024-02-01', serviceStart: '2024-02-01', serviceEnd: '2026-08-01',
    mcpEnabled: true, isolation: '物理隔离', notes: '金融合规要求：MCP 严格模式，禁用第三方 MCP'
  },
  {
    id: 't-003', name: '未来科技公司', shortName: '未来科技', code: 'TENANT_20240220_0003',
    industry: '制造', size: '201-500人', country: '中国', region: '广东 · 深圳市', timezone: 'UTC+8 (北京时间)',
    adminEmail: 'admin@future.com', contactName: '周凯', contactPosition: 'IT 经理', contactPhone: '+86 136 2233 4455', backupEmail: '',
    package: 'basic', billingMode: '按量付费', status: 'active',
    members: 234, agents: 2, tokenUsage: 1890000, tokenQuota: 3000000, quotaWarn: 80,
    qps: 50, qpsPeak: 34, storageUsed: 8.6, storageQuota: 20, monthlyBill: 450,
    totalSpend: 2250, unpaid: 450, overdue: 0,
    createdAt: '2024-02-20', serviceStart: '2024-02-20', serviceEnd: '2027-02-19',
    mcpEnabled: false, isolation: '逻辑隔离', notes: ''
  },
  {
    id: 't-004', name: '智慧零售有限公司', shortName: '智慧零售', code: 'TENANT_20240128_0004',
    industry: '零售', size: '501-1000人', country: '中国', region: '浙江 · 杭州市', timezone: 'UTC+8 (北京时间)',
    adminEmail: 'admin@retail.com', contactName: '吴珊', contactPosition: '数字化总监', contactPhone: '+86 137 7788 9900', backupEmail: 'finance@retail.com',
    package: 'pro', billingMode: '包月', status: 'overdue',
    members: 567, agents: 3, tokenUsage: 4120000, tokenQuota: 5000000, quotaWarn: 80,
    qps: 100, qpsPeak: 96, storageUsed: 27.9, storageQuota: 50, monthlyBill: 1230,
    totalSpend: 8610, unpaid: 2460, overdue: 1230,
    createdAt: '2024-01-28', serviceStart: '2024-01-28', serviceEnd: '2026-07-28',
    mcpEnabled: true, isolation: '逻辑隔离', notes: '连续 2 期账单未支付，已发送催缴通知（05-02、05-09）'
  },
  {
    id: 't-005', name: '华润三九医药股份有限公司', shortName: '华润三九', code: 'TENANT_20260110_0005',
    industry: '医药', size: '1000人以上', country: '中国', region: '广东 · 深圳市', timezone: 'UTC+8 (北京时间)',
    adminEmail: 'admin@999.com.cn', contactName: '林哲', contactPosition: '数字化中心总监', contactPhone: '+86 139 2288 3999', backupEmail: 'it@999.com.cn',
    package: 'pro', billingMode: '包年', status: 'active',
    members: 2134, agents: 3, tokenUsage: 3260000, tokenQuota: 5000000, quotaWarn: 80,
    qps: 100, qpsPeak: 61, storageUsed: 21.6, storageQuota: 50, monthlyBill: 1450,
    totalSpend: 8700, unpaid: 0, overdue: 0,
    createdAt: '2026-01-10', serviceStart: '2026-01-10', serviceEnd: '2029-01-09',
    mcpEnabled: true, isolation: '物理隔离', notes: '医药合规：审计日志保留 3 年、对话日志脱敏强制开启'
  },
  {
    id: 't-006', name: '云帆物流股份', shortName: '云帆物流', code: 'TENANT_20260301_0006',
    industry: '物流', size: '201-500人', country: '中国', region: '江苏 · 南京市', timezone: 'UTC+8 (北京时间)',
    adminEmail: 'admin@yunfan56.cn', contactName: '韩磊', contactPosition: '信息中心主任', contactPhone: '+86 189 5100 6789', backupEmail: 'it@yunfan56.cn',
    package: 'pro', billingMode: '按量付费', status: 'active',
    members: 412, agents: 3, tokenUsage: 5400000, tokenQuota: 5000000, quotaWarn: 80,
    qps: 100, qpsPeak: 99, storageUsed: 34.2, storageQuota: 40, monthlyBill: 1680,
    totalSpend: 6240, unpaid: 1680, overdue: 0,
    createdAt: '2026-03-01', serviceStart: '2026-03-01', serviceEnd: '2027-03-01',
    mcpEnabled: true, isolation: '逻辑隔离', notes: '⚠ 边界场景：本月 Token 已超配额 8%，超量部分按 1.5 倍计费，QPS 峰值 99/100 接近限流'
  }
];

export const bills = [
  { id: 'b-101', tenantId: 't-001', billNo: 'BILL_20260501_0101', period: '2026-04-01 至 2026-04-30', amount: 2890, tokens: 2890000, status: 'unpaid', createdAt: '2026-05-01 10:00', paidAt: '', items: [ { name: 'GPT-4-Turbo Token 消耗', qty: '1,820,000 tokens', unit: '¥0.0011/token', amount: 2002 }, { name: 'Claude-3-Opus Token 消耗', qty: '760,000 tokens', unit: '¥0.0009/token', amount: 684 }, { name: '存储空间（超出部分）', qty: '8.5 GB', unit: '¥8/GB·月', amount: 68 }, { name: '并发扩容包（QPS 200）', qty: '1 个月', unit: '¥136/月', amount: 136 } ] },
  { id: 'b-102', tenantId: 't-001', billNo: 'BILL_20260401_0087', period: '2026-03-01 至 2026-03-31', amount: 2640, tokens: 2610000, status: 'paid', createdAt: '2026-04-01 10:00', paidAt: '2026-04-06 15:22', items: [ { name: 'GPT-4-Turbo Token 消耗', qty: '1,680,000 tokens', unit: '¥0.0011/token', amount: 1848 }, { name: 'Claude-3-Opus Token 消耗', qty: '930,000 tokens', unit: '¥0.0009/token', amount: 656 }, { name: '并发扩容包（QPS 200）', qty: '1 个月', unit: '¥136/月', amount: 136 } ] },
  { id: 'b-103', tenantId: 't-001', billNo: 'BILL_20260301_0064', period: '2026-02-01 至 2026-02-28', amount: 2310, tokens: 2260000, status: 'paid', createdAt: '2026-03-01 10:00', paidAt: '2026-03-03 09:41', items: [ { name: 'GPT-4-Turbo Token 消耗', qty: '1,510,000 tokens', unit: '¥0.0011/token', amount: 1661 }, { name: 'Claude-3-Opus Token 消耗', qty: '750,000 tokens', unit: '¥0.0009/token', amount: 513 }, { name: '并发扩容包（QPS 200）', qty: '1 个月', unit: '¥136/月', amount: 136 } ] },
  { id: 'b-104', tenantId: 't-001', billNo: 'BILL_20260201_0041', period: '2026-01-01 至 2026-01-31', amount: 2180, tokens: 2090000, status: 'paid', createdAt: '2026-02-01 10:00', paidAt: '2026-02-02 11:05', items: [ { name: 'GPT-4-Turbo Token 消耗', qty: '1,420,000 tokens', unit: '¥0.0011/token', amount: 1562 }, { name: 'Claude-3-Opus Token 消耗', qty: '670,000 tokens', unit: '¥0.0009/token', amount: 482 }, { name: '并发扩容包（QPS 200）', qty: '1 个月', unit: '¥136/月', amount: 136 } ] },
  { id: 'b-105', tenantId: 't-001', billNo: 'BILL_20260101_0018', period: '2025-12-01 至 2025-12-31', amount: 0, tokens: 0, status: 'void', createdAt: '2026-01-01 10:00', paidAt: '', items: [ { name: '账单开具错误，已作废重开', qty: '-', unit: '-', amount: 0 } ] },
  { id: 'b-401', tenantId: 't-004', billNo: 'BILL_20260501_0104', period: '2026-04-01 至 2026-04-30', amount: 1230, tokens: 1230000, status: 'unpaid', createdAt: '2026-05-01 10:00', paidAt: '', items: [ { name: 'GPT-4-Turbo Token 消耗', qty: '1,230,000 tokens', unit: '¥0.001/token', amount: 1230 } ] },
  { id: 'b-402', tenantId: 't-004', billNo: 'BILL_20260401_0090', period: '2026-03-01 至 2026-03-31', amount: 1230, tokens: 1180000, status: 'overdue', createdAt: '2026-04-01 10:00', paidAt: '', items: [ { name: 'GPT-4-Turbo Token 消耗', qty: '1,180,000 tokens', unit: '¥0.001/token', amount: 1180 }, { name: '存储空间（超出部分）', qty: '6.2 GB', unit: '¥8/GB·月', amount: 50 } ] },
  { id: 'b-403', tenantId: 't-004', billNo: 'BILL_20260301_0067', period: '2026-02-01 至 2026-02-28', amount: 1150, tokens: 1110000, status: 'paid', createdAt: '2026-03-01 10:00', paidAt: '2026-03-15 17:30', items: [ { name: 'GPT-4-Turbo Token 消耗', qty: '1,110,000 tokens', unit: '¥0.001/token', amount: 1110 }, { name: '存储空间（超出部分）', qty: '5.0 GB', unit: '¥8/GB·月', amount: 40 } ] },
  { id: 'b-201', tenantId: 't-002', billNo: 'BILL_20260501_0102', period: '2026-04-01 至 2026-04-30', amount: 1560, tokens: 1560000, status: 'paid', createdAt: '2026-05-01 10:00', paidAt: '2026-05-02 08:12', items: [ { name: '专业版包月套餐', qty: '1 个月', unit: '¥1200/月', amount: 1200 }, { name: 'Token 超量部分', qty: '360,000 tokens', unit: '¥0.001/token', amount: 360 } ] },
  { id: 'b-601', tenantId: 't-006', billNo: 'BILL_20260501_0106', period: '2026-04-01 至 2026-04-30', amount: 1680, tokens: 1560000, status: 'unpaid', createdAt: '2026-05-01 10:00', paidAt: '', items: [ { name: 'GPT-4-Turbo Token 消耗（配额内）', qty: '1,400,000 tokens', unit: '¥0.001/token', amount: 1400 }, { name: 'Token 超量部分（1.5 倍计费）', qty: '160,000 tokens', unit: '¥0.0015/token', amount: 240 }, { name: '存储空间（超出部分）', qty: '5.0 GB', unit: '¥8/GB·月', amount: 40 } ] },
  { id: 'b-301', tenantId: 't-003', billNo: 'BILL_20260501_0103', period: '2026-04-01 至 2026-04-30', amount: 450, tokens: 450000, status: 'unpaid', createdAt: '2026-05-01 10:00', paidAt: '', items: [ { name: 'GPT-4-Turbo Token 消耗', qty: '450,000 tokens', unit: '¥0.001/token', amount: 450 } ] }
];

export const quotaAdjustments = [
  { id: 'qa-01', tenantId: 't-001', type: 'Token 配额', from: '800 万', to: '1,000 万', reason: '客户 Q2 业务量增长，商务审批通过（OA#20260410-233）', operator: '平台运营 · 王铭', time: '2026-04-12 14:20' },
  { id: 'qa-02', tenantId: 't-001', type: '并发限制', from: '150 QPS', to: '200 QPS', reason: '618 大促扩容申请', operator: '平台运营 · 王铭', time: '2026-05-06 09:15' },
  { id: 'qa-03', tenantId: 't-001', type: '存储配额', from: '50 GB', to: '100 GB', reason: '知识库扩容（产品文档库 + 客服FAQ）', operator: '平台运营 · 李倩', time: '2026-03-02 16:40' }
];

export const mcpApplications = [
  { id: 'mcp-01', tenantId: 't-001', name: '企业 CRM 连接器', type: '企业自建', endpoint: 'https://mcp.pinqi.cn/crm', auth: 'OAuth 2.0', scope: 'CRM 客户读写、工单创建', tps: 50, security: 'medium', status: 'pending', applicant: '张明（IT部）', appliedAt: '2026-05-10 11:20', reason: '客服 Agent 需要直连 CRM 创建工单，替代现有 API 轮询方案', reviewer: '', reviewedAt: '', comment: '' },
  { id: 'mcp-02', tenantId: 't-001', name: '飞书消息推送', type: '第三方', endpoint: 'https://open.feishu.cn/mcp', auth: 'API Key', scope: '消息发送（仅指定群）', tps: 20, security: 'low', status: 'pending', applicant: '王芳（客服部）', appliedAt: '2026-05-11 09:45', reason: '风险告警需要推送到值班群', reviewer: '', reviewedAt: '', comment: '' },
  { id: 'mcp-03', tenantId: 't-001', name: '生产数据库直连', type: '企业自建', endpoint: 'mcp://db.pinqi.internal:9801', auth: 'JWT', scope: '订单库只读', tps: 100, security: 'high', status: 'rejected', applicant: '周明（IT部）', appliedAt: '2026-04-28 15:00', reason: '数据分析 Agent 需要实时订单数据', reviewer: '安全管理员 · 赵强', reviewedAt: '2026-04-29 10:12', comment: '生产库直连风险过高，请改用只读从库 + 字段白名单后重新提交' },
  { id: 'mcp-04', tenantId: 't-001', name: '邮件发送服务', type: '平台内置', endpoint: 'mcp://platform/email', auth: '平台托管', scope: '企业域内邮件发送', tps: 30, security: 'low', status: 'approved', applicant: '系统管理员', appliedAt: '2026-03-15 10:00', reviewer: '安全管理员 · 赵强', reviewedAt: '2026-03-15 14:30', comment: '平台官方 MCP，默认放行' },
  { id: 'mcp-06', tenantId: 't-006', name: '运单轨迹数据库直连', type: '企业自建', endpoint: 'mcp://tms.yunfan.internal:9901', auth: 'JWT', scope: '运单轨迹只读', tps: 150, security: 'high', status: 'pending', applicant: '韩磊（信息中心）', appliedAt: '2026-07-15 14:20', reason: '客服 Agent 需实时查询运单位置，替代每 5 分钟轮询', reviewer: '', reviewedAt: '', comment: '' },
  { id: 'mcp-05', tenantId: 't-002', name: '行情数据接口', type: '第三方', endpoint: 'https://quote.example.com/mcp', auth: 'API Key', scope: '行情只读', tps: 200, security: 'medium', status: 'pending', applicant: '刘一鸣（信息部）', appliedAt: '2026-05-09 13:30', reason: '投研 Agent 需要实时行情', reviewer: '', reviewedAt: '', comment: '' }
];

export const tenantLogs = [
  { id: 'log-61', tenantId: 't-006', time: '2026-07-17 08:30', operator: '系统', type: '配额调整', action: '超配额告警', detail: 'Token 用量 5.40M / 5.00M（108%），触发超量计费与限流预备', ip: '-' },
  { id: 'log-62', tenantId: 't-006', time: '2026-07-16 21:04', operator: '系统', type: '账单', action: '超量计费启动', detail: '超出配额部分按 1.5 倍单价计入下期账单', ip: '-' },
  { id: 'log-01', tenantId: 't-001', time: '2026-05-12 10:32', operator: '平台运营 · 王铭', type: '配额调整', action: '调整并发限制', detail: '150 QPS → 200 QPS（618 扩容）', ip: '10.8.12.34' },
  { id: 'log-02', tenantId: 't-001', time: '2026-05-11 09:45', operator: '租户管理员 · 陈雪', type: 'MCP 申请', action: '提交 MCP 申请', detail: '飞书消息推送（第三方）', ip: '203.119.88.201' },
  { id: 'log-03', tenantId: 't-001', time: '2026-05-10 11:20', operator: '租户管理员 · 张明', type: 'MCP 申请', action: '提交 MCP 申请', detail: '企业 CRM 连接器（企业自建）', ip: '203.119.88.15' },
  { id: 'log-04', tenantId: 't-001', time: '2026-05-06 09:15', operator: '平台运营 · 王铭', type: '配额调整', action: '调整 Token 配额', detail: '触发 80% 预警后人工复核', ip: '10.8.12.34' },
  { id: 'log-05', tenantId: 't-001', time: '2026-05-01 10:00', operator: '系统', type: '账单', action: '生成月度账单', detail: 'BILL_20260501_0101（¥2,890）', ip: '-' },
  { id: 'log-06', tenantId: 't-001', time: '2026-04-29 10:12', operator: '安全管理员 · 赵强', type: 'MCP 审批', action: '驳回 MCP 申请', detail: '生产数据库直连：风险过高', ip: '10.8.3.7' },
  { id: 'log-07', tenantId: 't-001', time: '2026-04-12 14:20', operator: '平台运营 · 王铭', type: '配额调整', action: '调整 Token 配额', detail: '800 万 → 1,000 万', ip: '10.8.12.34' },
  { id: 'log-08', tenantId: 't-001', time: '2026-04-06 15:22', operator: '租户管理员 · 陈雪', type: '账单', action: '支付账单', detail: 'BILL_20260401_0087（¥2,640）对公转账', ip: '203.119.88.201' }
];

export const modelProviders = [
  { id: 'openai', name: 'OpenAI / Azure OpenAI', models: [ { name: 'GPT-4-Turbo', enabled: true, quota: 5000000, used: 4230000, priority: '质量优先' }, { name: 'GPT-4o', enabled: true, quota: 2000000, used: 860000, priority: '质量优先' }, { name: 'GPT-3.5-Turbo', enabled: false, quota: 0, used: 0, priority: '-' } ] },
  { id: 'anthropic', name: 'Anthropic (Claude)', models: [ { name: 'Claude-3-Opus', enabled: true, quota: 2000000, used: 1780000, priority: '质量优先' }, { name: 'Claude-3-Sonnet', enabled: true, quota: 1000000, used: 420000, priority: '成本优先' } ] },
  { id: 'qwen', name: '通义千问', models: [ { name: 'Qwen-Max', enabled: true, quota: 1000000, used: 1160000, priority: '成本优先' }, { name: 'Qwen-Plus', enabled: false, quota: 0, used: 0, priority: '-' } ] },
  { id: 'deepseek', name: 'DeepSeek', models: [ { name: 'DeepSeek-V3', enabled: false, quota: 0, used: 0, priority: '-' } ] }
];

export const tokenByModel = [
  { model: 'GPT-4-Turbo', tokens: 4230000, pct: 50 },
  { model: 'Claude-3-Opus', tokens: 1780000, pct: 21 },
  { model: 'Qwen-Max', tokens: 1160000, pct: 14 },
  { model: 'GPT-4o', tokens: 860000, pct: 10 },
  { model: 'Claude-3-Sonnet', tokens: 420000, pct: 5 }
];

export const storageByType = [
  { type: 'PDF 文档', size: '31.2 GB', pct: 46 },
  { type: 'Word / Excel', size: '17.8 GB', pct: 26 },
  { type: '向量索引', size: '12.4 GB', pct: 18 },
  { type: '图片与其他', size: '7.1 GB', pct: 10 }
];

// 近30天 Token 用量（万），t-001
export const tokenTrend30 = [21,23,19,26,28,31,27,24,18,16,25,29,32,30,27,23,26,31,34,33,29,26,22,27,31,35,33,30,28,34];
// 近1小时 QPS 曲线（每5分钟采样）
export const qpsCurve = [86,92,101,124,138,152,147,131,118,126,143,173];

export const deptTokenShare = [
  { dept: '客服部', tokens: 3120000, pct: 37 },
  { dept: '人力资源部', tokens: 1690000, pct: 20 },
  { dept: '财务部', tokens: 1270000, pct: 15 },
  { dept: 'IT部', tokens: 1010000, pct: 12 },
  { dept: '法务部', tokens: 850000, pct: 10 },
  { dept: '其他', tokens: 510000, pct: 6 }
];
