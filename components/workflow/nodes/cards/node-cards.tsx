'use client';

import * as React from 'react';
import {
  Play,
  Square,
  MessageSquare,
  Sparkles,
  Bot,
  HelpCircle,
  Sliders,
  Code2,
  FileText,
  ArrowLeftRight,
  List,
  FileSearch,
  BookOpen,
  Database,
  Table2,
  GitBranch,
  RefreshCw,
  Repeat,
  Globe,
  Wrench,
  UserCheck,
  Webhook,
  Clock,
  Puzzle,
  StickyNote,
  GripVertical,
} from 'lucide-react';
import { NodeCard, NodeBadge, NodePreview, NodeVariableList, type NodeStatus } from './node-card';

// Common props for all node cards
interface BaseNodeCardProps {
  status?: NodeStatus;
  disabled?: boolean;
  selected?: boolean;
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onToggleDisable?: () => void;
  onViewLogs?: () => void;
}

// ============================================
// 1. Start Node (开始)
// ============================================
interface StartNodeCardProps extends BaseNodeCardProps {
  title?: string;
  variables?: { name: string; type: string }[];
}

export function StartNodeCard({
  title = '开始',
  variables = [],
  ...props
}: StartNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="start"
      accentColor="#2970FF"
      icon={<Play />}
      {...props}
    >
      {variables.length > 0 ? (
        <NodeVariableList variables={variables} maxShow={3} />
      ) : (
        <div className="text-muted-foreground">无输入变量</div>
      )}
    </NodeCard>
  );
}

// ============================================
// 2. End Node (结束)
// ============================================
interface EndNodeCardProps extends BaseNodeCardProps {
  title?: string;
  outputCount?: number;
}

export function EndNodeCard({
  title = '结束',
  outputCount = 0,
  ...props
}: EndNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="end"
      accentColor="#6B7280"
      icon={<Square />}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span>输出变量映射</span>
        <NodeBadge>{outputCount} 个</NodeBadge>
      </div>
    </NodeCard>
  );
}

// ============================================
// 3. Answer Node (回复) - Chatflow Only
// ============================================
interface AnswerNodeCardProps extends BaseNodeCardProps {
  title?: string;
  content?: string;
}

export function AnswerNodeCard({
  title = '回复',
  content = '',
  ...props
}: AnswerNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="answer"
      accentColor="#2970FF"
      icon={<MessageSquare />}
      chatflowOnly
      {...props}
    >
      {content ? (
        <NodePreview lines={2}>{content}</NodePreview>
      ) : (
        <div className="text-muted-foreground">未设置回复内容</div>
      )}
    </NodeCard>
  );
}

// ============================================
// 4. LLM Node
// ============================================
interface LLMNodeCardProps extends BaseNodeCardProps {
  title?: string;
  model?: string;
  promptPreview?: string;
}

export function LLMNodeCard({
  title = 'LLM',
  model,
  promptPreview,
  ...props
}: LLMNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="llm"
      accentColor="#7C3AED"
      icon={<Sparkles />}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        {model && <NodeBadge variant="outline">{model}</NodeBadge>}
        {promptPreview && <NodePreview lines={1}>{promptPreview}</NodePreview>}
        {!model && !promptPreview && (
          <div className="text-muted-foreground">未配置模型</div>
        )}
      </div>
    </NodeCard>
  );
}

// ============================================
// 5. Agent Node
// ============================================
interface AgentNodeCardProps extends BaseNodeCardProps {
  title?: string;
  strategy?: 'function-calling' | 'react';
  toolCount?: number;
}

export function AgentNodeCard({
  title = 'Agent',
  strategy,
  toolCount = 0,
  ...props
}: AgentNodeCardProps) {
  const strategyLabels = {
    'function-calling': 'Function Calling',
    'react': 'ReAct',
  };

  return (
    <NodeCard
      title={title}
      type="agent"
      accentColor="#10B981"
      icon={<Bot />}
      {...props}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {strategy && <NodeBadge variant="success">{strategyLabels[strategy]}</NodeBadge>}
        <NodeBadge>{toolCount} 个工具</NodeBadge>
      </div>
    </NodeCard>
  );
}

// ============================================
// 6. Question Classifier Node (问题分类)
// ============================================
interface QuestionClassifierNodeCardProps extends BaseNodeCardProps {
  title?: string;
  queryVariable?: string;
  categoryCount?: number;
}

export function QuestionClassifierNodeCard({
  title = '问题分类',
  queryVariable,
  categoryCount = 0,
  ...props
}: QuestionClassifierNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="question-classifier"
      accentColor="#F59E0B"
      icon={<HelpCircle />}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        {queryVariable && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">查询:</span>
            <span className="font-mono text-foreground">{queryVariable}</span>
          </div>
        )}
        <NodeBadge variant="warning">{categoryCount} 个分类</NodeBadge>
      </div>
    </NodeCard>
  );
}

// ============================================
// 7. Parameter Extractor Node (参数提取)
// ============================================
interface ParameterExtractorNodeCardProps extends BaseNodeCardProps {
  title?: string;
  model?: string;
  paramCount?: number;
}

export function ParameterExtractorNodeCard({
  title = '参数提取',
  model,
  paramCount = 0,
  ...props
}: ParameterExtractorNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="parameter-extractor"
      accentColor="#F59E0B"
      icon={<Sliders />}
      {...props}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {model && <NodeBadge variant="outline">{model}</NodeBadge>}
        <NodeBadge variant="warning">{paramCount} 个参数</NodeBadge>
      </div>
    </NodeCard>
  );
}

// ============================================
// 8. Code Node (代码执行)
// ============================================
interface CodeNodeCardProps extends BaseNodeCardProps {
  title?: string;
  language?: 'python3' | 'javascript';
  codePreview?: string;
}

export function CodeNodeCard({
  title = '代码执行',
  language = 'python3',
  codePreview,
  ...props
}: CodeNodeCardProps) {
  const langLabels = {
    python3: 'Python3',
    javascript: 'JavaScript',
  };

  return (
    <NodeCard
      title={title}
      type="code"
      accentColor="#F59E0B"
      icon={<Code2 />}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        <NodeBadge variant="warning">{langLabels[language]}</NodeBadge>
        {codePreview && <NodePreview mono>{codePreview}</NodePreview>}
      </div>
    </NodeCard>
  );
}

// ============================================
// 9. Template Transform Node (模板转换)
// ============================================
interface TemplateTransformNodeCardProps extends BaseNodeCardProps {
  title?: string;
  templatePreview?: string;
}

export function TemplateTransformNodeCard({
  title = '模板转换',
  templatePreview,
  ...props
}: TemplateTransformNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="template-transform"
      accentColor="#F59E0B"
      icon={<FileText />}
      {...props}
    >
      {templatePreview ? (
        <NodePreview mono dark>{templatePreview}</NodePreview>
      ) : (
        <div className="text-muted-foreground">未设置模板</div>
      )}
    </NodeCard>
  );
}

// ============================================
// 10. Variable Assigner Node (变量赋值)
// ============================================
interface VariableAssignerNodeCardProps extends BaseNodeCardProps {
  title?: string;
  ruleCount?: number;
}

export function VariableAssignerNodeCard({
  title = '变量赋值',
  ruleCount = 0,
  ...props
}: VariableAssignerNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="variable-assigner"
      accentColor="#64748B"
      icon={<ArrowLeftRight />}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span>赋值规则</span>
        <NodeBadge>{ruleCount} 条</NodeBadge>
      </div>
    </NodeCard>
  );
}

// ============================================
// 11. List Operator Node (列表操作)
// ============================================
interface ListOperatorNodeCardProps extends BaseNodeCardProps {
  title?: string;
  operation?: 'filter' | 'sort' | 'slice' | 'dedupe' | 'concat' | 'first' | 'last';
}

export function ListOperatorNodeCard({
  title = '列表操作',
  operation,
  ...props
}: ListOperatorNodeCardProps) {
  const opLabels: Record<string, string> = {
    filter: '过滤',
    sort: '排序',
    slice: '切片',
    dedupe: '去重',
    concat: '合并',
    first: '取首项',
    last: '取末项',
  };

  return (
    <NodeCard
      title={title}
      type="list-operator"
      accentColor="#64748B"
      icon={<List />}
      {...props}
    >
      <div className="flex items-center gap-2">
        {operation ? (
          <NodeBadge>{opLabels[operation]}</NodeBadge>
        ) : (
          <span className="text-muted-foreground">未选择操作</span>
        )}
      </div>
    </NodeCard>
  );
}

// ============================================
// 12. Document Extractor Node (文档提取)
// ============================================
interface DocumentExtractorNodeCardProps extends BaseNodeCardProps {
  title?: string;
  fileVariable?: string;
  parseMode?: 'text' | 'markdown' | 'html';
}

export function DocumentExtractorNodeCard({
  title = '文档提取',
  fileVariable,
  parseMode,
  ...props
}: DocumentExtractorNodeCardProps) {
  const modeLabels: Record<string, string> = {
    text: '纯文本',
    markdown: 'Markdown',
    html: 'HTML',
  };

  return (
    <NodeCard
      title={title}
      type="document-extractor"
      accentColor="#64748B"
      icon={<FileSearch />}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        {fileVariable && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">文件:</span>
            <span className="font-mono text-foreground">{fileVariable}</span>
          </div>
        )}
        {parseMode && <NodeBadge>{modeLabels[parseMode]}</NodeBadge>}
      </div>
    </NodeCard>
  );
}

// ============================================
// 13. Knowledge Retrieval Node (知识检索)
// ============================================
interface KnowledgeRetrievalNodeCardProps extends BaseNodeCardProps {
  title?: string;
  knowledgeBaseCount?: number;
  retrievalMode?: 'single' | 'multiple';
}

export function KnowledgeRetrievalNodeCard({
  title = '知识检索',
  knowledgeBaseCount = 0,
  retrievalMode,
  ...props
}: KnowledgeRetrievalNodeCardProps) {
  const modeLabels: Record<string, string> = {
    single: '单数据集',
    multiple: '多数据集',
  };

  return (
    <NodeCard
      title={title}
      type="knowledge-retrieval"
      accentColor="#06B6D4"
      icon={<BookOpen />}
      {...props}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <NodeBadge variant="outline">{knowledgeBaseCount} 个知识库</NodeBadge>
        {retrievalMode && <NodeBadge>{modeLabels[retrievalMode]}</NodeBadge>}
      </div>
    </NodeCard>
  );
}

// ============================================
// 14. Knowledge Base Node (知识库)
// ============================================
interface KnowledgeBaseNodeCardProps extends BaseNodeCardProps {
  title?: string;
  knowledgeBaseName?: string;
}

export function KnowledgeBaseNodeCard({
  title = '知识库',
  knowledgeBaseName,
  ...props
}: KnowledgeBaseNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="knowledge-base"
      accentColor="#06B6D4"
      icon={<Database />}
      {...props}
    >
      {knowledgeBaseName ? (
        <span className="text-foreground">{knowledgeBaseName}</span>
      ) : (
        <span className="text-muted-foreground">未选择知识库</span>
      )}
    </NodeCard>
  );
}

// ============================================
// 15. Data Source Node (数据源)
// ============================================
interface DataSourceNodeCardProps extends BaseNodeCardProps {
  title?: string;
  dataSourceName?: string;
  queryType?: string;
}

export function DataSourceNodeCard({
  title = '数据源',
  dataSourceName,
  queryType,
  ...props
}: DataSourceNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="data-source"
      accentColor="#06B6D4"
      icon={<Table2 />}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        {dataSourceName && <span className="text-foreground">{dataSourceName}</span>}
        {queryType && <NodeBadge>{queryType}</NodeBadge>}
        {!dataSourceName && !queryType && (
          <span className="text-muted-foreground">未配置数据源</span>
        )}
      </div>
    </NodeCard>
  );
}

// ============================================
// 16. If-Else Node (条件分支)
// ============================================
interface IfElseNodeCardProps extends BaseNodeCardProps {
  title?: string;
  conditionPreview?: string;
  elifCount?: number;
}

export function IfElseNodeCard({
  title = '条件分支',
  conditionPreview,
  elifCount = 0,
  ...props
}: IfElseNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="if-else"
      accentColor="#F59E0B"
      icon={<GitBranch />}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        {conditionPreview && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">IF:</span>
            <NodePreview>{conditionPreview}</NodePreview>
          </div>
        )}
        {elifCount > 0 && <NodeBadge variant="warning">{elifCount} 个 ELIF</NodeBadge>}
      </div>
    </NodeCard>
  );
}

// ============================================
// 17. Iteration Node (迭代)
// ============================================
interface IterationNodeCardProps extends BaseNodeCardProps {
  title?: string;
  inputArrayVariable?: string;
  parallelMode?: boolean;
  isContainer?: boolean;
}

export function IterationNodeCard({
  title = '迭代',
  inputArrayVariable,
  parallelMode = false,
  isContainer = false,
  ...props
}: IterationNodeCardProps) {
  return (
    <div className={isContainer ? 'rounded-lg border-2 border-dashed border-blue-400 p-4' : ''}>
      <NodeCard
        title={title}
        type="iteration"
        accentColor="#3B82F6"
        icon={<RefreshCw />}
        {...props}
      >
        <div className="flex flex-col gap-1.5">
          {inputArrayVariable && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">数组:</span>
              <span className="font-mono text-foreground">{inputArrayVariable}</span>
            </div>
          )}
          {parallelMode && <NodeBadge variant="outline">并行模式</NodeBadge>}
        </div>
      </NodeCard>
      {isContainer && (
        <div className="mt-3 flex h-16 items-center justify-center rounded border border-dashed border-blue-300 bg-blue-50/50 text-xs text-blue-500">
          子节点区域
        </div>
      )}
    </div>
  );
}

// ============================================
// 18. Loop Node (循环)
// ============================================
interface LoopNodeCardProps extends BaseNodeCardProps {
  title?: string;
  variableCount?: number;
  maxIterations?: number;
  isContainer?: boolean;
}

export function LoopNodeCard({
  title = '循环',
  variableCount = 0,
  maxIterations,
  isContainer = false,
  ...props
}: LoopNodeCardProps) {
  return (
    <div className={isContainer ? 'rounded-lg border-2 border-dashed border-purple-400 p-4' : ''}>
      <NodeCard
        title={title}
        type="loop"
        accentColor="#8B5CF6"
        icon={<Repeat />}
        {...props}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <NodeBadge>{variableCount} 个变量</NodeBadge>
          {maxIterations && <NodeBadge variant="outline">最多 {maxIterations} 次</NodeBadge>}
        </div>
      </NodeCard>
      {isContainer && (
        <div className="mt-3 flex h-16 items-center justify-center rounded border border-dashed border-purple-300 bg-purple-50/50 text-xs text-purple-500">
          子节点区域
        </div>
      )}
    </div>
  );
}

// ============================================
// 19. HTTP Request Node (HTTP 请求)
// ============================================
interface HttpRequestNodeCardProps extends BaseNodeCardProps {
  title?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url?: string;
}

export function HttpRequestNodeCard({
  title = 'HTTP 请求',
  method = 'GET',
  url,
  ...props
}: HttpRequestNodeCardProps) {
  const methodVariants: Record<string, 'method-get' | 'method-post' | 'method-put' | 'method-delete'> = {
    GET: 'method-get',
    POST: 'method-post',
    PUT: 'method-put',
    DELETE: 'method-delete',
    PATCH: 'method-put',
  };

  return (
    <NodeCard
      title={title}
      type="http-request"
      accentColor="#EF4444"
      icon={<Globe />}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        <NodeBadge variant={methodVariants[method]}>{method}</NodeBadge>
        {url && <NodePreview mono>{url}</NodePreview>}
      </div>
    </NodeCard>
  );
}

// ============================================
// 20. Tool Node (工具调用)
// ============================================
interface ToolNodeCardProps extends BaseNodeCardProps {
  title?: string;
  toolName?: string;
  paramCount?: number;
}

export function ToolNodeCard({
  title = '工具调用',
  toolName,
  paramCount = 0,
  ...props
}: ToolNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="tool"
      accentColor="#64748B"
      icon={<Wrench />}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        {toolName && <span className="text-foreground">{toolName}</span>}
        <NodeBadge>{paramCount} 个参数</NodeBadge>
      </div>
    </NodeCard>
  );
}

// ============================================
// 21. Human Input Node (人工输入)
// ============================================
interface HumanInputNodeCardProps extends BaseNodeCardProps {
  title?: string;
  prompt?: string;
  timeout?: number;
}

export function HumanInputNodeCard({
  title = '人工输入',
  prompt,
  timeout,
  ...props
}: HumanInputNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="human-input"
      accentColor="#2970FF"
      icon={<UserCheck />}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        {prompt && <NodePreview lines={1}>{prompt}</NodePreview>}
        {timeout && <NodeBadge variant="outline">超时: {timeout}s</NodeBadge>}
      </div>
    </NodeCard>
  );
}

// ============================================
// 22. Webhook Trigger Node (Webhook 触发)
// ============================================
interface WebhookTriggerNodeCardProps extends BaseNodeCardProps {
  title?: string;
  webhookUrl?: string;
}

export function WebhookTriggerNodeCard({
  title = 'Webhook 触发',
  webhookUrl,
  ...props
}: WebhookTriggerNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="trigger-webhook"
      accentColor="#F97316"
      icon={<Webhook />}
      {...props}
    >
      {webhookUrl ? (
        <NodePreview mono>{webhookUrl}</NodePreview>
      ) : (
        <span className="text-muted-foreground">未配置 Webhook</span>
      )}
    </NodeCard>
  );
}

// ============================================
// 23. Schedule Trigger Node (定时触发)
// ============================================
interface ScheduleTriggerNodeCardProps extends BaseNodeCardProps {
  title?: string;
  cronExpression?: string;
  nextRunTime?: string;
}

export function ScheduleTriggerNodeCard({
  title = '定时触发',
  cronExpression,
  nextRunTime,
  ...props
}: ScheduleTriggerNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="trigger-schedule"
      accentColor="#F97316"
      icon={<Clock />}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        {cronExpression && <NodePreview mono>{cronExpression}</NodePreview>}
        {nextRunTime && (
          <div className="text-muted-foreground">
            下次: {nextRunTime}
          </div>
        )}
      </div>
    </NodeCard>
  );
}

// ============================================
// 24. Plugin Trigger Node (插件触发)
// ============================================
interface PluginTriggerNodeCardProps extends BaseNodeCardProps {
  title?: string;
  pluginName?: string;
  version?: string;
}

export function PluginTriggerNodeCard({
  title = '插件触发',
  pluginName,
  version,
  ...props
}: PluginTriggerNodeCardProps) {
  return (
    <NodeCard
      title={title}
      type="trigger-plugin"
      accentColor="#F97316"
      icon={<Puzzle />}
      {...props}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {pluginName && <span className="text-foreground">{pluginName}</span>}
        {version && <NodeBadge variant="outline">v{version}</NodeBadge>}
        {!pluginName && <span className="text-muted-foreground">未选择插件</span>}
      </div>
    </NodeCard>
  );
}

// ============================================
// 25. Note Node (备注) - Special sticky note style
// ============================================
type NoteTheme = 'yellow' | 'blue' | 'green' | 'purple' | 'pink' | 'orange' | 'gray' | 'white';

interface NoteNodeCardProps {
  content?: string;
  theme?: NoteTheme;
  author?: string;
  width?: number;
  height?: number;
}

export function NoteNodeCard({
  content = '',
  theme = 'yellow',
  author,
  width = 200,
  height = 120,
}: NoteNodeCardProps) {
  const themeStyles: Record<NoteTheme, { bg: string; border: string; text: string }> = {
    yellow: { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-900' },
    blue: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-900' },
    green: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-900' },
    purple: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-900' },
    pink: { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-900' },
    orange: { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-900' },
    gray: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-900' },
    white: { bg: 'bg-white', border: 'border-gray-200', text: 'text-gray-900' },
  };

  const styles = themeStyles[theme];

  return (
    <div
      className={`relative rounded-md border shadow-sm ${styles.bg} ${styles.border}`}
      style={{ width, height }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: 'inherit' }}>
        <StickyNote className={`h-4 w-4 ${styles.text}`} />
        <span className={`text-xs font-medium ${styles.text}`}>备注</span>
      </div>

      {/* Content */}
      <div className={`p-3 text-xs ${styles.text}`}>
        <div className="line-clamp-4 whitespace-pre-wrap">{content || '添加备注...'}</div>
      </div>

      {/* Author */}
      {author && (
        <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">
          — {author}
        </div>
      )}

      {/* Resize handle */}
      <div className="absolute bottom-0 right-0 cursor-se-resize p-1 opacity-50 hover:opacity-100">
        <GripVertical className="h-3 w-3 rotate-[-45deg] text-muted-foreground" />
      </div>
    </div>
  );
}

// ============================================
// 26-28. Container Marker Nodes
// ============================================
interface ContainerMarkerNodeCardProps {
  type: 'iteration-start' | 'loop-start' | 'loop-end';
}

export function ContainerMarkerNodeCard({ type }: ContainerMarkerNodeCardProps) {
  const configs: Record<string, { color: string; label: string }> = {
    'iteration-start': { color: '#3B82F6', label: '迭代开始' },
    'loop-start': { color: '#8B5CF6', label: '循环开始' },
    'loop-end': { color: '#8B5CF6', label: '循环结束' },
  };

  const config = configs[type];

  return (
    <div
      className="flex h-8 w-[120px] items-center justify-center rounded border-2 border-dashed text-xs font-medium"
      style={{ borderColor: config.color, color: config.color }}
    >
      {config.label}
    </div>
  );
}
