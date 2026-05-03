// AIPaddle Mock Data - Real Test Cases

export interface Agent {
  id: string;
  name: string;
  description: string;
  department: string;
  status: 'draft' | 'pending' | 'published' | 'offline';
  calls: number;
  successRate: number;
  tokenUsage: number;
  createdAt: string;
  model: string;
  avatar: string;
}

export interface Skill {
  id: string;
  name: string;
  type: 'MCP' | 'API' | 'DB' | 'Workflow' | 'Prompt';
  description: string;
  installs: number;
  calls: number;
  version: string;
  publisher: string;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'draft' | 'pending' | 'published';
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documents: number;
  vectorStatus: 'processing' | 'completed' | 'failed';
  lastUpdated: string;
  size: string;
}

export interface Workflow {
  id: string;
  name: string;
  type: 'internal' | 'cross-agent';
  status: 'draft' | 'published' | 'offline';
  nodes: number;
  executions: number;
  successRate: number;
  lastRun: string;
}

export interface SecurityReview {
  id: string;
  resourceType: 'skill' | 'agent' | 'workflow';
  resourceName: string;
  submitter: string;
  riskLevel: 'low' | 'medium' | 'high';
  sensitiveDataFound: string[];
  illegalInstructions: string[];
  dbRisks: string[];
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

export interface UsageMetrics {
  date: string;
  agentCalls: number;
  tokenUsage: number;
  cost: number;
  activeUsers: number;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'employee' | 'ai_engineer' | 'security' | 'admin';
  status: 'active' | 'disabled';
  lastLogin: string;
}

// Mock Agents
export const mockAgents: Agent[] = [
  {
    id: 'agent-001',
    name: '智能客服助手',
    description: '处理客户咨询、投诉和售后问题，支持多轮对话和工单创建',
    department: '客服部',
    status: 'published',
    calls: 15680,
    successRate: 96.5,
    tokenUsage: 2450000,
    createdAt: '2024-01-15',
    model: 'GPT-4-Turbo',
    avatar: '🤖'
  },
  {
    id: 'agent-002',
    name: 'HR政策顾问',
    description: '解答员工关于公司政策、福利、请假等人事问题',
    department: '人力资源部',
    status: 'published',
    calls: 8920,
    successRate: 94.2,
    tokenUsage: 1280000,
    createdAt: '2024-02-01',
    model: 'Claude-3-Opus',
    avatar: '👥'
  },
  {
    id: 'agent-003',
    name: '财务报销助手',
    description: '协助员工完成报销流程，审核发票，生成报销单',
    department: '财务部',
    status: 'published',
    calls: 5430,
    successRate: 98.1,
    tokenUsage: 890000,
    createdAt: '2024-02-15',
    model: 'GPT-4-Turbo',
    avatar: '💰'
  },
  {
    id: 'agent-004',
    name: '技术支持工程师',
    description: 'IT技术问题诊断、故障排查和解决方案推荐',
    department: 'IT部',
    status: 'pending',
    calls: 3210,
    successRate: 91.8,
    tokenUsage: 560000,
    createdAt: '2024-03-01',
    model: 'GPT-4-Turbo',
    avatar: '🔧'
  },
  {
    id: 'agent-005',
    name: '销售线索助手',
    description: '分析销售线索、生成客户画像、推荐跟进策略',
    department: '销售部',
    status: 'draft',
    calls: 0,
    successRate: 0,
    tokenUsage: 0,
    createdAt: '2024-03-10',
    model: 'Claude-3-Sonnet',
    avatar: '📈'
  },
  {
    id: 'agent-006',
    name: '合同审查专家',
    description: '自动审查合同条款、识别风险点、提供修改建议',
    department: '法务部',
    status: 'published',
    calls: 2890,
    successRate: 97.3,
    tokenUsage: 1120000,
    createdAt: '2024-01-20',
    model: 'GPT-4-Turbo',
    avatar: '📋'
  }
];

// Mock Skills
export const mockSkills: Skill[] = [
  {
    id: 'skill-001',
    name: 'CRM客户查询',
    type: 'API',
    description: '通过API查询CRM系统中的客户信息',
    installs: 156,
    calls: 45600,
    version: '2.1.0',
    publisher: '系统管理员',
    riskLevel: 'low',
    status: 'published'
  },
  {
    id: 'skill-002',
    name: 'ERP库存查询',
    type: 'DB',
    description: '直接查询ERP数据库获取库存信息',
    installs: 89,
    calls: 23400,
    version: '1.5.2',
    publisher: 'IT部',
    riskLevel: 'medium',
    status: 'published'
  },
  {
    id: 'skill-003',
    name: '邮件发送服务',
    type: 'MCP',
    description: '通过MCP协议发送企业邮件',
    installs: 234,
    calls: 78900,
    version: '3.0.1',
    publisher: '系统管理员',
    riskLevel: 'low',
    status: 'published'
  },
  {
    id: 'skill-004',
    name: '报销单生成',
    type: 'Workflow',
    description: '自动生成报销单并提交审批流程',
    installs: 67,
    calls: 12300,
    version: '1.2.0',
    publisher: '财务部',
    riskLevel: 'medium',
    status: 'published'
  },
  {
    id: 'skill-005',
    name: '敏感信息检测',
    type: 'Prompt',
    description: '检测用户输入中的敏感信息',
    installs: 312,
    calls: 156000,
    version: '2.0.0',
    publisher: '安全部',
    riskLevel: 'low',
    status: 'published'
  },
  {
    id: 'skill-006',
    name: 'HR系统接口',
    type: 'API',
    description: '查询员工信息、请假记录等HR数据',
    installs: 145,
    calls: 34500,
    version: '1.8.0',
    publisher: '人力资源部',
    riskLevel: 'high',
    status: 'pending'
  },
  {
    id: 'skill-007',
    name: '财务数据库查询',
    type: 'DB',
    description: '查询财务系统数据库',
    installs: 23,
    calls: 8900,
    version: '1.0.0',
    publisher: '财务部',
    riskLevel: 'high',
    status: 'pending'
  },
  {
    id: 'skill-008',
    name: '文档解析器',
    type: 'MCP',
    description: '解析PDF、Word等文档内容',
    installs: 189,
    calls: 45600,
    version: '2.3.0',
    publisher: '系统管理员',
    riskLevel: 'low',
    status: 'published'
  }
];

// Mock Knowledge Bases
export const mockKnowledgeBases: KnowledgeBase[] = [
  {
    id: 'kb-001',
    name: '员工手册',
    description: '公司规章制度、福利政策、行为准则等',
    documents: 45,
    vectorStatus: 'completed',
    lastUpdated: '2024-03-01',
    size: '12.5 MB'
  },
  {
    id: 'kb-002',
    name: '产品文档库',
    description: '产品说明书、技术规格、使用指南',
    documents: 128,
    vectorStatus: 'completed',
    lastUpdated: '2024-03-08',
    size: '89.2 MB'
  },
  {
    id: 'kb-003',
    name: '客服FAQ',
    description: '常见问题解答、故障排查指南',
    documents: 234,
    vectorStatus: 'completed',
    lastUpdated: '2024-03-10',
    size: '23.1 MB'
  },
  {
    id: 'kb-004',
    name: '技术架构文档',
    description: '系统架构、API文档、开发规范',
    documents: 67,
    vectorStatus: 'processing',
    lastUpdated: '2024-03-12',
    size: '45.8 MB'
  },
  {
    id: 'kb-005',
    name: '销售培训资料',
    description: '销售话术、客户案例、行业分析',
    documents: 89,
    vectorStatus: 'completed',
    lastUpdated: '2024-02-28',
    size: '34.6 MB'
  }
];

// Mock Workflows
export const mockWorkflows: Workflow[] = [
  {
    id: 'wf-001',
    name: '客户投诉处理流程',
    type: 'internal',
    status: 'published',
    nodes: 8,
    executions: 3450,
    successRate: 94.5,
    lastRun: '2024-03-12 14:30'
  },
  {
    id: 'wf-002',
    name: '报销审批流程',
    type: 'cross-agent',
    status: 'published',
    nodes: 12,
    executions: 1890,
    successRate: 98.2,
    lastRun: '2024-03-12 15:45'
  },
  {
    id: 'wf-003',
    name: '新员工入职引导',
    type: 'cross-agent',
    status: 'published',
    nodes: 15,
    executions: 234,
    successRate: 96.8,
    lastRun: '2024-03-11 09:00'
  },
  {
    id: 'wf-004',
    name: '合同审批流程',
    type: 'cross-agent',
    status: 'draft',
    nodes: 10,
    executions: 0,
    successRate: 0,
    lastRun: '-'
  },
  {
    id: 'wf-005',
    name: '技术故障处理',
    type: 'internal',
    status: 'published',
    nodes: 6,
    executions: 567,
    successRate: 92.3,
    lastRun: '2024-03-12 16:20'
  }
];

// Mock Security Reviews
export const mockSecurityReviews: SecurityReview[] = [
  {
    id: 'review-001',
    resourceType: 'skill',
    resourceName: 'HR系统接口',
    submitter: '张明',
    riskLevel: 'high',
    sensitiveDataFound: ['员工身份证号', '银行账户信息', '薪资数据'],
    illegalInstructions: [],
    dbRisks: ['SELECT * 查询可能导致数据泄露'],
    status: 'pending',
    submittedAt: '2024-03-12 10:30'
  },
  {
    id: 'review-002',
    resourceType: 'skill',
    resourceName: '财务数据库查询',
    submitter: '李华',
    riskLevel: 'high',
    sensitiveDataFound: ['财务报表', '交易记录'],
    illegalInstructions: ['可能执行DELETE操作'],
    dbRisks: ['未限制查询范围', '缺少字段白名单'],
    status: 'pending',
    submittedAt: '2024-03-12 11:15'
  },
  {
    id: 'review-003',
    resourceType: 'agent',
    resourceName: '技术支持工程师',
    submitter: '王芳',
    riskLevel: 'medium',
    sensitiveDataFound: [],
    illegalInstructions: [],
    dbRisks: ['调用了高风险Skill: ERP库存查询'],
    status: 'pending',
    submittedAt: '2024-03-12 09:00'
  },
  {
    id: 'review-004',
    resourceType: 'workflow',
    resourceName: '合同审批流程',
    submitter: '赵强',
    riskLevel: 'low',
    sensitiveDataFound: [],
    illegalInstructions: [],
    dbRisks: [],
    status: 'approved',
    submittedAt: '2024-03-11 14:00'
  }
];

// Mock Usage Metrics
export const mockUsageMetrics: UsageMetrics[] = [
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
  { date: '03/12', agentCalls: 6780, tokenUsage: 1350000, cost: 67.8, activeUsers: 367 },
];

// Mock Members
export const mockMembers: Member[] = [
  { id: 'user-001', name: '张明', email: 'zhangming@company.com', department: 'IT部', role: 'ai_engineer', status: 'active', lastLogin: '2024-03-12 16:30' },
  { id: 'user-002', name: '李华', email: 'lihua@company.com', department: '财务部', role: 'employee', status: 'active', lastLogin: '2024-03-12 15:45' },
  { id: 'user-003', name: '王芳', email: 'wangfang@company.com', department: '客服部', role: 'employee', status: 'active', lastLogin: '2024-03-12 14:20' },
  { id: 'user-004', name: '赵强', email: 'zhaoqiang@company.com', department: '安全部', role: 'security', status: 'active', lastLogin: '2024-03-12 16:00' },
  { id: 'user-005', name: '陈雪', email: 'chenxue@company.com', department: '人力资源部', role: 'admin', status: 'active', lastLogin: '2024-03-12 10:30' },
  { id: 'user-006', name: '刘洋', email: 'liuyang@company.com', department: '销售部', role: 'employee', status: 'active', lastLogin: '2024-03-11 18:00' },
  { id: 'user-007', name: '周明', email: 'zhouming@company.com', department: 'IT部', role: 'ai_engineer', status: 'disabled', lastLogin: '2024-02-28 09:00' },
];

// Dashboard Stats
export const dashboardStats = {
  totalAgents: 6,
  publishedAgents: 4,
  totalSkills: 8,
  publishedSkills: 6,
  totalCalls: 52840,
  todayCalls: 6780,
  totalTokens: 8450000,
  todayTokens: 1350000,
  totalCost: 590.6,
  todayCost: 67.8,
  activeUsers: 367,
  totalUsers: 1245,
  successRate: 95.8,
  riskBlocked: 23,
  pendingReviews: 3,
  topAgents: [
    { name: '智能客服助手', calls: 15680 },
    { name: 'HR政策顾问', calls: 8920 },
    { name: '财务报销助手', calls: 5430 },
    { name: '技术支持工程师', calls: 3210 },
    { name: '合同审查专家', calls: 2890 }
  ],
  topSkills: [
    { name: '敏感信息检测', calls: 156000 },
    { name: '邮件发送服务', calls: 78900 },
    { name: 'CRM客户查询', calls: 45600 },
    { name: '文档解析器', calls: 45600 },
    { name: 'HR系统接口', calls: 34500 }
  ]
};

// Conversation History
export const mockConversations = [
  {
    id: 'conv-001',
    agentId: 'agent-001',
    agentName: '智能客服助手',
    messages: [
      { role: 'user', content: '我想查询订单 ORD-2024-0312 的物流状态', timestamp: '14:30:15' },
      { role: 'assistant', content: '好的，我帮您查询一下订单 ORD-2024-0312 的物流信息。\n\n📦 **订单状态**: 配送中\n🚚 **快递公司**: 顺丰速运\n📍 **当前位置**: 上海市浦东新区配送站\n⏰ **预计送达**: 今天 18:00 前\n\n您还有其他问题需要咨询吗？', timestamp: '14:30:18' },
      { role: 'user', content: '可以改地址吗？', timestamp: '14:30:45' },
      { role: 'assistant', content: '抱歉，订单已经在配送途中，暂时无法修改收货地址。\n\n**建议方案**:\n1. 联系快递员协商派送时间\n2. 选择代收点自取\n3. 如果无法签收，快递将会返回配送站，您可以重新预约派送\n\n需要我帮您联系快递员吗？', timestamp: '14:30:50' }
    ],
    timestamp: '2024-03-12 14:30'
  },
  {
    id: 'conv-002',
    agentId: 'agent-002',
    agentName: 'HR政策顾问',
    messages: [
      { role: 'user', content: '公司的年假政策是怎样的？', timestamp: '10:15:00' },
      { role: 'assistant', content: '根据公司《员工手册》的规定，年假政策如下：\n\n📋 **年假天数**:\n- 工龄 1-5 年：5 天\n- 工龄 5-10 年：10 天\n- 工龄 10 年以上：15 天\n\n📅 **使用规则**:\n- 年假需提前 3 个工作日申请\n- 可分次使用，每次不少于半天\n- 当年未休完可顺延至次年第一季度\n\n您目前的工龄是多少年呢？我可以帮您计算具体的年假天数。', timestamp: '10:15:05' }
    ],
    timestamp: '2024-03-12 10:15'
  }
];
