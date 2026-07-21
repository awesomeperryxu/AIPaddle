'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  Search,
  GitBranch,
  Play,
  Settings,
  CheckCircle,
  MessageSquare,
  Database,
  Bot,
  FileText,
  Upload,
  Copy,
  Trash2,
  MoreHorizontal,
  Tag,
  ChevronRight,
  Code,
  Globe,
  FileCode,
  Sparkles,
  ArrowLeft,
  Save,
  Undo2,
  Redo2,
  History,
  Variable,
  Braces,
  Type,
  List,
  X,
  CircleDot,
  Square,
  Diamond,
  PanelLeftClose,
  PanelLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MousePointer2,
  Hand,
  GripVertical,
  Trash,
  Download,
  AlertTriangle,
  XCircle,
  Clock,
  Send,
  Lock,
  LucideIcon
} from 'lucide-react';

// App types following Dify's structure
type AppType = 'all' | 'workflow' | 'chatflow' | 'agent' | 'text-generation';
type NodeType = 'start' | 'end' | 'llm' | 'knowledge' | 'code' | 'condition' | 'variable' | 'http' | 'template' | 'iteration' | 'parameter-extractor' | 'question-classifier';

interface WorkflowApp {
  id: string;
  name: string;
  description: string;
  type: 'workflow' | 'chatflow' | 'agent' | 'text-generation';
  tags: string[];
  lastEditedBy: string;
  lastEditedAt: string;
  status: 'draft' | 'published' | 'offline';
  executions: number;
  successRate: number;
}

// Node types for workflow editor
interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  position: { x: number; y: number };
  config?: Record<string, unknown>;
}

// Connection between nodes
interface NodeConnection {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

const mockApps: WorkflowApp[] = [
  {
    id: '1',
    name: 'Github热榜日报',
    description: '自动抓取Github热榜并生成每日报告',
    type: 'workflow',
    tags: ['自动化', '日报'],
    lastEditedBy: 'PERRY',
    lastEditedAt: '2026/05/04 00:17',
    status: 'published',
    executions: 1234,
    successRate: 98.5
  },
  {
    id: '2',
    name: '代码转换器',
    description: '提供多种代码语言转换能力，将用户输入的代码转换成他们需要的代码语言',
    type: 'workflow',
    tags: ['代码', '转换'],
    lastEditedBy: 'PERRY',
    lastEditedAt: '2026/05/03 23:57',
    status: 'published',
    executions: 567,
    successRate: 95.2
  },
  {
    id: '3',
    name: '每日行业分析报告',
    description: '关于家居行业的分析',
    type: 'text-generation',
    tags: ['分析', '报告'],
    lastEditedBy: 'PERRY',
    lastEditedAt: '2026/04/29 22:15',
    status: 'published',
    executions: 89,
    successRate: 100
  },
  {
    id: '4',
    name: '智能客服助手',
    description: '处理用户咨询和问题解答的智能对话流程',
    type: 'chatflow',
    tags: ['客服', '对话'],
    lastEditedBy: 'Alice',
    lastEditedAt: '2026/05/02 14:30',
    status: 'published',
    executions: 3456,
    successRate: 97.8
  },
  {
    id: '5',
    name: '数据分析 Agent',
    description: '自主完成数据分析任务的智能 Agent',
    type: 'agent',
    tags: ['数据', 'Agent'],
    lastEditedBy: 'Bob',
    lastEditedAt: '2026/05/01 10:20',
    status: 'draft',
    executions: 0,
    successRate: 0
  }
];

const appTypeConfig = {
  workflow: { label: '工作流', icon: GitBranch, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  chatflow: { label: 'Chatflow', icon: MessageSquare, color: 'text-green-500', bg: 'bg-green-500/10' },
  agent: { label: 'Agent', icon: Bot, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  'text-generation': { label: '文本生成', icon: FileText, color: 'text-orange-500', bg: 'bg-orange-500/10' }
};

const statusConfig = {
  draft: { label: '草稿', className: 'bg-muted text-muted-foreground' },
  published: { label: '已发布', className: 'bg-green-500/10 text-green-500' },
  offline: { label: '已下线', className: 'bg-destructive/10 text-destructive' }
};

// Node type configurations for the editor
const nodeTypeConfig: Record<NodeType, { label: string; icon: LucideIcon; color: string; borderColor: string; category: string }> = {
  start: { label: '开始', icon: CircleDot, color: 'bg-green-500', borderColor: 'border-green-500', category: 'basic' },
  end: { label: '结束', icon: Square, color: 'bg-orange-500', borderColor: 'border-orange-500', category: 'basic' },
  llm: { label: 'LLM', icon: Sparkles, color: 'bg-blue-500', borderColor: 'border-blue-500', category: 'ai' },
  knowledge: { label: '知识检索', icon: Database, color: 'bg-purple-500', borderColor: 'border-purple-500', category: 'ai' },
  code: { label: '代码执行', icon: Code, color: 'bg-gray-500', borderColor: 'border-gray-500', category: 'integration' },
  condition: { label: 'IF/ELSE', icon: Diamond, color: 'bg-yellow-500', borderColor: 'border-yellow-500', category: 'logic' },
  variable: { label: '变量赋值', icon: Variable, color: 'bg-cyan-500', borderColor: 'border-cyan-500', category: 'logic' },
  http: { label: 'HTTP 请求', icon: Globe, color: 'bg-pink-500', borderColor: 'border-pink-500', category: 'integration' },
  template: { label: '模板转换', icon: FileCode, color: 'bg-indigo-500', borderColor: 'border-indigo-500', category: 'integration' },
  iteration: { label: '迭代', icon: List, color: 'bg-teal-500', borderColor: 'border-teal-500', category: 'logic' },
  'parameter-extractor': { label: '参数提取器', icon: Braces, color: 'bg-rose-500', borderColor: 'border-rose-500', category: 'ai' },
  'question-classifier': { label: '问题分类器', icon: Tag, color: 'bg-amber-500', borderColor: 'border-amber-500', category: 'ai' }
};

// Node categories for sidebar
const nodeCategories = [
  { id: 'basic', label: '基础节点', types: ['start', 'end'] as NodeType[] },
  { id: 'ai', label: 'AI 节点', types: ['llm', 'knowledge', 'question-classifier', 'parameter-extractor'] as NodeType[] },
  { id: 'logic', label: '逻辑节点', types: ['condition', 'iteration', 'variable'] as NodeType[] },
  { id: 'integration', label: '集成节点', types: ['code', 'http', 'template'] as NodeType[] }
];

// Initial workflow nodes
const initialWorkflowNodes: WorkflowNode[] = [
  { id: 'start-1', type: 'start', label: '开始', position: { x: 250, y: 50 } },
  { id: 'llm-1', type: 'llm', label: 'LLM', description: '调用大语言模型处理用户输入', position: { x: 250, y: 180 } },
  { id: 'end-1', type: 'end', label: '结束', position: { x: 250, y: 340 } }
];

// Initial connections
const initialConnections: NodeConnection[] = [
  { id: 'conn-1', sourceId: 'start-1', targetId: 'llm-1' },
  { id: 'conn-2', sourceId: 'llm-1', targetId: 'end-1' }
];

// ===== 编辑器功能面板 mock 数据（原型对齐，纯前端演示）=====

type RunStatus = 'succeeded' | 'failed' | 'skipped';
interface RunStep {
  node: string;
  status: RunStatus;
  ms: number;
  tokens: number;
  detail: string;
  sub?: string[];
}
interface RunResult {
  status: 'succeeded' | 'failed';
  elapsed: string;
  tokens: number;
  cost: string;
  started: string;
  input: string;
  output: string;
  steps: RunStep[];
}

const runResultOk: RunResult = {
  status: 'succeeded',
  elapsed: '3.42s',
  tokens: 2841,
  cost: '¥0.0312',
  started: '2026-07-17 11:24:05',
  input: '{ "query": "昨天 Github Trending 前 5 名" }',
  output: '{ "report": "## Github 热榜日报（07-16）\n1. deepseek-ai/Janus — 14.2k ★ …" }',
  steps: [
    { node: '开始', status: 'succeeded', ms: 2, tokens: 0, detail: '输入变量校验通过' },
    { node: 'HTTP 请求', status: 'succeeded', ms: 486, tokens: 0, detail: 'GET https://api.github.com/trending → 200，重试 0/3' },
    { node: '列表操作', status: 'succeeded', ms: 4, tokens: 0, detail: '取 Top 5，按 stars 降序' },
    { node: '迭代 ×5', status: 'succeeded', ms: 1730, tokens: 1968, detail: '5/5 项成功 · 并行度 3 · 子节点：LLM 摘要', sub: ['第 1 项 · 342ms · 402 tok ✓', '第 2 项 · 371ms · 396 tok ✓', '第 3 项 · 355ms · 388 tok ✓', '第 4 项 · 348ms · 391 tok ✓', '第 5 项 · 314ms · 391 tok ✓'] },
    { node: 'LLM 汇总', status: 'succeeded', ms: 1140, tokens: 873, detail: 'GPT-4-Turbo · temp 0.3 · 输出 812 字' },
    { node: '模板转换', status: 'succeeded', ms: 6, tokens: 0, detail: 'Markdown 日报模板渲染' },
    { node: '结束', status: 'succeeded', ms: 1, tokens: 0, detail: '输出 report (string)' }
  ]
};

const runResultFail: RunResult = {
  status: 'failed',
  elapsed: '10.87s',
  tokens: 402,
  cost: '¥0.0044',
  started: '2026-07-17 10:02:41',
  input: '{ "query": "昨日热榜" }',
  output: 'HTTPError: 503 Service Unavailable（已重试 3 次，间隔 1000ms）',
  steps: [
    { node: '开始', status: 'succeeded', ms: 2, tokens: 0, detail: '输入变量校验通过' },
    { node: 'HTTP 请求', status: 'failed', ms: 10462, tokens: 0, detail: '503 × 4 次（重试 3/3 已用尽）· 错误处理：无 → 流程中断' },
    { node: '列表操作', status: 'skipped', ms: 0, tokens: 0, detail: '未执行' }
  ]
};

interface WorkflowVersion {
  ver: string;
  time: string;
  author: string;
  tag: 'draft' | 'published' | '';
}
const workflowVersions: WorkflowVersion[] = [
  { ver: '当前草稿', time: '2026-07-17 11:20', author: '你', tag: 'draft' },
  { ver: 'v12', time: '2026-05-04 00:17', author: 'PERRY', tag: 'published' },
  { ver: 'v11', time: '2026-05-03 22:40', author: 'PERRY', tag: '' },
  { ver: 'v10', time: '2026-05-01 16:08', author: 'Alice', tag: '' },
  { ver: 'v9', time: '2026-04-28 10:33', author: 'PERRY', tag: '' }
];

interface EnvVar { name: string; type: string; secret: boolean; value: string; }
const envVars: EnvVar[] = [
  { name: 'API_BASE_URL', type: 'string', secret: false, value: 'https://api.pinqi.cn/v1' },
  { name: 'GITHUB_TOKEN', type: 'secret', secret: true, value: 'ghp_************3f8a' },
  { name: 'MAX_RETRY', type: 'number', secret: false, value: '3' }
];

interface ConvVar { name: string; type: string; def: string; desc: string; refs: number; }
const convVars: ConvVar[] = [
  { name: 'user_intent', type: 'string', def: '""', desc: '最近一次识别的用户意图', refs: 3 },
  { name: 'order_no', type: 'string', def: '""', desc: '会话中提取的订单号', refs: 2 },
  { name: 'retry_count', type: 'number', def: '0', desc: '澄清追问次数', refs: 1 }
];

interface SysVar { name: string; type: string; desc: string; }
const sysVars: SysVar[] = [
  { name: 'sys.query', type: 'string', desc: '用户最新输入' },
  { name: 'sys.files', type: 'array[file]', desc: '用户上传的文件' },
  { name: 'sys.user_id', type: 'string', desc: '用户唯一标识' },
  { name: 'sys.conversation_id', type: 'string', desc: '会话 ID（Chatflow）' },
  { name: 'sys.dialogue_count', type: 'number', desc: '对话轮次（Chatflow）' },
  { name: 'sys.timestamp', type: 'number', desc: '触发时间戳' }
];

interface ChecklistItem { label: string; ok: boolean; }
const publishChecklist: ChecklistItem[] = [
  { label: '所有节点均已连接', ok: true },
  { label: 'LLM 节点已配置模型与提示词', ok: true },
  { label: 'End 节点已声明输出变量', ok: true },
  { label: 'HTTP 请求缺少失败分支（建议配置错误处理）', ok: false },
  { label: '插件依赖：serpapi ≥ 1.2 已安装', ok: true }
];

interface ChatMsg { role: 'user' | 'flow' | 'assistant'; content: string; time: string; }
const chatPreviewMsgs: ChatMsg[] = [
  { role: 'user', content: '帮我查一下订单 ORD-2026-0715 到哪了', time: '11:26:01' },
  { role: 'flow', content: '问题分类器 → 订单查询分支 · 参数提取器 → order_no = "ORD-2026-0715"', time: '11:26:02' },
  { role: 'assistant', content: '您的订单 ORD-2026-0715 正在配送中 🚚\n当前位置：杭州转运中心\n预计送达：明天 12:00 前\n\n对话变量已更新：conversation.order_no = ORD-2026-0715', time: '11:26:03' }
];

type EditorPanel = 'run' | 'versions' | 'vars' | 'preview' | null;

export function WorkflowView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<AppType>('all');
  // 个人助理意图跳转（切片2）：?assistant=<描述> → 初始即打开创建应用对话框
  const searchParams = useSearchParams();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(() => !!searchParams.get('assistant'));
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<WorkflowApp | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [canvasTool, setCanvasTool] = useState<'select' | 'pan'>('select');

  // 节点库搜索（本地过滤）
  const [nodeSearch, setNodeSearch] = useState('');

  // 编辑器右侧功能面板
  const [activePanel, setActivePanel] = useState<EditorPanel>(null);
  const [runTab, setRunTab] = useState<'result' | 'detail' | 'trace'>('result');
  const [runCase, setRunCase] = useState<'ok' | 'fail'>('ok');
  const [varsTab, setVarsTab] = useState<'env' | 'conv' | 'sys'>('env');
  const [chatInput, setChatInput] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 打开功能面板：清空节点选择，避免右侧配置面板与功能面板同时出现
  const openPanel = useCallback((panel: Exclude<EditorPanel, null>) => {
    setActivePanel(panel);
    setSelectedNode(null);
    if (panel === 'run') setRunTab('result');
    if (panel === 'vars') setVarsTab('env');
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const isChatflow = selectedApp?.type === 'chatflow';
  const runResult = runCase === 'ok' ? runResultOk : runResultFail;
  
  // Workflow state
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>(initialWorkflowNodes);
  const [connections, setConnections] = useState<NodeConnection[]>(initialConnections);
  
  // Drag state
  const [draggingNode, setDraggingNode] = useState<WorkflowNode | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDraggingFromSidebar, setIsDraggingFromSidebar] = useState(false);
  const [draggingNodeType, setDraggingNodeType] = useState<NodeType | null>(null);
  const [isOverCanvas, setIsOverCanvas] = useState(false);
  
  // Canvas state
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // ── 4.4.1：真实数据接线（列表/创建/加载/保存）───────────────
  const [apps, setApps] = useState<WorkflowApp[]>([]);
  const [appsLoaded, setAppsLoaded] = useState(false);

  const mapItemToApp = useCallback((w: {
    id: string; name: string; type: 'workflow' | 'chatflow'; status: 'draft' | 'published'; updatedAt?: string;
  }): WorkflowApp => ({
    id: w.id, name: w.name, description: '', type: w.type, tags: [],
    lastEditedBy: '', lastEditedAt: w.updatedAt ?? '', status: w.status, executions: 0, successRate: 0,
  }), []);

  const reloadApps = useCallback(async () => {
    try {
      const res = await fetch('/api/workflows');
      if (res.ok) {
        const { workflows } = await res.json();
        setApps((workflows ?? []).map(mapItemToApp));
      }
    } catch { /* 忽略：保持已有列表 */ }
    setAppsLoaded(true);
  }, [mapItemToApp]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/workflows');
        if (res.ok && active) {
          const { workflows } = await res.json();
          setApps((workflows ?? []).map(mapItemToApp));
        }
      } catch { /* 忽略：保持已有列表 */ }
      if (active) setAppsLoaded(true);
    })();
    return () => { active = false; };
  }, [mapItemToApp]);

  // 编辑器状态 ↔ 后端 graph 互转
  const buildGraph = useCallback(() => ({
    nodes: workflowNodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: { label: n.label, description: n.description, config: n.config } })),
    edges: connections.map(c => ({ id: c.id, source: c.sourceId, target: c.targetId })),
  }), [workflowNodes, connections]);

  const loadGraphIntoEditor = useCallback((graph: { nodes?: unknown[]; edges?: unknown[] }) => {
    const gn = Array.isArray(graph?.nodes) ? graph.nodes as Array<Record<string, unknown>> : [];
    const ge = Array.isArray(graph?.edges) ? graph.edges as Array<Record<string, unknown>> : [];
    if (gn.length > 0) {
      setWorkflowNodes(gn.map((n) => {
        const data = (n.data ?? {}) as Record<string, unknown>;
        return {
          id: String(n.id), type: n.type as NodeType,
          label: String(data.label ?? n.type ?? ''), description: data.description as string | undefined,
          position: (n.position ?? { x: 250, y: 50 }) as { x: number; y: number },
          config: data.config as Record<string, unknown> | undefined,
        };
      }));
      setConnections(ge.map((e) => ({ id: String(e.id ?? `${e.source}-${e.target}`), sourceId: String(e.source), targetId: String(e.target) })));
    }
  }, []);

  const filteredApps = (appsLoaded ? apps : mockApps).filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || app.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleEditWorkflow = async (app: WorkflowApp) => {
    setSelectedApp(app);
    setIsEditorOpen(true);
    setSelectedNode(null);
    setActivePanel(null);
    // 4.4.1：从后端加载真实图（刷新后画布原样恢复）；失败则回退初始节点
    setWorkflowNodes(initialWorkflowNodes);
    setConnections(initialConnections);
    try {
      const res = await fetch(`/api/workflows/${app.id}`);
      if (res.ok) {
        const { workflow } = await res.json();
        loadGraphIntoEditor(workflow.graph ?? { nodes: [], edges: [] });
      }
    } catch { /* 回退初始节点 */ }
  };

  // 创建空白应用（Workflow / Chatflow）— 原型创建对话框前两个入口
  const handleCreateBlank = async (type: 'workflow' | 'chatflow') => {
    setIsCreateDialogOpen(false);
    const name = type === 'chatflow' ? '新建 Chatflow' : '新建工作流';
    // 4.4.1：真实创建（POST），拿到真实 id 后进编辑器
    let id = 'new';
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      });
      if (res.ok) { id = (await res.json()).workflow.id; }
      else { showToast('创建失败：无权限或未登录'); return; }
    } catch { showToast('创建失败：网络错误'); return; }
    setSelectedApp({
      id, name, description: '', type, tags: [], lastEditedBy: 'You',
      lastEditedAt: new Date().toLocaleString('zh-CN'), status: 'draft', executions: 0, successRate: 0,
    });
    setWorkflowNodes([{ id: 'start-1', type: 'start', label: '开始', position: { x: 250, y: 50 } }]);
    setConnections([]);
    setSelectedNode(null);
    setActivePanel(null);
    setIsEditorOpen(true);
    void reloadApps();
  };

  // 4.4.1：保存工作流图（PATCH），返回校验结果则提示（孤立节点/环等）
  const [isSaving, setIsSaving] = useState(false);
  const handleSaveWorkflow = async () => {
    if (!selectedApp || selectedApp.id === 'new') { showToast('请先创建工作流'); return; }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workflows/${selectedApp.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph: buildGraph() }),
      });
      if (!res.ok) { showToast('保存失败：无权限或未登录'); return; }
      const { valid, validation } = await res.json();
      if (valid) showToast('已保存 · 图结构校验通过');
      else showToast(`已保存（草稿）· 图有 ${validation.length} 处问题：${validation.map((v: { message: string }) => v.message).join('；')}`);
      void reloadApps();
    } catch { showToast('保存失败：网络错误'); }
    finally { setIsSaving(false); }
  };

  // Generate unique node ID
  const generateNodeId = useCallback((type: NodeType) => {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Handle drag start from sidebar
  const handleSidebarDragStart = useCallback((e: React.DragEvent, nodeType: NodeType) => {
    setIsDraggingFromSidebar(true);
    setDraggingNodeType(nodeType);
    e.dataTransfer.setData('nodeType', nodeType);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Handle drag end from sidebar
  const handleSidebarDragEnd = useCallback(() => {
    setIsDraggingFromSidebar(false);
    setDraggingNodeType(null);
    setIsOverCanvas(false);
  }, []);

  // Handle canvas drag over
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsOverCanvas(true);
  }, []);

  // Handle canvas drag leave
  const handleCanvasDragLeave = useCallback(() => {
    setIsOverCanvas(false);
  }, []);

  // Handle drop on canvas
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType') as NodeType;
    
    if (nodeType && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scale = zoomLevel / 100;
      const x = (e.clientX - rect.left - canvasOffset.x) / scale;
      const y = (e.clientY - rect.top - canvasOffset.y) / scale;
      
      const newNode: WorkflowNode = {
        id: generateNodeId(nodeType),
        type: nodeType,
        label: nodeTypeConfig[nodeType].label,
        position: { x: x - 100, y: y - 30 }, // Center the node on drop position
      };
      
      setWorkflowNodes(prev => [...prev, newNode]);
      setSelectedNode(newNode);
      setActivePanel(null);
    }
    
    setIsDraggingFromSidebar(false);
    setDraggingNodeType(null);
    setIsOverCanvas(false);
  }, [canvasOffset, zoomLevel, generateNodeId]);

  // Handle node drag start on canvas
  const handleNodeDragStart = useCallback((e: React.MouseEvent, node: WorkflowNode) => {
    if (canvasTool !== 'select') return;
    
    e.stopPropagation();
    const scale = zoomLevel / 100;
    setDraggingNode(node);
    setDragOffset({
      x: e.clientX - node.position.x * scale - canvasOffset.x,
      y: e.clientY - node.position.y * scale - canvasOffset.y
    });
    setSelectedNode(node);
    setActivePanel(null);
  }, [canvasTool, zoomLevel, canvasOffset]);

  // Handle mouse move for node dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingNode && canvasRef.current) {
      const scale = zoomLevel / 100;
      const newX = (e.clientX - dragOffset.x - canvasOffset.x) / scale;
      const newY = (e.clientY - dragOffset.y - canvasOffset.y) / scale;
      
      setWorkflowNodes(prev => prev.map(n => 
        n.id === draggingNode.id 
          ? { ...n, position: { x: Math.max(0, newX), y: Math.max(0, newY) } }
          : n
      ));
    }
    
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setCanvasOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [draggingNode, dragOffset, canvasOffset, zoomLevel, isPanning, panStart]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setDraggingNode(null);
    setIsPanning(false);
  }, []);

  // Handle canvas mouse down for panning
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (canvasTool === 'pan' || e.button === 1) { // Middle mouse button or pan tool
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [canvasTool]);

  // Delete selected node
  const handleDeleteNode = useCallback(() => {
    if (selectedNode) {
      setWorkflowNodes(prev => prev.filter(n => n.id !== selectedNode.id));
      setConnections(prev => prev.filter(c => c.sourceId !== selectedNode.id && c.targetId !== selectedNode.id));
      setSelectedNode(null);
    }
  }, [selectedNode]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNode && selectedNode.type !== 'start') {
          handleDeleteNode();
        }
      }
      if (e.key === 'Escape') {
        setSelectedNode(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, handleDeleteNode]);

  // Calculate SVG path for connections
  const getConnectionPath = useCallback((source: WorkflowNode, target: WorkflowNode) => {
    const nodeWidth = 240; // 设计规范节点宽度
    const nodeHeight = 80; // 设计规范节点最小高度
    const sourceX = source.position.x + nodeWidth / 2; // Center of node
    const sourceY = source.position.y + nodeHeight; // Bottom of node
    const targetX = target.position.x + nodeWidth / 2;
    const targetY = target.position.y; // Top of node
    
    const midY = (sourceY + targetY) / 2;
    
    return `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
  }, []);

  // Workflow Editor View
  if (isEditorOpen && selectedApp) {
    return (
      <div className="flex flex-col h-full bg-background -m-6">
        {/* Editor Header */}
        <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setIsEditorOpen(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${appTypeConfig[selectedApp.type].bg} flex items-center justify-center`}>
                {(() => {
                  const IconComponent = appTypeConfig[selectedApp.type].icon;
                  return <IconComponent className={`h-4 w-4 ${appTypeConfig[selectedApp.type].color}`} />;
                })()}
              </div>
              <div>
                <h1 className="text-sm font-medium text-foreground">{selectedApp.name}</h1>
                <p className="text-xs text-muted-foreground">编辑于 {selectedApp.lastEditedAt}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => openPanel('versions')}
            >
              <History className="h-4 w-4" />
              版本
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => openPanel('vars')}
            >
              <Variable className="h-4 w-4" />
              变量
            </Button>
            {isChatflow && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => openPanel('preview')}
              >
                <MessageSquare className="h-4 w-4" />
                对话预览
              </Button>
            )}
            {/* DSL 导入 / 导出菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => showToast('DSL 导入：解析 YAML → 校验节点/插件依赖 → 生成画布（原型模拟）')}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  导入 DSL（YAML）
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => showToast(`已导出 ${selectedApp?.name ?? ''}.yml（DSL v0.5）`)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  导出 DSL（YAML）
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="h-4 w-px bg-border mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8" title="撤销 ⌘Z">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="重做 ⇧⌘Z">
              <Redo2 className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => openPanel('run')}
            >
              <Play className="h-4 w-4" />
              运行
            </Button>
            {/* 4.4.1：保存（图校验 + 持久化，刷新后可恢复）*/}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSaveWorkflow} disabled={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? '保存中…' : '保存'}
            </Button>
            {/* 发布 · 带发布前检查清单 */}
            <DropdownMenu open={publishOpen} onOpenChange={setPublishOpen}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Save className="h-4 w-4" />
                  发布
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">发布前检查清单</h4>
                <div className="space-y-2 mb-3">
                  {publishChecklist.map((c) => (
                    <div key={c.label} className="flex items-start gap-2">
                      {c.ok ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      )}
                      <span className="text-xs text-foreground leading-relaxed">{c.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setPublishOpen(false)}
                  >
                    先去修复
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setPublishOpen(false);
                      showToast('已发布新版本 v13 · 线上流量已切换');
                    }}
                  >
                    仍要发布
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Node Library */}
          <div className={`border-r border-border bg-card transition-all duration-200 ${isSidebarCollapsed ? 'w-12' : 'w-60'}`}>
            <div className="h-10 border-b border-border flex items-center justify-between px-3">
              {!isSidebarCollapsed && (
                <span className="text-xs font-medium text-muted-foreground">
                  节点库（{Object.keys(nodeTypeConfig).length} 种）
                </span>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                {isSidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            </div>
            {!isSidebarCollapsed && (
              <>
                <div className="px-3 pt-2.5">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="搜索节点..."
                      value={nodeSearch}
                      onChange={(e) => setNodeSearch(e.target.value)}
                      className="h-7 pl-7 text-xs bg-muted/40"
                    />
                  </div>
                </div>
              <ScrollArea className="h-[calc(100%-72px)]">
                <div className="p-3 space-y-4">
                  {nodeCategories
                    .map((category) => ({
                      ...category,
                      types: category.types.filter((type) => {
                        const q = nodeSearch.trim().toLowerCase();
                        if (!q) return true;
                        return nodeTypeConfig[type].label.toLowerCase().includes(q) || type.includes(q);
                      })
                    }))
                    .filter((category) => category.types.length > 0)
                    .map((category) => (
                    <div key={category.id}>
                      <p className="text-xs font-medium text-muted-foreground mb-2">{category.label}</p>
                      <div className="space-y-1">
                        {category.types.map((type) => {
                          const config = nodeTypeConfig[type];
                          return (
                            <div
                              key={type}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-grab active:cursor-grabbing transition-colors select-none"
                              draggable
                              onDragStart={(e) => handleSidebarDragStart(e, type)}
                              onDragEnd={handleSidebarDragEnd}
                            >
                              <GripVertical className="h-3 w-3 text-muted-foreground" />
                              <div className={`w-5 h-5 rounded ${config.color}/20 flex items-center justify-center`}>
                                <config.icon className={`h-3 w-3 ${config.color.replace('bg-', 'text-')}`} />
                              </div>
                              <span className="text-sm text-foreground">{config.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  
                  {/* Drag hint */}
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                      拖拽到画布添加 · ⌘C/⌘V 复制粘贴 · Delete 删除
                    </p>
                  </div>
                </div>
              </ScrollArea>
              </>
            )}
          </div>

          {/* Canvas Area */}
          <div 
            className={`flex-1 relative overflow-hidden ${isOverCanvas && isDraggingFromSidebar ? 'bg-primary/5' : 'bg-muted/30'}`}
            style={{ cursor: canvasTool === 'pan' ? 'grab' : 'default' }}
          >
            {/* Canvas Toolbar */}
            <div className="absolute top-3 left-3 flex items-center gap-1 bg-card border border-border rounded-lg p-1 shadow-sm z-10">
              <Button 
                variant={canvasTool === 'select' ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setCanvasTool('select')}
              >
                <MousePointer2 className="h-4 w-4" />
              </Button>
              <Button 
                variant={canvasTool === 'pan' ? 'secondary' : 'ghost'} 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setCanvasTool('pan')}
              >
                <Hand className="h-4 w-4" />
              </Button>
            </div>

            {/* Zoom Controls */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-card border border-border rounded-lg p-1 shadow-sm z-10">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoomLevel(Math.max(25, zoomLevel - 25))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center">{zoomLevel}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoomLevel(100)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Node count indicator */}
            <div className="absolute top-3 right-3 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm z-10">
              <span className="text-xs text-muted-foreground">{workflowNodes.length} 个节点</span>
            </div>

            {/* Drop zone hint when dragging */}
            {isDraggingFromSidebar && (
              <div className="absolute inset-4 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center pointer-events-none z-10">
                <div className="bg-card px-4 py-2 rounded-lg shadow-lg">
                  <p className="text-sm text-primary font-medium">释放以添加 {draggingNodeType && nodeTypeConfig[draggingNodeType].label} 节点</p>
                </div>
              </div>
            )}

            {/* Workflow Canvas */}
            <div 
              ref={canvasRef}
              className="absolute inset-0 overflow-hidden"
              onDragOver={handleCanvasDragOver}
              onDragLeave={handleCanvasDragLeave}
              onDrop={handleCanvasDrop}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div 
                className="absolute inset-0"
                style={{ 
                  backgroundColor: 'var(--canvas-bg, #F9FAFB)',
                  backgroundImage: 'radial-gradient(circle, var(--canvas-dot-color, #D1D5DB) 1px, transparent 1px)',
                  backgroundSize: `${20 * zoomLevel / 100}px ${20 * zoomLevel / 100}px`,
                  backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`
                }}
              >
                <div 
                  className="relative"
                  style={{ 
                    transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoomLevel / 100})`,
                    transformOrigin: '0 0',
                    width: '3000px',
                    height: '2000px'
                  }}
                >
                  {/* SVG for connections */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                    {connections.map((conn) => {
                      const sourceNode = workflowNodes.find(n => n.id === conn.sourceId);
                      const targetNode = workflowNodes.find(n => n.id === conn.targetId);
                      if (!sourceNode || !targetNode) return null;
                      
                      return (
                        <g key={conn.id}>
                          <path
                            d={getConnectionPath(sourceNode, targetNode)}
                            fill="none"
                            stroke="var(--border)"
                            strokeWidth="2"
                            className="transition-colors"
                          />
                          {/* Arrow marker */}
                          <circle
                            cx={targetNode.position.x + 100}
                            cy={targetNode.position.y - 4}
                            r="3"
                            fill="var(--border)"
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Render workflow nodes */}
                  {workflowNodes.map((node) => {
                    const config = nodeTypeConfig[node.type];
                    const isSelected = selectedNode?.id === node.id;
                    const isDragging = draggingNode?.id === node.id;
                    
                    return (
                      <div
                        key={node.id}
                        className={`absolute transition-shadow ${isDragging ? 'z-50' : 'z-10'} ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                        style={{ 
                          left: node.position.x, 
                          top: node.position.y,
                          cursor: canvasTool === 'select' ? (isDragging ? 'grabbing' : 'grab') : 'default'
                        }}
                        onMouseDown={(e) => handleNodeDragStart(e, node)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(node);
                          setActivePanel(null);
                        }}
                      >
                        {/* Start/End nodes - 设计规范: 240px宽, 80px高, rounded-xl */}
                        {(node.type === 'start' || node.type === 'end') ? (
                          <div 
                            className="relative flex items-center gap-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                            style={{ width: 240, minHeight: 80 }}
                          >
                            {/* 左侧边框条 4px */}
                            <div 
                              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                              style={{ backgroundColor: config.borderColor?.replace('/40', '') || config.color.replace('bg-', '#') }}
                            />
                            <div className="flex items-center gap-3 p-4 pl-5">
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${config.color.replace('bg-', '')}20` }}
                              >
                                <config.icon className={`h-4 w-4 ${config.color.replace('bg-', 'text-')}`} />
                              </div>
                              <span className="text-xs font-medium text-foreground">{config.label}</span>
                            </div>
                            {/* Connection handles */}
                            {node.type === 'start' && (
                              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-border hover:border-primary transition-colors" />
                            )}
                            {node.type === 'end' && (
                              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-border hover:border-primary transition-colors" />
                            )}
                          </div>
                        ) : (
                          <div 
                            className="relative bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                            style={{ width: 240, minHeight: 80 }}
                          >
                            {/* 左侧边框条 4px */}
                            <div 
                              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                              style={{ backgroundColor: config.borderColor?.replace('/40', '') || config.color.replace('bg-', '#') }}
                            />
                            <div className="p-3 pl-4">
                              <div className="flex items-center gap-2 mb-1">
                                <div 
                                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                                  style={{ backgroundColor: `${config.color.replace('bg-', '')}20` }}
                                >
                                  <config.icon className={`h-3.5 w-3.5 ${config.color.replace('bg-', 'text-')}`} />
                                </div>
                                <span className="text-xs font-medium text-foreground">{config.label}</span>
                              </div>
                              {node.description && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2 ml-8">{node.description}</p>
                              )}
                            </div>
                            
                            {/* Connection handles */}
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-border hover:border-primary transition-colors" />
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-border hover:border-primary transition-colors" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Node Config - 设计规范: 380px */}
          {selectedNode && !activePanel && (
            <div className="border-l border-border bg-card shadow-xl" style={{ width: 380 }}>
              <div className="h-10 border-b border-gray-200 flex items-center justify-between px-3">
                <span className="text-xs font-medium text-muted-foreground">节点配置</span>
                <div className="flex items-center gap-1">
                  {selectedNode.type !== 'start' && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={handleDeleteNode}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedNode(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[calc(100%-40px)]">
                <div className="p-4 space-y-4">
                  {/* Node Type */}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${nodeTypeConfig[selectedNode.type].color}/20 flex items-center justify-center`}>
                      {(() => {
                        const IconComponent = nodeTypeConfig[selectedNode.type].icon;
                        return <IconComponent className={`h-5 w-5 ${nodeTypeConfig[selectedNode.type].color.replace('bg-', 'text-')}`} />;
                      })()}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-foreground">{nodeTypeConfig[selectedNode.type].label}</h3>
                      <p className="text-xs text-muted-foreground">节点 ID: {selectedNode.id.slice(0, 12)}...</p>
                    </div>
                  </div>

                  {/* Position info */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">X 坐标</Label>
                      <Input 
                        type="number" 
                        value={Math.round(selectedNode.position.x)} 
                        onChange={(e) => {
                          const x = parseInt(e.target.value) || 0;
                          setWorkflowNodes(prev => prev.map(n => 
                            n.id === selectedNode.id ? { ...n, position: { ...n.position, x } } : n
                          ));
                        }}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Y 坐标</Label>
                      <Input 
                        type="number" 
                        value={Math.round(selectedNode.position.y)} 
                        onChange={(e) => {
                          const y = parseInt(e.target.value) || 0;
                          setWorkflowNodes(prev => prev.map(n => 
                            n.id === selectedNode.id ? { ...n, position: { ...n.position, y } } : n
                          ));
                        }}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>

                  {/* Node specific configuration */}
                  {selectedNode.type === 'llm' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">模型</Label>
                        <Select defaultValue="gpt-4">
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4">GPT-4</SelectItem>
                            <SelectItem value="gpt-3.5">GPT-3.5 Turbo</SelectItem>
                            <SelectItem value="claude-3">Claude 3 Opus</SelectItem>
                            <SelectItem value="qwen">通义千问</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">系统提示词</Label>
                        <Textarea 
                          className="min-h-[100px] text-xs" 
                          placeholder="输入系统提示词..."
                          defaultValue="你是一个专业的助手，请根据用户的输入提供准确的回答。"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">用户输入</Label>
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border border-border">
                          <Variable className="h-4 w-4 text-cyan-500" />
                          <span className="text-xs text-foreground">{'{{input}}'}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'knowledge' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">知识库</Label>
                        <Select defaultValue="kb-1">
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kb-1">产品文档知识库</SelectItem>
                            <SelectItem value="kb-2">FAQ 知识库</SelectItem>
                            <SelectItem value="kb-3">技术文档</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">检索模式</Label>
                        <Select defaultValue="hybrid">
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="semantic">语义检索</SelectItem>
                            <SelectItem value="keyword">关键词检索</SelectItem>
                            <SelectItem value="hybrid">混合检索</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">返回数量</Label>
                        <Input type="number" defaultValue={5} className="h-7 text-xs" />
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'condition' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">条件表达式</Label>
                        <Textarea 
                          className="min-h-[80px] text-xs font-mono" 
                          placeholder="输入条件表达式..."
                          defaultValue="{{result.score}} > 0.8"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">分支</Label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-md border border-green-500/30">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-xs text-foreground">IF 条件为真</span>
                          </div>
                          <div className="flex items-center gap-2 p-2 bg-muted rounded-md border border-border">
                            <X className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-foreground">ELSE 条件为假</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'code' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">编程语言</Label>
                        <Select defaultValue="python">
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="python">Python 3</SelectItem>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">代码</Label>
                        <Textarea 
                          className="min-h-[150px] text-xs font-mono" 
                          placeholder="输入代码..."
                          defaultValue={`def main(input):
    # 处理输入
    result = process(input)
    return {"output": result}`}
                        />
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'http' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">请求方法</Label>
                        <Select defaultValue="GET">
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">请求地址</Label>
                        <Input 
                          className="h-8 text-xs font-mono" 
                          placeholder="https://api.example.com/endpoint"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">请求头</Label>
                        <Textarea 
                          className="min-h-[60px] text-xs font-mono" 
                          placeholder='{"Content-Type": "application/json"}'
                        />
                      </div>
                    </>
                  )}

                  {/* Output Variables (for applicable nodes) */}
                  {selectedNode.type !== 'start' && selectedNode.type !== 'end' && (
                    <div className="space-y-2 pt-4 border-t border-border">
                      <Label className="text-xs">输出变量</Label>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border border-border">
                          <Type className="h-4 w-4 text-blue-500" />
                          <span className="text-xs text-foreground">text</span>
                          <span className="text-xs text-muted-foreground ml-auto">String</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border border-border">
                          <Braces className="h-4 w-4 text-purple-500" />
                          <span className="text-xs text-foreground">metadata</span>
                          <span className="text-xs text-muted-foreground ml-auto">Object</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* 功能面板 · 运行调试 */}
          {activePanel === 'run' && (
            <div className="border-l border-border bg-card flex flex-col" style={{ width: 420 }}>
              <div className="border-b border-border p-3 px-4">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-sm font-semibold text-foreground">运行调试</h3>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant={runCase === 'ok' ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setRunCase('ok')}
                    >
                      成功示例
                    </Button>
                    <Button
                      variant={runCase === 'fail' ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setRunCase('fail')}
                    >
                      失败示例
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setActivePanel(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Tabs value={runTab} onValueChange={(v) => setRunTab(v as 'result' | 'detail' | 'trace')}>
                  <TabsList className="h-7 w-full bg-muted/50">
                    <TabsTrigger value="result" className="flex-1 text-xs">结果</TabsTrigger>
                    <TabsTrigger value="detail" className="flex-1 text-xs">详情</TabsTrigger>
                    <TabsTrigger value="trace" className="flex-1 text-xs">追踪</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-3">
                  <div
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${runResult.status === 'succeeded' ? 'bg-green-500/10' : 'bg-destructive/10'}`}
                  >
                    <span className={`text-sm font-semibold ${runResult.status === 'succeeded' ? 'text-green-500' : 'text-destructive'}`}>
                      {runResult.status === 'succeeded' ? '运行成功' : '运行失败'}
                    </span>
                    <span className="text-xs text-muted-foreground">{runResult.started}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 rounded-md bg-muted/40 text-center">
                      <p className="text-sm font-semibold text-foreground">{runResult.elapsed}</p>
                      <p className="text-[11px] text-muted-foreground">耗时</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/40 text-center">
                      <p className="text-sm font-semibold text-foreground">{runResult.tokens.toLocaleString('en-US')}</p>
                      <p className="text-[11px] text-muted-foreground">Tokens</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/40 text-center">
                      <p className="text-sm font-semibold text-foreground">{runResult.cost}</p>
                      <p className="text-[11px] text-muted-foreground">成本</p>
                    </div>
                  </div>

                  {runTab === 'result' && (
                    <>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">INPUT</p>
                        <pre className="p-2.5 rounded-md bg-muted/50 text-[11px] text-foreground font-mono whitespace-pre-wrap break-all">{runResult.input}</pre>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">OUTPUT</p>
                        <pre className={`p-2.5 rounded-md bg-muted/50 text-[11px] font-mono whitespace-pre-wrap break-all ${runResult.status === 'succeeded' ? 'text-green-500' : 'text-destructive'}`}>{runResult.output}</pre>
                      </div>
                    </>
                  )}

                  {runTab === 'detail' && (
                    <div className="space-y-1.5">
                      {runResult.steps.map((s, i) => (
                        <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-muted/[0.35]">
                          <span className="text-sm text-foreground flex-1 min-w-0 truncate">{s.node}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">{s.ms}ms · {s.tokens} tok</span>
                          {s.status === 'succeeded' ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          ) : s.status === 'failed' ? (
                            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {runTab === 'trace' && (
                    <div className="space-y-2">
                      {runResult.steps.map((s, i) => (
                        <div
                          key={i}
                          className="px-3 py-2.5 rounded-md bg-muted/[0.35] border-l-[3px]"
                          style={{ borderLeftColor: s.status === 'succeeded' ? '#22c55e' : s.status === 'failed' ? 'var(--destructive)' : '#94a3b8' }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {s.status === 'succeeded' ? (
                              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            ) : s.status === 'failed' ? (
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span className="text-sm font-medium text-foreground">{s.node}</span>
                            <span className="text-[11px] text-muted-foreground ml-auto">{s.ms}ms</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{s.detail}</p>
                          {s.sub && s.sub.length > 0 && (
                            <div className="mt-1.5 pl-2.5 border-l border-border space-y-1">
                              {s.sub.map((sub, j) => (
                                <p key={j} className="text-[11px] text-muted-foreground font-mono">{sub}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* 功能面板 · 版本历史 */}
          {activePanel === 'versions' && (
            <div className="border-l border-border bg-card flex flex-col" style={{ width: 340 }}>
              <div className="h-11 border-b border-border flex items-center justify-between px-4">
                <h3 className="text-sm font-semibold text-foreground">版本历史</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setActivePanel(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3 space-y-2">
                  {workflowVersions.map((v) => (
                    <div key={v.ver} className="px-3 py-2.5 rounded-lg border border-border bg-muted/[0.25]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-foreground">{v.ver}</span>
                        {v.tag === 'draft' && <Badge className="bg-primary/15 text-primary text-[10px] px-1.5 py-0">编辑中</Badge>}
                        {v.tag === 'published' && <Badge className="bg-green-500/15 text-green-500 text-[10px] px-1.5 py-0">线上版本</Badge>}
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto h-6 px-2 text-[11px] text-primary border-primary/35"
                          onClick={() => showToast(`已恢复到 ${v.ver}（生成新草稿，不影响线上版本）`)}
                        >
                          恢复
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">{v.author} · {v.time}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* 功能面板 · 变量管理 */}
          {activePanel === 'vars' && (
            <div className="border-l border-border bg-card flex flex-col" style={{ width: 380 }}>
              <div className="border-b border-border p-3 px-4">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-sm font-semibold text-foreground">变量管理</h3>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setActivePanel(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Tabs value={varsTab} onValueChange={(v) => setVarsTab(v as 'env' | 'conv' | 'sys')}>
                  <TabsList className="h-7 w-full bg-muted/50">
                    <TabsTrigger value="env" className="flex-1 text-xs">环境变量</TabsTrigger>
                    <TabsTrigger value="conv" className="flex-1 text-xs">对话变量</TabsTrigger>
                    <TabsTrigger value="sys" className="flex-1 text-xs">系统变量</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-2">
                  {varsTab === 'env' && (
                    <>
                      {envVars.map((ev) => (
                        <div key={ev.name} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-muted/[0.35] border border-border">
                          <span className="w-6 h-6 rounded bg-primary/15 flex items-center justify-center shrink-0">
                            <Lock className="h-3 w-3 text-primary" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-foreground font-mono">{ev.name}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{ev.value}</p>
                          </div>
                          {ev.secret && <Badge className="bg-amber-500/15 text-amber-500 text-[10px] px-1.5 py-0 shrink-0">加密</Badge>}
                          <span className="text-[11px] text-muted-foreground shrink-0">{ev.type}</span>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        className="w-full h-8 gap-1.5 text-[13px] border-dashed"
                        onClick={() => showToast('新增环境变量（secret 类型加密存储，导出 DSL 时脱敏）')}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        新增环境变量
                      </Button>
                    </>
                  )}
                  {varsTab === 'conv' && (
                    <>
                      <p className="text-xs text-muted-foreground mb-1">Chatflow 专属 · 跨轮次持久化 · 重命名自动更新节点引用</p>
                      {convVars.map((cv) => (
                        <div key={cv.name} className="px-3 py-2.5 rounded-lg bg-muted/[0.35] border border-border">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-foreground font-mono">conversation.{cv.name}</span>
                            <span className="text-[11px] text-muted-foreground">{cv.type}</span>
                            <Badge className="ml-auto bg-teal-500/15 text-teal-500 text-[10px] px-1.5 py-0">{cv.refs} 处引用</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{cv.desc} · 默认 {cv.def}</p>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        className="w-full h-8 gap-1.5 text-[13px] border-dashed"
                        onClick={() => showToast('新增对话变量；重命名会自动更新 3 处节点引用（影响分析）')}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        新增对话变量
                      </Button>
                    </>
                  )}
                  {varsTab === 'sys' && (
                    <>
                      <p className="text-xs text-muted-foreground mb-1">全局只读，所有节点可引用</p>
                      {sysVars.map((sv) => (
                        <div key={sv.name} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/[0.35]">
                          <span className="text-[13px] text-foreground font-mono shrink-0">{sv.name}</span>
                          <span className="text-[11px] text-teal-500 shrink-0">{sv.type}</span>
                          <span className="text-xs text-muted-foreground ml-auto text-right">{sv.desc}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* 功能面板 · 对话预览（仅 Chatflow） */}
          {activePanel === 'preview' && (
            <div className="border-l border-border bg-card flex flex-col" style={{ width: 400 }}>
              <div className="h-11 border-b border-border flex items-center justify-between px-4">
                <h3 className="text-sm font-semibold text-foreground">
                  对话预览 <span className="text-[11px] font-normal text-muted-foreground">流式输出 · 当前草稿</span>
                </h3>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setActivePanel(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 flex flex-col gap-3">
                  {chatPreviewMsgs.map((m, i) => {
                    if (m.role === 'user') {
                      return (
                        <div key={i} className="self-end max-w-[85%]">
                          <div className="px-3 py-2.5 rounded-xl rounded-br-sm bg-primary">
                            <p className="text-[13px] text-primary-foreground whitespace-pre-wrap leading-relaxed">{m.content}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground text-right mt-1">{m.time}</p>
                        </div>
                      );
                    }
                    if (m.role === 'flow') {
                      return (
                        <div key={i} className="self-stretch px-2.5 py-2 rounded-md bg-teal-500/[0.08] border border-dashed border-teal-500/35">
                          <p className="text-[11px] text-teal-500 font-mono leading-relaxed">⚙ {m.content}</p>
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="self-start max-w-[85%]">
                        <div className="px-3 py-2.5 rounded-xl rounded-bl-sm bg-muted/50 border border-border">
                          <p className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{m.time}</p>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-border flex gap-2">
                <Input
                  placeholder="输入消息测试当前流程..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && chatInput.trim()) {
                      setChatInput('');
                      showToast('对话预览：消息已发送（流式输出模拟）');
                    }
                  }}
                  className="flex-1 h-9 text-[13px]"
                />
                <Button
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    if (chatInput.trim()) {
                      setChatInput('');
                      showToast('对话预览：消息已发送（流式输出模拟）');
                    }
                  }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Toast 提示（原型模拟反馈） */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-[400] flex items-center gap-2 rounded-lg border border-green-500/40 bg-card px-4 py-3 shadow-2xl">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-[13px] text-foreground">{toast}</span>
          </div>
        )}
      </div>
    );
  }

  // Workspace List View (Dify-style)
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">工作室</h1>
          <p className="text-sm text-muted-foreground mt-0.5">创建和管理 AI 应用工作流</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              创建应用
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>创建应用</DialogTitle>
              <DialogDescription>选择创建方式开始构建你的 AI 应用</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {/* ① Workflow（批处理 / API） */}
              <div
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => handleCreateBlank('workflow')}
              >
                <div className="w-11 h-11 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <GitBranch className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Workflow（批处理 / API）</h3>
                  <p className="text-sm text-muted-foreground">以 End 节点输出，支持 Webhook / 定时 / 插件触发</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
              {/* ② Chatflow（对话场景） */}
              <div
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => handleCreateBlank('chatflow')}
              >
                <div className="w-11 h-11 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Chatflow（对话场景）</h3>
                  <p className="text-sm text-muted-foreground">以 Answer 节点流式输出，支持多轮上下文与对话变量</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
              {/* ③ 导入 DSL 文件 */}
              <div
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  showToast('DSL 导入：解析 YAML → 校验节点/插件依赖 → 生成画布（原型模拟）');
                }}
              >
                <div className="w-11 h-11 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-teal-500" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">导入 DSL 文件</h3>
                  <p className="text-sm text-muted-foreground">导入 YAML 格式的工作流配置</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
            </div>
            {/* Drop zone */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">拖放 DSL（.yml）文件到此处创建应用</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Type Filter Tabs */}
      <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as AppType)} className="w-full">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="bg-muted/50 h-9">
            <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
            <TabsTrigger value="workflow" className="text-xs gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              工作流
            </TabsTrigger>
            <TabsTrigger value="chatflow" className="text-xs gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Chatflow
            </TabsTrigger>
            <TabsTrigger value="agent" className="text-xs gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              Agent
            </TabsTrigger>
            <TabsTrigger value="text-generation" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              文本生成
            </TabsTrigger>
          </TabsList>
          
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索应用..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-card border-border"
            />
          </div>
        </div>

        {/* Apps Grid */}
        <TabsContent value={selectedType} className="mt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApps.map((app) => {
              const typeConfig = appTypeConfig[app.type];
              return (
                <Card 
                  key={app.id} 
                  className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group"
                  onClick={() => handleEditWorkflow(app)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${typeConfig.bg} flex items-center justify-center`}>
                          <typeConfig.icon className={`h-5 w-5 ${typeConfig.color}`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">{app.name}</h3>
                          <p className="text-xs text-muted-foreground">{typeConfig.label}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            设置
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="h-4 w-4 mr-2" />
                            复制
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Upload className="h-4 w-4 mr-2" />
                            导出
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3 min-h-[40px]">
                      {app.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {app.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
                          {tag}
                        </Badge>
                      ))}
                      <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                        <Plus className="h-3 w-3 mr-0.5" />
                        添加标签
                      </Button>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{app.lastEditedBy}</span>
                        <span>·</span>
                        <span>编辑于 {app.lastEditedAt}</span>
                      </div>
                      <Badge className={statusConfig[app.status].className}>
                        {statusConfig[app.status].label}
                      </Badge>
                    </div>

                    {/* Stats */}
                    {app.executions > 0 && (
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          {app.executions.toLocaleString()} 次执行
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {app.successRate}% 成功率
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Toast 提示（原型模拟反馈） */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[400] flex items-center gap-2 rounded-lg border border-green-500/40 bg-card px-4 py-3 shadow-2xl">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-[13px] text-foreground">{toast}</span>
        </div>
      )}
    </div>
  );
}
