import {
  Play,
  Square,
  Bot,
  Sparkles,
  MessageSquareText,
  ListFilter,
  GitBranch,
  Repeat,
  RotateCw,
  UserCheck,
  Code,
  FileText,
  Variable,
  Layers,
  List,
  FileSearch,
  Braces,
  Globe,
  Wrench,
  Database,
  HardDrive,
  BookOpen,
  MessageSquare,
  StickyNote,
  Webhook,
  Clock,
  Plug,
  ArrowRightLeft,
  Pencil,
  type LucideIcon,
} from 'lucide-react';

import {
  BlockEnum,
  NodeCategory,
  VarType,
  CodeLanguage,
  HttpMethod,
  BodyType,
  RetrievalMode,
  LogicalOperator,
} from '../types/node-types';
import type {
  AppType,
  NodeRegistryEntry,
  NodeCategoryGroup,
} from '../types/workflow-types';

/**
 * Complete node registry with all 30+ node types
 */
export const nodeRegistry: Record<BlockEnum, NodeRegistryEntry> = {
  // ===== Trigger Nodes =====
  [BlockEnum.Start]: {
    type: BlockEnum.Start,
    label: '开始',
    labelEn: 'Start',
    icon: Play,
    color: '#2970FF', // --node-start
    borderColor: '#2970FF',
    bgColor: '#EBF2FF',
    category: NodeCategory.Trigger,
    description: '工作流的起始节点，定义输入变量',
    descriptionEn: 'The starting point of the workflow',
    hasInputPort: false,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      variables: [],
    },
    maxInstances: 1,
  },

  [BlockEnum.TriggerWebhook]: {
    type: BlockEnum.TriggerWebhook,
    label: 'Webhook触发',
    labelEn: 'Webhook Trigger',
    icon: Webhook,
    color: '#F97316', // --node-trigger
    borderColor: '#F97316',
    bgColor: '#FFF7ED',
    category: NodeCategory.Trigger,
    description: '通过 HTTP Webhook 触发工作流',
    hasInputPort: false,
    hasOutputPort: true,
    availableIn: ['workflow'],
    defaultConfig: {
      method: HttpMethod.POST,
    },
    maxInstances: 1,
  },

  [BlockEnum.TriggerSchedule]: {
    type: BlockEnum.TriggerSchedule,
    label: '定时触发',
    labelEn: 'Schedule Trigger',
    icon: Clock,
    color: '#F97316', // --node-trigger
    borderColor: '#F97316',
    bgColor: '#FFF7ED',
    category: NodeCategory.Trigger,
    description: '按照计划时间自动触发工作流',
    hasInputPort: false,
    hasOutputPort: true,
    availableIn: ['workflow'],
    defaultConfig: {
      schedule_type: 'cron',
      cron_expression: '0 0 * * *',
    },
    maxInstances: 1,
  },

  [BlockEnum.TriggerPlugin]: {
    type: BlockEnum.TriggerPlugin,
    label: '插件触发',
    labelEn: 'Plugin Trigger',
    icon: Plug,
    color: '#F97316', // --node-trigger
    borderColor: '#F97316',
    bgColor: '#FFF7ED',
    category: NodeCategory.Trigger,
    description: '通过外部插件触发工作流',
    hasInputPort: false,
    hasOutputPort: true,
    availableIn: ['workflow'],
    defaultConfig: {},
    maxInstances: 1,
  },

  // ===== AI Nodes =====
  [BlockEnum.LLM]: {
    type: BlockEnum.LLM,
    label: 'LLM',
    labelEn: 'LLM',
    icon: Bot,
    color: '#7C3AED', // --node-llm
    borderColor: '#7C3AED',
    bgColor: '#F5F3FF',
    category: NodeCategory.AI,
    description: '调用大语言模型生成文本',
    descriptionEn: 'Invoke large language model to generate text',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      model: {
        provider: 'openai',
        name: 'gpt-4o',
        completion_params: {
          temperature: 0.7,
          max_tokens: 4096,
        },
      },
      prompts: [
        {
          id: 'system-prompt',
          role: 'system',
          text: '',
        },
        {
          id: 'user-prompt',
          role: 'user',
          text: '',
        },
      ],
    },
  },

  [BlockEnum.Agent]: {
    type: BlockEnum.Agent,
    label: 'Agent',
    labelEn: 'Agent',
    icon: Sparkles,
    color: '#10B981', // --node-agent
    borderColor: '#10B981',
    bgColor: '#ECFDF5',
    category: NodeCategory.AI,
    description: '自主规划和执行任务的智能代理',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      model: {
        provider: 'openai',
        name: 'gpt-4o',
      },
      prompts: [],
      tools: [],
      max_iterations: 5,
      strategy: 'function-call',
    },
  },

  [BlockEnum.QuestionClassifier]: {
    type: BlockEnum.QuestionClassifier,
    label: '问题分类',
    labelEn: 'Question Classifier',
    icon: MessageSquareText,
    color: '#7C3AED', // --node-llm
    borderColor: '#7C3AED',
    bgColor: '#F5F3FF',
    category: NodeCategory.AI,
    description: '使用 LLM 对用户问题进行分类',
    hasInputPort: true,
    hasOutputPort: true,
    outputPorts: [
      { id: 'default', label: '默认' },
    ],
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      model: {
        provider: 'openai',
        name: 'gpt-4o-mini',
      },
      query_variable: [],
      classes: [],
    },
  },

  [BlockEnum.ParameterExtractor]: {
    type: BlockEnum.ParameterExtractor,
    label: '参数提取',
    labelEn: 'Parameter Extractor',
    icon: ListFilter,
    color: '#7C3AED', // --node-llm
    borderColor: '#7C3AED',
    bgColor: '#F5F3FF',
    category: NodeCategory.AI,
    description: '从文本中提取结构化参数',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      model: {
        provider: 'openai',
        name: 'gpt-4o-mini',
      },
      query_variable: [],
      parameters: [],
      reasoning_mode: 'function_call',
    },
  },

  // ===== Logic Control Nodes =====
  [BlockEnum.IfElse]: {
    type: BlockEnum.IfElse,
    label: '条件判断',
    labelEn: 'If/Else',
    icon: GitBranch,
    color: '#F59E0B', // --node-ifelse
    borderColor: '#F59E0B',
    bgColor: '#FFFBEB',
    category: NodeCategory.Logic,
    description: '根据条件执行不同分支',
    hasInputPort: true,
    hasOutputPort: true,
    outputPorts: [
      { id: 'if-true', label: 'IF' },
      { id: 'else', label: 'ELSE' },
    ],
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      cases: [
        {
          id: 'if-case',
          caseId: 'if-true',
          logicalOperator: LogicalOperator.And,
          conditions: [],
        },
      ],
    },
  },

  [BlockEnum.Iteration]: {
    type: BlockEnum.Iteration,
    label: '迭代',
    labelEn: 'Iteration',
    icon: Repeat,
    color: '#3B82F6', // --node-iteration
    borderColor: '#3B82F6',
    bgColor: '#EFF6FF',
    category: NodeCategory.Logic,
    description: '遍历数组并对每个元素执行操作',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      iterator_selector: [],
      parallel_mode: false,
      max_parallelism: 10,
    },
  },

  [BlockEnum.Loop]: {
    type: BlockEnum.Loop,
    label: '循环',
    labelEn: 'Loop',
    icon: RotateCw,
    color: '#8B5CF6', // --node-loop
    borderColor: '#8B5CF6',
    bgColor: '#F5F3FF',
    category: NodeCategory.Logic,
    description: '重复执行直到满足条件',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      max_iterations: 10,
      loop_variables: [],
    },
  },

  [BlockEnum.HumanInput]: {
    type: BlockEnum.HumanInput,
    label: '人工输入',
    labelEn: 'Human Input',
    icon: UserCheck,
    color: '#F59E0B', // --node-ifelse (similar logic)
    borderColor: '#F59E0B',
    bgColor: '#FFFBEB',
    category: NodeCategory.Logic,
    description: '暂停流程等待人工输入',
    hasInputPort: true,
    hasOutputPort: true,
    outputPorts: [
      { id: 'approved', label: '通过' },
      { id: 'rejected', label: '拒绝' },
    ],
    availableIn: ['workflow'],
    defaultConfig: {
      variables: [],
      timeout: 86400,
    },
  },

  // ===== Data Processing Nodes =====
  [BlockEnum.Code]: {
    type: BlockEnum.Code,
    label: '代码执行',
    labelEn: 'Code',
    icon: Code,
    color: '#F59E0B', // --node-code
    borderColor: '#F59E0B',
    bgColor: '#FFFBEB',
    category: NodeCategory.Data,
    description: '执行 Python 或 JavaScript 代码',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      language: CodeLanguage.Python3,
      code: `def main(arg1: str) -> dict:
    return {
        "result": arg1
    }`,
      variables: [],
      outputs: [
        {
          key: 'result',
          type: VarType.String,
        },
      ],
    },
  },

  [BlockEnum.TemplateTransform]: {
    type: BlockEnum.TemplateTransform,
    label: '模板转换',
    labelEn: 'Template Transform',
    icon: FileText,
    color: '#06b6d4',
    borderColor: '#0891b2',
    bgColor: '#ecfeff',
    category: NodeCategory.Data,
    description: '使用 Jinja2 模板转换文本',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      template: '',
      variables: [],
    },
  },

  [BlockEnum.VariableAssigner]: {
    type: BlockEnum.VariableAssigner,
    label: '变量赋值',
    labelEn: 'Variable Assigner',
    icon: Variable,
    color: '#06b6d4',
    borderColor: '#0891b2',
    bgColor: '#ecfeff',
    category: NodeCategory.Data,
    description: '为会话变量赋值',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['chatflow'],
    defaultConfig: {
      write_mode: 'overwrite',
      output_type: VarType.String,
      variables: [],
    },
  },

  [BlockEnum.VariableAggregator]: {
    type: BlockEnum.VariableAggregator,
    label: '变量聚合',
    labelEn: 'Variable Aggregator',
    icon: Layers,
    color: '#06b6d4',
    borderColor: '#0891b2',
    bgColor: '#ecfeff',
    category: NodeCategory.Data,
    description: '合并多个变量为一个',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      variables: [],
      output_type: VarType.Array,
    },
  },

  [BlockEnum.ListOperator]: {
    type: BlockEnum.ListOperator,
    label: '列表操作',
    labelEn: 'List Operator',
    icon: List,
    color: '#06b6d4',
    borderColor: '#0891b2',
    bgColor: '#ecfeff',
    category: NodeCategory.Data,
    description: '对列表进行过滤、排序、切片等操作',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      variable: [],
      operation: 'first',
    },
  },

  [BlockEnum.DocumentExtractor]: {
    type: BlockEnum.DocumentExtractor,
    label: '文档提取',
    labelEn: 'Document Extractor',
    icon: FileSearch,
    color: '#06b6d4',
    borderColor: '#0891b2',
    bgColor: '#ecfeff',
    category: NodeCategory.Data,
    description: '从文档中提取文本内容',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      variable: [],
      extract_type: 'full',
    },
  },

  [BlockEnum.JSONParse]: {
    type: BlockEnum.JSONParse,
    label: 'JSON解析',
    labelEn: 'JSON Parse',
    icon: Braces,
    color: '#06b6d4',
    borderColor: '#0891b2',
    bgColor: '#ecfeff',
    category: NodeCategory.Data,
    description: '解析 JSON 字符串',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      variable: [],
    },
  },

  // ===== Integration Nodes =====
  [BlockEnum.HttpRequest]: {
    type: BlockEnum.HttpRequest,
    label: 'HTTP请求',
    labelEn: 'HTTP Request',
    icon: Globe,
    color: '#EF4444', // --node-http
    borderColor: '#EF4444',
    bgColor: '#FEF2F2',
    category: NodeCategory.Integration,
    description: '发送 HTTP 请求到外部 API',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      method: HttpMethod.GET,
      url: '',
      headers: [],
      params: [],
      body: {
        type: BodyType.None,
      },
      timeout: 60,
    },
  },

  [BlockEnum.Tool]: {
    type: BlockEnum.Tool,
    label: '工具',
    labelEn: 'Tool',
    icon: Wrench,
    color: '#64748B', // --node-tool
    borderColor: '#64748B',
    bgColor: '#F8FAFC',
    category: NodeCategory.Integration,
    description: '调用外部工具或插件',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      tool_id: '',
      tool_parameters: {},
    },
  },

  [BlockEnum.KnowledgeRetrieval]: {
    type: BlockEnum.KnowledgeRetrieval,
    label: '知识检索',
    labelEn: 'Knowledge Retrieval',
    icon: Database,
    color: '#06B6D4', // --node-knowledge
    borderColor: '#06B6D4',
    bgColor: '#ECFEFF',
    category: NodeCategory.Integration,
    description: '从知识库检索相关内容',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      query_variable: [],
      dataset_ids: [],
      retrieval_mode: RetrievalMode.Multiple,
      multiple_retrieval_config: {
        top_k: 3,
        score_threshold: 0.5,
      },
    },
  },

  [BlockEnum.DataSource]: {
    type: BlockEnum.DataSource,
    label: '数据源',
    labelEn: 'Data Source',
    icon: HardDrive,
    color: '#06B6D4', // --node-knowledge
    borderColor: '#06B6D4',
    bgColor: '#ECFEFF',
    category: NodeCategory.Integration,
    description: '查询外部数据源',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      datasource_type: '',
      variables: [],
    },
  },

  [BlockEnum.KnowledgeBase]: {
    type: BlockEnum.KnowledgeBase,
    label: '知识库',
    labelEn: 'Knowledge Base',
    icon: BookOpen,
    color: '#06B6D4', // --node-knowledge
    borderColor: '#06B6D4',
    bgColor: '#ECFEFF',
    category: NodeCategory.Integration,
    description: '写入知识库',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['workflow'],
    defaultConfig: {},
  },

  // ===== Output Nodes =====
  [BlockEnum.End]: {
    type: BlockEnum.End,
    label: '结束',
    labelEn: 'End',
    icon: Square,
    color: '#6B7280', // --node-end
    borderColor: '#6B7280',
    bgColor: '#F9FAFB',
    category: NodeCategory.Output,
    description: '工作流结束节点，定义输出',
    hasInputPort: true,
    hasOutputPort: false,
    availableIn: ['workflow'],
    defaultConfig: {
      outputs: [],
    },
  },

  [BlockEnum.Answer]: {
    type: BlockEnum.Answer,
    label: '直接回复',
    labelEn: 'Answer',
    icon: MessageSquare,
    color: '#2970FF', // --node-answer
    borderColor: '#2970FF',
    bgColor: '#EBF2FF',
    category: NodeCategory.Output,
    description: '直接返回文本给用户（Chatflow）',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['chatflow'],
    defaultConfig: {
      answer: '',
      variables: [],
    },
  },

  // ===== Special Nodes =====
  [BlockEnum.Note]: {
    type: BlockEnum.Note,
    label: '便签',
    labelEn: 'Note',
    icon: StickyNote,
    color: '#FEF08A', // --node-note (lighter)
    borderColor: '#FDE047',
    bgColor: '#FEF08A',
    category: NodeCategory.Special,
    description: '添加注释或说明',
    hasInputPort: false,
    hasOutputPort: false,
    availableIn: ['workflow', 'chatflow'],
    defaultConfig: {
      text: '',
      background_color: '#fefce8',
    },
  },

  [BlockEnum.AssignerWriteTo]: {
    type: BlockEnum.AssignerWriteTo,
    label: '写入变量',
    labelEn: 'Write to Variable',
    icon: Pencil,
    color: '#06B6D4', // Data processing color
    borderColor: '#06B6D4',
    bgColor: '#ECFEFF',
    category: NodeCategory.Data,
    description: '将值写入会话变量',
    hasInputPort: true,
    hasOutputPort: true,
    availableIn: ['chatflow'],
    defaultConfig: {
      write_mode: 'overwrite',
      output_type: VarType.String,
      variables: [],
    },
  },
};

/**
 * Node category groups for sidebar display
 */
export const nodeCategoryGroups: NodeCategoryGroup[] = [
  {
    id: NodeCategory.Trigger,
    label: '触发器',
    labelEn: 'Triggers',
    types: [
      BlockEnum.Start,
      BlockEnum.TriggerWebhook,
      BlockEnum.TriggerSchedule,
      BlockEnum.TriggerPlugin,
    ],
  },
  {
    id: NodeCategory.AI,
    label: 'AI节点',
    labelEn: 'AI',
    types: [
      BlockEnum.LLM,
      BlockEnum.Agent,
      BlockEnum.QuestionClassifier,
      BlockEnum.ParameterExtractor,
    ],
  },
  {
    id: NodeCategory.Logic,
    label: '逻辑控制',
    labelEn: 'Logic',
    types: [
      BlockEnum.IfElse,
      BlockEnum.Iteration,
      BlockEnum.Loop,
      BlockEnum.HumanInput,
    ],
  },
  {
    id: NodeCategory.Data,
    label: '数据处理',
    labelEn: 'Data',
    types: [
      BlockEnum.Code,
      BlockEnum.TemplateTransform,
      BlockEnum.VariableAssigner,
      BlockEnum.VariableAggregator,
      BlockEnum.ListOperator,
      BlockEnum.DocumentExtractor,
      BlockEnum.JSONParse,
      BlockEnum.AssignerWriteTo,
    ],
  },
  {
    id: NodeCategory.Integration,
    label: '集成',
    labelEn: 'Integration',
    types: [
      BlockEnum.HttpRequest,
      BlockEnum.Tool,
      BlockEnum.KnowledgeRetrieval,
      BlockEnum.DataSource,
      BlockEnum.KnowledgeBase,
    ],
  },
  {
    id: NodeCategory.Output,
    label: '输出',
    labelEn: 'Output',
    types: [
      BlockEnum.End,
      BlockEnum.Answer,
    ],
  },
  {
    id: NodeCategory.Special,
    label: '其他',
    labelEn: 'Special',
    types: [
      BlockEnum.Note,
    ],
  },
];

/**
 * Get node registry entry by type
 */
export function getNodeConfig(type: BlockEnum): NodeRegistryEntry {
  return nodeRegistry[type];
}

/**
 * Get all nodes available for a specific app type
 */
export function getNodesForAppType(appType: AppType): NodeRegistryEntry[] {
  return Object.values(nodeRegistry).filter(
    (node) => node.availableIn.includes(appType)
  );
}

/**
 * Get nodes grouped by category for a specific app type
 */
export function getNodesByCategory(appType: AppType): NodeCategoryGroup[] {
  return nodeCategoryGroups.map((group) => ({
    ...group,
    types: group.types.filter((type) => 
      nodeRegistry[type].availableIn.includes(appType)
    ),
  })).filter((group) => group.types.length > 0);
}

/**
 * Generate a unique node ID
 */
export function generateNodeId(type: BlockEnum): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new node with default configuration
 */
export function createNode(
  type: BlockEnum,
  position: { x: number; y: number }
): import('../types/workflow-types').WorkflowNode {
  const config = nodeRegistry[type];
  return {
    id: generateNodeId(type),
    type,
    title: config.label,
    position,
    data: { ...config.defaultConfig } as import('../types/workflow-types').NodeConfig,
  };
}
