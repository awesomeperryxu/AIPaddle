/**
 * 模板库 Seed：28 个内置模板（来源：Dify 开源仓库，Apache-2.0，注明来源）
 * 运行：pnpm exec tsx supabase/seed-templates.ts
 *
 * 类型分布：
 *   agent ×2 / assistant ×2 / chatflow ×10 / workflow ×12 / text-generation ×2
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('缺少环境变量 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── 28 个模板数据 ────────────────────────────────────────────────────────────

const TEMPLATES = [
  // ── Agent ×2 ──────────────────────────────────────────────────────────────
  {
    name: 'YouTube 频道数据分析',
    type: 'agent',
    category: '商业数据分析',
    description: '深度分析 YouTube 频道数据，提供订阅量、播放量趋势与竞品对比报告',
    icon: '📊',
    icon_background: '#E0F2FE',
    tags: ['分析', 'YouTube', '数据'],
    dsl: {
      systemPrompt: '你是一名专业的 YouTube 数据分析师。用户提供频道名称或链接后，你需要：\n1. 分析该频道的内容定位与受众画像\n2. 评估内容质量、更新频率与互动率\n3. 识别热门内容规律并给出增长建议\n4. 与同类竞品频道横向对比\n\n请以结构化报告形式输出，使用 Markdown 格式，包含数据图表建议。',
      model: 'qwen-plus',
      temperature: 0.7,
      agent_mode: 'react',
      max_iterations: 5,
      variables: [{ key: 'channel_url', label: '频道链接/名称', type: 'string', required: true }],
      tools: [],
    },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '美股投资分析助手',
    type: 'agent',
    category: '商业数据分析',
    description: '分析美股个股基本面与技术面，提供投资参考意见（非正式投资建议）',
    icon: '📈',
    icon_background: '#DCFCE7',
    tags: ['投资', '美股', '金融分析'],
    dsl: {
      systemPrompt: '你是一名专业的美股分析师助手。当用户提供股票代码或公司名称时，你需要：\n1. 梳理公司基本面：营收/净利润/PE/EPS 等核心指标\n2. 分析近期技术面走势与支撑/压力位\n3. 关注最新财报与重大事件\n4. 结合行业对比给出综合评级参考\n\n⚠️ 本分析仅供参考，不构成实际投资建议，请用户自行判断风险。',
      model: 'qwen-plus',
      temperature: 0.5,
      agent_mode: 'function_calling',
      max_iterations: 5,
      variables: [{ key: 'ticker', label: '股票代码（如 AAPL）', type: 'string', required: true }],
      tools: [],
    },
    source: 'dify',
    license: 'Apache-2.0',
  },

  // ── 聊天助手 ×2 ───────────────────────────────────────────────────────────
  {
    name: '会议纪要助手',
    type: 'assistant',
    category: '团队提效',
    description: '粘贴会议对话或录音转写文本，自动生成结构化会议纪要、行动项与决策记录',
    icon: '📝',
    icon_background: '#FEF9C3',
    tags: ['会议', '纪要', '团队协作'],
    dsl: {
      systemPrompt: '你是一名专业的会议纪要整理员。用户粘贴会议录音转写或对话记录后，请输出：\n\n## 会议概览\n- 时间/参与人/主题\n\n## 核心讨论\n（分议题梳理关键信息）\n\n## 决策记录\n（列出所有已拍板决定）\n\n## 行动项\n| 事项 | 负责人 | 截止日期 |\n|---|---|---|\n\n## 待跟进问题\n（列出本次会议遗留的未决事项）\n\n请用中文输出，保持简洁专业。',
      model: 'qwen-plus',
      temperature: 0.3,
      variables: [],
      tools: [],
    },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '代码解释器',
    type: 'assistant',
    category: 'AI编程',
    description: '输入任意代码片段，获得逐行解释、逻辑分析与优化建议',
    icon: '💻',
    icon_background: '#F3E8FF',
    tags: ['代码', '编程', '学习'],
    dsl: {
      systemPrompt: '你是一名耐心的代码讲解专家，能够解释任何编程语言的代码。用户提交代码后，你需要：\n1. **整体功能**：一句话说明这段代码做什么\n2. **逐段解释**：分块注释核心逻辑，重点标注关键 API 和算法\n3. **潜在问题**：指出可能的 Bug、性能瓶颈或安全隐患\n4. **优化建议**：提供更简洁/高效的改写思路\n\n用 Markdown 格式输出，代码块使用对应语言高亮。',
      model: 'qwen-plus',
      temperature: 0.3,
      variables: [{ key: 'language', label: '编程语言', type: 'string', required: false }],
      tools: [],
    },
    source: 'dify',
    license: 'Apache-2.0',
  },

  // ── Chatflow ×10 ──────────────────────────────────────────────────────────
  {
    name: '文件翻译',
    type: 'chatflow',
    category: '团队提效',
    description: '上传文档或粘贴文本，支持多语言互译，保留原文格式与专业术语',
    icon: '🌐',
    icon_background: '#DBEAFE',
    tags: ['翻译', '多语言', '文档'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '个性化记忆助手',
    type: 'chatflow',
    category: '新手入门',
    description: '记住用户偏好与历史对话上下文，提供持续个性化的对话体验',
    icon: '🧠',
    icon_background: '#FCE7F3',
    tags: ['记忆', '个性化', '对话'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: 'DeepResearch',
    type: 'chatflow',
    category: 'Research',
    description: '多轮对话式深度研究助手，围绕主题自动拆解子问题并汇总综合报告',
    icon: '🔬',
    icon_background: '#ECFDF5',
    tags: ['研究', '报告', '知识检索'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '聊天机器人',
    type: 'chatflow',
    category: '新手入门',
    description: '通用多轮对话机器人模板，可快速定制角色设定与业务场景',
    icon: '🤖',
    icon_background: '#FFEDD5',
    tags: ['对话', '客服', '通用'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '专属智能客服',
    type: 'chatflow',
    category: '客服与运营支持',
    description: '基于企业知识库的智能客服，自动回答常见问题并支持人工转接',
    icon: '🎧',
    icon_background: '#E0F2FE',
    tags: ['客服', '知识库', 'FAQ'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '每日新闻摘要',
    type: 'chatflow',
    category: '市场与内容营销',
    description: '每日自动抓取并摘要多源新闻，按主题分类推送精炼资讯',
    icon: '📰',
    icon_background: '#FEF3C7',
    tags: ['新闻', '摘要', '资讯'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '科技新闻摘要',
    type: 'chatflow',
    category: '市场与内容营销',
    description: '聚焦 AI/科技领域最新动态，提供中英双语精炼摘要与行业点评',
    icon: '🔋',
    icon_background: '#DCFCE7',
    tags: ['科技', 'AI', '新闻'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '问题分类+知识库+聊天机器人',
    type: 'chatflow',
    category: '客服与运营支持',
    description: '先通过分类器识别用户意图，命中知识库则检索回答，否则转通用对话',
    icon: '🗂️',
    icon_background: '#F0FDF4',
    tags: ['分类', '知识库', 'RAG'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: 'Research Agent Process Flow',
    type: 'chatflow',
    category: 'Research',
    description: '研究型 Agent 流程：目标分解→并行搜索→汇总→审查→报告',
    icon: '🧩',
    icon_background: '#EDE9FE',
    tags: ['研究', 'Agent', '流程'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '知识库+聊天机器人',
    type: 'chatflow',
    category: 'Knowledge Retrieval',
    description: '将企业文档接入对话，用户提问自动检索相关知识并引用来源作答',
    icon: '📚',
    icon_background: '#FFF7ED',
    tags: ['知识库', 'RAG', '企业知识'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },

  // ── Workflow ×12 ──────────────────────────────────────────────────────────
  {
    name: '名片识别器',
    type: 'workflow',
    category: '团队提效',
    description: '上传名片图片，自动提取姓名/职位/联系方式并结构化输出为 JSON',
    icon: '📇',
    icon_background: '#E0E7FF',
    tags: ['OCR', '名片', '信息提取'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '文润·妙笔生花',
    type: 'workflow',
    category: '市场与内容营销',
    description: '输入粗糙文稿，AI 润色为流畅优美的中文，保留原意提升表达',
    icon: '✍️',
    icon_background: '#FFF1F2',
    tags: ['写作', '润色', '中文'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: 'AI 摘要助手',
    type: 'workflow',
    category: '团队提效',
    description: '长文、网页或 PDF 一键摘要，支持自定义摘要长度与重点方向',
    icon: '⚡',
    icon_background: '#FEFCE8',
    tags: ['摘要', '长文', '提效'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '智能客服分流助手',
    type: 'workflow',
    category: '客服与运营支持',
    description: '对用户问题进行意图识别与优先级分类，自动路由到对应处理队列',
    icon: '🚦',
    icon_background: '#DCFCE7',
    tags: ['客服', '分流', '路由'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '客户评价处理工作流',
    type: 'workflow',
    category: '客服与运营支持',
    description: '批量处理用户评论，自动分类情感、提炼核心诉求并生成改进建议',
    icon: '⭐',
    icon_background: '#FFFBEB',
    tags: ['评价', '情感分析', 'NPS'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '真假知识问答',
    type: 'workflow',
    category: 'Knowledge Retrieval',
    description: '基于知识库验证用户陈述的真假，并给出依据引用与置信度评分',
    icon: '✅',
    icon_background: '#F0FDF4',
    tags: ['事实核查', '知识库', 'RAG'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '文本情感分析工作流',
    type: 'workflow',
    category: '商业数据分析',
    description: '对批量文本做情感极性判断（正面/中性/负面）并输出情感分布统计',
    icon: '💬',
    icon_background: '#EFF6FF',
    tags: ['情感分析', 'NLP', '数据分析'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: 'AI 写作助手',
    type: 'workflow',
    category: '市场与内容营销',
    description: '根据主题、受众和风格要求，生成完整的博客/公众号/营销文案',
    icon: '🖊️',
    icon_background: '#F5F3FF',
    tags: ['写作', '内容营销', '创意'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '市场调研助手',
    type: 'workflow',
    category: 'Research',
    description: '围绕目标市场自动生成调研框架、竞品分析维度与用户访谈题目',
    icon: '🔍',
    icon_background: '#FFF7ED',
    tags: ['市场', '调研', '竞品'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: 'UTM 链接生成器',
    type: 'workflow',
    category: '市场与内容营销',
    description: '批量生成带 UTM 参数的追踪链接，支持自定义 Source/Medium/Campaign',
    icon: '🔗',
    icon_background: '#E0F2FE',
    tags: ['UTM', '营销', '链接'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: 'Jina Reader 总结网站内容',
    type: 'workflow',
    category: 'Knowledge Retrieval',
    description: '输入网址，通过 Jina Reader 抓取全文并生成结构化摘要与关键观点',
    icon: '🌐',
    icon_background: '#F0FDF4',
    tags: ['网页抓取', '摘要', 'Jina'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '网站健康监测',
    type: 'workflow',
    category: '团队提效',
    description: '定期检测指定网站的可用性、响应时间与关键页面状态，异常时推送告警',
    icon: '🏥',
    icon_background: '#FEF2F2',
    tags: ['监控', '运维', '网站'],
    dsl: { nodes: [], edges: [], variables: [] },
    source: 'dify',
    license: 'Apache-2.0',
  },

  // ── 文本生成 ×2 ───────────────────────────────────────────────────────────
  {
    name: 'SQL 生成器',
    type: 'text-generation',
    category: 'AI编程',
    description: '用自然语言描述查询需求，自动生成对应 SQL 语句并附解释',
    icon: '🗃️',
    icon_background: '#EDE9FE',
    tags: ['SQL', '数据库', '代码生成'],
    dsl: {
      prompt_template: '你是一名资深数据库工程师。用户用自然语言描述他们想查询的数据，你需要：\n1. 生成标准 SQL 语句（默认 PostgreSQL 方言，除非用户指定）\n2. 逐行注释说明查询逻辑\n3. 指出可能的性能优化点（如索引建议）\n\n用户输入：{{user_query}}\n数据库表结构（可选）：{{schema}}',
      variables: [
        { key: 'user_query', label: '查询需求描述', type: 'string', required: true },
        { key: 'schema', label: '表结构（可选）', type: 'string', required: false },
      ],
      model: 'qwen-plus',
      temperature: 0.2,
    },
    source: 'dify',
    license: 'Apache-2.0',
  },
  {
    name: '代码转换器',
    type: 'text-generation',
    category: 'AI编程',
    description: '将代码从一种编程语言转换为另一种，保留逻辑并适配目标语言惯用法',
    icon: '🔄',
    icon_background: '#F0FDF4',
    tags: ['代码转换', '编程', '多语言'],
    dsl: {
      prompt_template: '你是一名多语言编程专家。请将以下 {{source_lang}} 代码转换为 {{target_lang}}，要求：\n1. 逻辑完全等价，不改变功能\n2. 使用目标语言的惯用写法（idiomatic style）\n3. 保留注释并翻译为中文\n4. 指出两种语言在此场景的主要差异\n\n源代码：\n```{{source_lang}}\n{{source_code}}\n```',
      variables: [
        { key: 'source_lang', label: '源语言', type: 'string', required: true },
        { key: 'target_lang', label: '目标语言', type: 'string', required: true },
        { key: 'source_code', label: '源代码', type: 'string', required: true },
      ],
      model: 'qwen-plus',
      temperature: 0.2,
    },
    source: 'dify',
    license: 'Apache-2.0',
  },
]

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== 模板库 Seed 开始（${TEMPLATES.length} 个模板）===\n`)

  let inserted = 0
  let skipped = 0

  for (const tpl of TEMPLATES) {
    // 幂等：按 name + is_built_in 判重
    const { data: existing } = await admin
      .from('templates')
      .select('id')
      .eq('name', tpl.name)
      .eq('is_built_in', true)
      .maybeSingle()

    if (existing) {
      console.log(`  ~ 已存在: ${tpl.name}`)
      skipped++
      continue
    }

    const { error } = await admin.from('templates').insert({
      ...tpl,
      is_built_in: true,
      org_id: null,
    })

    if (error) {
      console.error(`  ✗ 失败: ${tpl.name} — ${error.message}`)
    } else {
      console.log(`  ✓ [${tpl.type}] ${tpl.name}`)
      inserted++
    }
  }

  console.log(`\n=== Seed 完成：新增 ${inserted}，跳过 ${skipped} ===`)
  console.log('来源：Dify 开源仓库（Apache-2.0）https://github.com/langgenius/dify')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
