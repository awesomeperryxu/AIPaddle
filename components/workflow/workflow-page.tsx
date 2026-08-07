'use client';

import { useState, useCallback, useMemo, useRef, useEffect, DragEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ReactFlow, {
  Background,
  BackgroundVariant,
  MiniMap,
  Node,
  Edge,
  Connection,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { WorkflowHeader, OnlineUser } from './header';
import { WorkflowOperator } from './canvas';
import { NodeConfigPanel } from './panels/node-config-panel';
import { BlockSelectorPanel } from './panels/block-selector-panel';
import { VersionHistoryPanel } from './panels/version-history-panel';
import { nodeRegistry } from './nodes/node-registry';
import { BlockEnum } from './types';
import { cn } from '@/lib/utils';
import { Plus, Code2, Activity, Tags, Sparkles, Send, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  graphToReactFlow,
  reactFlowToGraph,
  type PersistedGraph,
  type RFNodeLike,
  type RFEdgeLike,
} from '@/lib/workflow/graph-adapter';
import type { GapResolution } from '@/lib/workflow/capability-gap';
import { describeCron } from '@/lib/workflow/schedule-parse';
import { useTabTitle } from '@/components/tab-title';
import { graphNeedsInput } from '@/lib/workflow/runtime-context';
import { VariableInspectPanel } from './canvas/variable-inspect-panel';
import { KeyboardShortcutsModal } from './modals/keyboard-shortcuts-modal';
import {
  initHistory, pushHistory, isStructurallyEqual,
  canUndo as canUndoHistory, canRedo as canRedoHistory,
  undo as undoHistory, redo as redoHistory,
  type History,
} from '@/lib/workflow/history';
import { layoutGraph } from '@/lib/workflow/layout';
import { WorkflowSubNav, type WorkflowTab } from './pages/workflow-subnav';
import { WorkflowLogsPage } from './pages/workflow-logs-page';
import { WorkflowPlaceholderPage } from './pages/workflow-placeholder-page';
import { WorkflowApiPage } from './pages/workflow-api-page';
import { WorkflowMonitorPage } from './pages/workflow-monitor-page';
import { WorkflowRunDrawer } from './pages/workflow-run-drawer';

// ReactFlow 节点 data 的形状
type WorkflowNodeData = {
  blockType: BlockEnum;
  label?: string;
  description?: string;
};

// if-else 分支出口标签（4.4.8a-2）
function branchLabel(caseId: string): string {
  if (caseId === 'if-true') return 'IF';
  if (caseId === 'else') return 'ELSE';
  const m = /^elif-(\d+)$/.exec(caseId);
  return m ? `ELIF ${m[1]}` : caseId;
}

const HANDLE_CLS = '!w-2.5 !h-2.5 !border-2 !border-background';

// Custom node component - follows design spec:
// - Width: 240px fixed
// - Min height: 80px
// - Border radius: 12px (rounded-xl)
// - Left border: 4px
function WorkflowNode({ data, selected }: { data: WorkflowNodeData; selected: boolean }) {
  const config = nodeRegistry[data.blockType];
  if (!config) return null;

  const Icon = config.icon;
  const bt = String(data.blockType);
  // 入口节点（start 与各类 trigger）没有输入句柄——与 validate.ts 的 isEntry 判定保持一致
  const isStart = bt === 'start' || bt.startsWith('trigger');
  const isEnd = bt === 'end';
  const isIfElse = bt === 'if-else';

  // if-else 分支出口：从 cases 派生（if-true/elif-N + 隐式 else），无配置默认 if-true/else。
  // 每个出口一个带 id 的 source handle → 用户从该出口连线，onConnect 带上 sourceHandle=caseId，
  // reactFlowToGraph 持久化、执行引擎据此路由（见 4.4.8a-1）。
  const cases = (data as WorkflowNodeData & { cases?: Array<{ caseId?: string }> }).cases;
  const caseIds = (Array.isArray(cases) ? cases : [])
    .map((c) => String(c?.caseId ?? ''))
    .filter((id) => id && id !== 'else');
  const branches = caseIds.length ? [...caseIds, 'else'] : ['if-true', 'else'];

  return (
    <div
      className={cn(
        'relative bg-card rounded-xl shadow-sm transition-shadow border border-border',
        selected && 'ring-2 ring-primary shadow-md'
      )}
      style={{
        width: 240,
        minHeight: 80,
        borderLeftWidth: '4px',
        borderLeftColor: config.color,
      }}
    >
      {/* 输入手柄（start 节点无入口） */}
      {!isStart && (
        <Handle type="target" position={Position.Left} className={cn(HANDLE_CLS, '!bg-muted-foreground')} />
      )}

      <div className="p-3 pl-4">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: config.bgColor }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
          </div>
          <span className="text-xs font-medium text-foreground">
            {data.label || config.label}
          </span>
        </div>
        {data.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 ml-8">
            {data.description}
          </p>
        )}
      </div>

      {/* 输出手柄：普通节点单个；if-else 每个分支一个（带 id=caseId + 标签）；end 无出口 */}
      {!isEnd && !isIfElse && (
        <Handle type="source" position={Position.Right} className={cn(HANDLE_CLS, '!bg-primary')} />
      )}
      {isIfElse &&
        branches.map((caseId, i) => (
          <Handle
            key={caseId}
            type="source"
            position={Position.Right}
            id={caseId}
            style={{ top: `${((i + 1) / (branches.length + 1)) * 100}%` }}
            className={cn(HANDLE_CLS, '!bg-primary')}
          >
            <span className="pointer-events-none absolute left-3 -translate-y-1/2 whitespace-nowrap text-[9px] font-medium text-muted-foreground">
              {branchLabel(caseId)}
            </span>
          </Handle>
        ))}
    </div>
  );
}

// Node types for ReactFlow
const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};

// 新建/空图时的默认起始节点（至少一个开始节点）。
function makeDefaultNodes(): Node[] {
  return [
    { id: 'start-1', type: 'workflowNode', position: { x: 250, y: 50 }, data: { blockType: BlockEnum.Start, label: '开始' } },
  ];
}

// 自动体检结论（WF-11）：生成后立刻告诉用户「能不能发布、还差什么」，
// 而不是等他点发布被拒才知道。规则与服务端 lib/workflow/readiness.ts 同源。
type ReadinessLike = {
  ready: boolean;
  checked: number;
  issues: { level: string; nodeLabel?: string; message: string }[];
};

function describeReadiness(r?: ReadinessLike): string {
  if (!r) return '';
  const errs = r.issues.filter((i) => i.level === 'error');
  if (errs.length === 0) {
    const warns = r.issues.length;
    return `🧪 自动体检通过（${r.checked} 个节点）${warns ? ` · ${warns} 项提示` : ''}，可以发布`;
  }
  const lines = errs.slice(0, 4).map((i) => `　• 「${i.nodeLabel}」${i.message}`).join('\n');
  return `🧪 自动体检未通过，${errs.length} 项需处理后才能发布：\n${lines}${errs.length > 4 ? '\n　• …' : ''}`;
}

/**
 * 识别到定时需求时的引导（WF-24）。
 *
 * 🔴 工作流本身不承载定时，但用户说出口的需求不能吞掉——否则他会以为「已经设好了」，
 * 到点没跑才发现。这里明确告诉他这事要去哪配。
 */
function describeScheduleHint(hint?: { cron: string; timezone: string }): string {
  if (!hint) return '';
  const when = hint.cron ? `（${describeCron(hint.cron)}）` : '';
  return `\n⏰ 检测到定时需求${when}：**工作流本身不设定时**——定时以「数字员工 / Agent / 团队」为单位配置，请到该数字员工的「定时作业」里设置。`;
}

// 保存状态（自动保存指示）
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface WorkflowPageInnerProps {
  workflowId?: string;
  /** 加载时的 updated_at（乐观锁基线，WF-28） */
  initialUpdatedAt?: string | null;
  title?: string;
  appType?: 'workflow' | 'chatflow';
  initialGraph?: PersistedGraph;
  onlineUsers?: OnlineUser[];
}

function WorkflowPageInner({
  workflowId,
  title: initialTitle = '未命名工作流',
  appType = 'workflow',
  initialGraph,
  initialUpdatedAt,
  onlineUsers = [],
}: WorkflowPageInnerProps) {
  // 从后端图初始化画布；空图则给一个开始节点
  const initial = useMemo(() => {
    const rf = graphToReactFlow(initialGraph);
    return rf.nodes.length > 0
      ? { nodes: rf.nodes as unknown as Node[], edges: rf.edges as unknown as Edge[] }
      : { nodes: makeDefaultNodes(), edges: [] as Edge[] };
    // 仅首次挂载时按 initialGraph 建画布
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [title, setTitle] = useState(initialTitle);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [headerMode, setHeaderMode] = useState<'normal' | 'restoring' | 'view-history'>('normal');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [toast, setToast] = useState('');
  // WF-4：底部工具栏此前有 6 个按钮点了没反应——onUndo/onRedo/onAutoLayout/
  // onToggleVariableInspect/onOpenShortcuts 五个回调压根没传（onClick=undefined），
  // canUndo/canRedo 还写死 false 把按钮锁成 disabled；评论模式则因为
  // interactionMode 只有 select|pan 两态，comment 被翻译成 select 后回读又变回 pointer。
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan' | 'comment'>('select');
  const [variableInspectOpen, setVariableInspectOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showBlockSelector, setShowBlockSelector] = useState(false);
  const [recentBlocks, setRecentBlocks] = useState<string[]>(['llm', 'code', 'if-else']);

  // ── WF-4 撤销/重做 ────────────────────────────────────────
  // 历史栈放 ref 而非 state：它只在按下按钮时被读，随 state 走会多出一轮渲染，
  // 且 pushHistory 发生在 nodes/edges 的 effect 里，用 state 会自我触发。
  const historyRef = useRef<History<Node, Edge>>(initHistory({ nodes: initial.nodes, edges: initial.edges }));
  // 可用态用 state 承载：render 中读 ref 违反「Cannot access refs during render」，
  // 且 ref 变化不触发重渲染，靠它驱动按钮亮灭本身就不成立
  const [historyFlags, setHistoryFlags] = useState({ undo: false, redo: false });
  const applyingHistory = useRef(false);

  useEffect(() => {
    // 撤销/重做自身触发的 setNodes 不能再次入栈，否则一步撤销要按两次
    if (applyingHistory.current) { applyingHistory.current = false; return; }
    const cur = { nodes, edges };
    if (isStructurallyEqual(historyRef.current.present, cur)) {
      // 结构没变（多半是拖动改坐标）——更新 present 但不入栈，
      // 否则撤销一次只挪回几像素
      historyRef.current = { ...historyRef.current, present: cur };
      return;
    }
    historyRef.current = pushHistory(historyRef.current, cur);
    setHistoryFlags({ undo: canUndoHistory(historyRef.current), redo: canRedoHistory(historyRef.current) });
  }, [nodes, edges]);

  const applySnapshot = useCallback((h: History<Node, Edge>) => {
    applyingHistory.current = true;
    historyRef.current = h;
    setNodes(h.present.nodes);
    setEdges(h.present.edges);
    setHistoryFlags({ undo: canUndoHistory(h), redo: canRedoHistory(h) });
  }, [setNodes, setEdges]);

  const handleUndo = useCallback(() => {
    if (!canUndoHistory(historyRef.current)) return;
    applySnapshot(undoHistory(historyRef.current));
  }, [applySnapshot]);

  const handleRedo = useCallback(() => {
    if (!canRedoHistory(historyRef.current)) return;
    applySnapshot(redoHistory(historyRef.current));
  }, [applySnapshot]);

  const [activeTab, setActiveTab] = useState<WorkflowTab>('orchestrate');
  const [showRunPanel, setShowRunPanel] = useState(false);
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);

  // useReactFlow 必须在 Copilot useEffect 之前（否则 fitView 在声明前被引用）
  const { zoomIn, zoomOut, fitView, getZoom, screenToFlowPosition } = useReactFlow();

  // Copilot 对话栏（PRD 2.11：左画布 + 右 Copilot）
  // ?copilot=<描述> → 自动打开 Copilot 并触发生成（个人助理意图跳转）
  const [copilotAutoDesc] = useState<string | null>(() =>
    typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('copilot') : null,
  );
  const copilotAutoFired = useRef(false);
  const [copilotOpen, setCopilotOpen] = useState(!!copilotAutoDesc);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [copilotLoading, setCopilotLoading] = useState(false);
  // ③ 澄清面板状态
  type ClarificationItem = { field: string; question: string; options?: string[] }
  const [copilotClarifications, setCopilotClarifications] = useState<ClarificationItem[]>([]);
  // 能力缺口（WF-17 find-skill）：流程差什么真实能力、已有资产里有没有能顶上的。
  // 🔴 只做发现与起草，安装/发布始终人工点——不联网拉外部代码（供应链风险）。
  const [gapResolutions, setGapResolutions] = useState<GapResolution[]>([]);
  const [gapBusy, setGapBusy] = useState<string | null>(null);
  // 发布被体检拦住、且其中有可自动修复项时，给一条带按钮的提示（WF-25）
  const [publishFixable, setPublishFixable] = useState(false);
  // WF-28 乐观锁：加载时的 updated_at 作为基线，每次保存成功后前进。
  // 🔴 冲突后必须**停掉自动保存**——否则下一次防抖又会拿旧图去覆盖，等于没锁。
  const baseUpdatedAt = useRef<string | null>(initialUpdatedAt ?? null);
  const [staleConflict, setStaleConflict] = useState(false);
  const copilotScrollRef = useRef<HTMLDivElement>(null);

  // 生成完就地问一句「差什么能力、上哪儿补」，答案直接摆在对话里
  const analyzeGaps = useCallback(async (graph: unknown) => {
    try {
      const res = await fetch('/api/workflows/capability-gaps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', graph }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setGapResolutions(Array.isArray(data.resolutions) ? data.resolutions : []);
    } catch { /* 缺口分析失败不影响主流程，画布上的流程已经生成好了 */ }
  }, []);

  // 一键起草：产出 draft 态 Skill，仍需人工提交审核后才能用
  const draftSkillForGap = useCallback(async (need: string, context: string) => {
    setGapBusy(need);
    try {
      const res = await fetch('/api/workflows/capability-gaps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draft-skill', need, context }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCopilotMessages(prev => [...prev, { role: 'assistant', content: `❌ 起草「${need}」失败：${data?.error?.message ?? '未知原因'}` }]);
        return;
      }
      setCopilotMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ 已起草 Skill「${data.skill.name}」（草稿态）\n　还需你补齐凭证并提交审核，通过后即可挂到这一步上。\n　记录已写入「AI 操作记录」。`,
      }]);
    } catch {
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: '❌ 起草失败：网络错误' }]);
    } finally {
      setGapBusy(null);
    }
  }, []);

  // 自动触发：从 URL ?copilot=<描述> 带入。
  // 不在 useEffect 里同步 setState（React 编译器会报级联渲染），
  // 而是用 useState 初始值设 copilotOpen=true，然后在这个 effect 里异步触发生成。
  useEffect(() => {
    if (!copilotAutoDesc || copilotAutoFired.current) return;
    copilotAutoFired.current = true;
    const desc = copilotAutoDesc;
    // 异步触发，不在同步路径里 setState
    const timer = setTimeout(() => {
      setCopilotMessages([{ role: 'user', content: desc }]);
      setCopilotLoading(true);
      fetch('/api/workflows/copilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, appType }),
      }).then(r => r.json()).then(data => {
        if (data.graph?.nodes?.length > 0) {
          const rf = graphToReactFlow(data.graph);
          setNodes(rf.nodes as unknown as Node[]);
          setEdges(rf.edges as unknown as Edge[]);
          const sched = describeScheduleHint(data.scheduleHint);
          setCopilotMessages(prev => [...prev, { role: 'assistant', content: `✅ 已生成工作流（${data.graph.nodes.length} 个节点）${sched}\n${describeReadiness(data.readiness)}` }]);
          // fitView 延迟调用——不在闭包里直接引用 hook 返回值
          setTimeout(() => { try { fitView({ padding: 0.2 }); } catch {} }, 300);
          void analyzeGaps(data.graph);
        } else {
          setCopilotMessages(prev => [...prev, { role: 'assistant', content: '未能生成有效的工作流，请继续描述。' }]);
        }
      }).catch(() => {
        setCopilotMessages(prev => [...prev, { role: 'assistant', content: '❌ 生成失败' }]);
      }).finally(() => setCopilotLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [copilotAutoDesc, fitView, setNodes, setEdges]);

  async function handleCopilotSend(overrideText?: string) {
    const text = (overrideText ?? copilotInput).trim();
    if (!text || copilotLoading) return;
    if (!overrideText) setCopilotInput('');
    const userMsg = { role: 'user' as const, content: text };
    setCopilotMessages(prev => [...prev, userMsg]);
    setCopilotLoading(true);
    setCopilotClarifications([]);
    try {
      // ⑤ 增量修改：将当前画布图传给 Copilot
      const currentGraph = reactFlowToGraph(nodes as unknown as RFNodeLike[], edges as unknown as RFEdgeLike[]);
      const res = await fetch('/api/workflows/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text, existingGraph: currentGraph, appType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCopilotMessages(prev => [...prev, { role: 'assistant', content: `❌ ${data?.error?.message ?? '生成失败'}` }]);
        return;
      }
      if (data.graph?.nodes?.length > 0) {
        const rf = graphToReactFlow(data.graph);
        setNodes(rf.nodes as unknown as Node[]);
        setEdges(rf.edges as unknown as Edge[]);
        const sched = describeScheduleHint(data.scheduleHint);
        const summary = `✅ 已生成工作流（${data.graph.nodes.length} 个节点）${sched}${data.valid ? '' : `\n⚠️ ${data.validation?.length ?? 0} 处校验问题`}\n${describeReadiness(data.readiness)}`;
        setCopilotMessages(prev => [...prev, { role: 'assistant', content: summary }]);
        setTimeout(() => fitView({ padding: 0.2 }), 300);
        void analyzeGaps(data.graph);
      } else {
        setCopilotMessages(prev => [...prev, { role: 'assistant', content: '未能生成有效的工作流节点，请尝试更具体的描述。' }]);
      }
      // ③ 澄清面板
      if (Array.isArray(data.clarifications) && data.clarifications.length > 0) {
        setCopilotClarifications(data.clarifications);
      }
    } catch {
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: '❌ 网络错误，请重试' }]);
    } finally {
      setCopilotLoading(false);
      setTimeout(() => copilotScrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 100);
    }
  }

  // 版本历史（4.4.10）：真实数据接线
  type WorkflowVersionDto = { id: string; version: number; note: string | null; createdBy: string | null; createdAt: string };
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<WorkflowVersionDto[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  // WF-19：把流程名报给顶部标签条，标签才不是清一色的「工作流 · 详情」。
  // 改名后标签跟着变（title 是 state）；在 dashboard 外的原型路由下 Provider 缺席，自动 no-op。
  useTabTitle(pathname.replace(/^\//, ''), title);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  // 轻量 toast
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  // WF-4 自动整理布局：复用 Copilot 生成时同一套分层算法，
  // 保证「AI 生成的图」与「手工整理后的图」摆放规则一致。
  const handleAutoLayout = useCallback(() => {
    const pos = layoutGraph(
      nodes.map((n) => ({ id: n.id, type: String((n.data as WorkflowNodeData)?.blockType ?? '') })),
      edges.map((e) => ({ source: e.source, target: e.target })),
    );
    setNodes((ns) => ns.map((n) => (pos[n.id] ? { ...n, position: pos[n.id] } : n)));
    // 布局只改坐标，isStructurallyEqual 判定为等价、不进历史栈——
    // 这是刻意的：整理布局不该占用一次撤销
    setTimeout(() => { try { fitView({ padding: 0.2 }); } catch {} }, 50);
    showToast('已按流程走向重新排布');
  }, [nodes, edges, setNodes, fitView, showToast]);

  // WF-4 变量检查：汇总画布上各节点声明的变量，供用户核对引用是否有效
  const inspectedVariables = useMemo(() => {
    return nodes.map((n) => {
      const d = (n.data ?? {}) as WorkflowNodeData & { blockType?: string };
      return {
        id: n.id,
        name: d.label || String(d.blockType ?? n.id),
        sourceNode: d.label || String(d.blockType ?? ''),
        sourceNodeId: n.id,
        type: 'string' as const,
        value: d.description ?? '—',
      };
    });
  }, [nodes]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // 自动保存（防抖）：节点/连线/标题变更 800ms 后 PATCH 保存真实 graph。
  const firstRun = useRef(true);
  useEffect(() => {
    if (!workflowId) return;
    if (firstRun.current) { firstRun.current = false; return; } // 跳过首次挂载
    if (staleConflict) return; // 已冲突：再存就是拿旧图覆盖别人的改动
    const t = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const graph = reactFlowToGraph(nodes as unknown as RFNodeLike[], edges as unknown as RFEdgeLike[]);
        const res = await fetch(`/api/workflows/${workflowId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: title, graph, baseUpdatedAt: baseUpdatedAt.current }),
        });
        if (res.status === 409) {
          // WF-28：库里已被改过。停掉自动保存并挂出提示，别让防抖把对方的改动抹了
          setStaleConflict(true);
          setSaveStatus('error');
          return;
        }
        if (!res.ok) { setSaveStatus('error'); showToast('自动保存失败：无权限或未登录'); return; }
        const { valid, validation, workflow } = await res.json();
        if (workflow?.updatedAtIso) baseUpdatedAt.current = workflow.updatedAtIso; // 基线前进
        setSaveStatus('saved');
        if (!valid && Array.isArray(validation) && validation.length > 0) {
          showToast(`已保存（草稿）· ${validation.length} 处校验问题`);
        }
      } catch { setSaveStatus('error'); showToast('自动保存失败：网络错误'); }
    }, 800);
    return () => clearTimeout(t);
  }, [nodes, edges, title, workflowId, staleConflict, showToast]);

  // 立即保存当前画布（运行前 flush，确保引擎跑的是最新图）
  const saveNow = useCallback(async () => {
    if (!workflowId) return;
    const graph = reactFlowToGraph(nodes as unknown as RFNodeLike[], edges as unknown as RFEdgeLike[]);
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: title, graph, baseUpdatedAt: baseUpdatedAt.current }),
      });
      if (res.status === 409) { setStaleConflict(true); setSaveStatus('error'); return; }
      const body = await res.json().catch(() => ({}));
      if (body?.workflow?.updatedAtIso) baseUpdatedAt.current = body.workflow.updatedAtIso;
      setSaveStatus('saved');
    } catch { /* 运行前保存失败不阻断，交由 /run 报错 */ }
  }, [workflowId, nodes, edges, title]);

  // 发布：先 flush 保存最新图 → POST /publish（非法图 422 拒绝并提示）。
  /**
   * 一键修复体检拦截项（WF-25）。
   * 🔴 拦住却不给出路等于把问题丢回用户——老流程里那个「需接入实时资讯检索能力」的节点，
   * 修法（进节点翻出联网搜索开关）用户根本不知道。修完直接刷新画布并说明改了什么。
   */
  const handleAutoFix = useCallback(async () => {
    if (!workflowId) return;
    try {
      const res = await fetch(`/api/workflows/${workflowId}/autofix`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(body?.error?.message ?? '自动修复失败'); return; }
      const fixes = (body.fixes ?? []) as { nodeLabel: string; action: string }[];
      if (fixes.length === 0) { showToast('没有可自动修复的项，请按提示手动处理'); return; }
      setPublishFixable(false);
      if (body.graph) {
        const rf = graphToReactFlow(body.graph);
        setNodes(rf.nodes as unknown as Node[]);
        setEdges(rf.edges as unknown as Edge[]);
      }
      showToast(`已修复 ${fixes.length} 处：${fixes.map((f) => f.nodeLabel).join('、')}${body.readiness?.ready ? '，现在可以发布了' : ''}`);
    } catch { showToast('自动修复失败：网络错误'); }
  }, [workflowId, showToast, setNodes, setEdges]);

  const handlePublish = useCallback(async () => {
    if (!workflowId) { showToast('请先保存工作流后再发布'); return; }
    try {
      await saveNow();
      const res = await fetch(`/api/workflows/${workflowId}/publish`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setPublishFixable(false);
        showToast(`已发布 v${body.publishedVersion ?? ''} · 已上线`);
      } else if (res.status === 422 && body.readiness?.issues) {
        // WF-11：体检未通过——把「必须处理」的点直接说清楚，别只丢一句发布失败
        const errs = (body.readiness.issues as { level: string; nodeLabel?: string; message: string }[])
          .filter((i) => i.level === 'error');
        showToast(`无法发布（${errs.length} 项待处理）：${errs.slice(0, 2).map((i) => `「${i.nodeLabel}」${i.message}`).join('；')}${errs.length > 2 ? ' …' : ''}`);
        // 其中有能自动修的（如需要联网取数却没开搜索）→ 直接给一键修复入口
        const fixable = errs.filter((i) => (i as { code?: string }).code === 'llm_no_data_source'
          || (i as { code?: string }).code === 'llm_placeholder_capability');
        if (fixable.length > 0) setPublishFixable(true);
      } else if (res.status === 422 && Array.isArray(body.validation)) {
        showToast(`无法发布：${body.validation.map((v: { message: string }) => v.message).join('；')}`);
      } else {
        showToast(body?.error?.message ?? '发布失败：无权限或未登录');
      }
    } catch { showToast('发布失败：网络错误'); }
  }, [workflowId, saveNow, showToast]);

  // 导出 DSL（4.4.12）：拉 /dsl → 下载 .aipaddle.json
  const handleExportDsl = useCallback(async () => {
    if (!workflowId) { showToast('请先保存工作流后再导出'); return; }
    try {
      const res = await fetch(`/api/workflows/${workflowId}/dsl`);
      if (!res.ok) { showToast('导出失败：无权限或未登录'); return; }
      const dsl = await res.json();
      const blob = new Blob([JSON.stringify(dsl, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'workflow'}.aipaddle.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('已导出 DSL');
    } catch { showToast('导出失败：网络错误'); }
  }, [workflowId, title, showToast]);

  // 打开版本历史面板并拉取真实版本列表（GET /api/workflows/{id}/versions）
  const openVersionHistory = useCallback(async () => {
    if (!workflowId) { showToast('请先保存工作流后再查看版本历史'); return; }
    setShowVersionHistory(true);
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/versions`);
      if (!res.ok) { setVersions([]); showToast('加载版本历史失败：无权限或未登录'); return; }
      const { versions: list } = await res.json();
      setVersions(Array.isArray(list) ? (list as WorkflowVersionDto[]) : []);
    } catch { setVersions([]); showToast('加载版本历史失败：网络错误'); }
    finally { setVersionsLoading(false); }
  }, [workflowId, showToast]);

  // 回滚到指定版本：POST restore → 用返回的图重建画布（POST /api/workflows/{id}/versions/{version}/restore）
  const handleRestoreVersion = useCallback(async (versionId: string) => {
    if (!workflowId) return;
    const version = Number(versionId);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/versions/${version}/restore`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(body?.error?.message ?? '回滚失败：无权限或未登录'); return; }
      const graph = body?.workflow?.graph as PersistedGraph | undefined;
      const rf = graphToReactFlow(graph);
      setNodes(rf.nodes as unknown as Node[]);
      setEdges(rf.edges as unknown as Edge[]);
      setSelectedNode(null);
      setShowVersionHistory(false);
      showToast(`已回滚到 v${version}（草稿）`);
    } catch { showToast('回滚失败：网络错误'); }
  }, [workflowId, showToast, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleZoomIn = useCallback(() => {
    zoomIn();
    setZoom(getZoom());
  }, [zoomIn, getZoom]);

  const handleZoomOut = useCallback(() => {
    zoomOut();
    setZoom(getZoom());
  }, [zoomOut, getZoom]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2 });
    setTimeout(() => setZoom(getZoom()), 100);
  }, [fitView, getZoom]);

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        )
      );    },
    [setNodes]
  );

  const handleTitleUpdate = useCallback(
    (nodeId: string, title: string) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, label: title } }
            : node
        )
      );    },
    [setNodes]
  );

  const handleCloseConfigPanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Handle drag over for node dropping
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  // Handle drop to add new node
  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const blockType = event.dataTransfer.getData('application/workflow-block');
      if (!blockType) return;

      // Get drop position
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Get block config
      const config = nodeRegistry[blockType as BlockEnum];
      if (!config) return;

      // Create new node
      const newNode: Node = {
        id: `${blockType}-${Date.now()}`,
        type: 'workflowNode',
        position,
        data: {
          blockType,
          label: config.label,
          description: config.description || '',
        },
      };

      setNodes((nds) => [...nds, newNode]);
      // Update recent blocks
      setRecentBlocks((prev) => {
        const filtered = prev.filter((t) => t !== blockType);
        return [blockType, ...filtered].slice(0, 5);
      });
    },
    [screenToFlowPosition, setNodes]
  );

  // Handle block selection from panel
  const handleBlockSelect = useCallback(
    (blockType: string) => {
      const config = nodeRegistry[blockType as BlockEnum];
      if (!config) return;

      // Add node at center of view
      const newNode: Node = {
        id: `${blockType}-${Date.now()}`,
        type: 'workflowNode',
        position: { x: 300, y: 200 },
        data: {
          blockType,
          label: config.label,
          description: config.description || '',
        },
      };

      setNodes((nds) => [...nds, newNode]);
      // Update recent blocks
      setRecentBlocks((prev) => {
        const filtered = prev.filter((t) => t !== blockType);
        return [blockType, ...filtered].slice(0, 5);
      });
    },
    [setNodes]
  );

  // Convert ReactFlow node to WorkflowNode format for config panel
  const selectedWorkflowNode = useMemo(() => {
    if (!selectedNode) return null;
    return {
      id: selectedNode.id,
      type: selectedNode.data.blockType as BlockEnum,
      title: selectedNode.data.label || '',
      description: selectedNode.data.description,
      position: selectedNode.position,
      data: selectedNode.data,
    };
  }, [selectedNode]);

  // WF-20：这条流程跑起来要不要人填输入？只看显式声明（start 的变量 / sys.query 引用）
  const needsRunInput = useMemo(
    () => graphNeedsInput(reactFlowToGraph(nodes as unknown as RFNodeLike[], edges as unknown as RFEdgeLike[])),
    [nodes, edges],
  );

  // Get all workflow nodes for variable reference
  const allWorkflowNodes = useMemo(() => {
    return nodes.map((node) => ({
      id: node.id,
      type: node.data.blockType as BlockEnum,
      title: node.data.label || '',
      description: node.data.description,
      position: node.position,
      data: node.data,
    }));
  }, [nodes]);

  const showCanvas = activeTab === 'orchestrate';

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <WorkflowHeader
        mode={headerMode}
        title={title}
        hasUnsavedChanges={saveStatus === 'saving' || saveStatus === 'error'}
        onlineUsers={onlineUsers}
        appType={appType}
        canUndo={false}
        canRedo={false}
        onBack={() => router.push('/workflows')}
        onTitleChange={(t) => setTitle(t)}
        onRun={() => {
          if (!workflowId) { showToast('请先保存工作流后再运行'); return; }
          setActiveTab('orchestrate');
          setShowRunPanel(true);
        }}
        onPublish={handlePublish}
        onVersionHistory={openVersionHistory}
        onExportDsl={handleExportDsl}
        onEnvVars={() => showToast('环境变量即将上线（W2）')}
        onConversationVars={() => showToast('会话变量即将上线（W2）')}
        onExitHistory={() => setHeaderMode('normal')}
        onRestoreVersion={() => setHeaderMode('restoring')}
        onCancelRestore={() => setHeaderMode('normal')}
        onConfirmRestore={() => setHeaderMode('normal')}
      />

      {/* 轻量 toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground/90 px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}

      {/* Body：左侧应用子导航 + 当前下级页 */}
      <div className="flex-1 flex overflow-hidden">
        <WorkflowSubNav active={activeTab} appType={appType} onChange={setActiveTab} />

        <div className="flex-1 relative overflow-hidden">
          {/* 编排（画布）：常挂载但非激活时隐藏，避免重挂 ReactFlow 丢状态 */}
          <div className={cn('absolute inset-0 flex', showCanvas ? 'z-10' : 'pointer-events-none opacity-0')}>
            {/* 自动保存指示 */}
            <div className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 text-xs text-muted-foreground">
              {saveStatus === 'saving' && '自动保存中…'}
              {saveStatus === 'saved' && '已自动保存'}
              {saveStatus === 'error' && <span className="text-destructive">保存失败</span>}
            </div>

            {/* WF-28：库里已被别处改过，自动保存已停。给出唯一安全的出路——刷新。
                🔴 不提供「强行覆盖」按钮：这条路径的典型场景是后台修复或另一个窗口，
                覆盖掉的往往正是刚修好的东西。 */}
            {staleConflict && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs shadow-md">
                <span className="text-destructive">
                  这条工作流已被别处更新（另一个窗口或后台修复），<b>自动保存已暂停</b>，以免覆盖对方的改动
                </span>
                <Button size="sm" className="h-6 text-[11px]" onClick={() => window.location.reload()}>
                  刷新载入最新
                </Button>
              </div>
            )}

            {/* 体检拦住了发布、但其中有能自动修的（WF-25）——给出路，别让用户自己去翻节点配置 */}
            {publishFixable && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs shadow-md dark:bg-amber-950/60">
                <span className="text-amber-900 dark:text-amber-200">
                  有步骤需要联网取数却没开「联网搜索」，可一键修好
                </span>
                <Button size="sm" className="h-6 text-[11px]" onClick={handleAutoFix}>一键修复</Button>
                <button
                  className="text-amber-700/70 hover:text-amber-900 dark:text-amber-300/70"
                  onClick={() => setPublishFixable(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* ReactFlow Canvas */}
            <div
              className="flex-1 relative"
              ref={reactFlowWrapper}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <ReactFlow
                data-testid="canvas"
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                panOnDrag={interactionMode === 'pan'}
                selectionOnDrag={interactionMode === 'select'}
                // 评论模式下不让拖动改图，避免看批注时误改流程
                nodesDraggable={interactionMode !== 'comment'}
                nodesConnectable={interactionMode !== 'comment'}
                fitView
                fitViewOptions={{ padding: 0.2 }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={16}
                  size={1.5}
                  color="var(--canvas-dot-color)"
                  style={{ backgroundColor: 'var(--canvas-bg)' }}
                />
                <MiniMap
                  className="!bottom-16 !right-4 !rounded-xl !border !border-gray-200 !shadow-lg"
                  nodeColor={(node) => {
                    const config = nodeRegistry[node.data.blockType as BlockEnum];
                    return config?.color || '#64748B';
                  }}
                  maskColor="rgba(0, 0, 0, 0.1)"
                  style={{ width: 150, height: 100 }}
                />
              </ReactFlow>

              {/* Floating Add Node Button */}
              <Button
                onClick={() => setShowBlockSelector(true)}
                className="absolute top-4 left-4 z-10 shadow-md"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                添加节点
              </Button>

              {/* Bottom Operator Bar */}
              <WorkflowOperator
                zoom={Math.round(zoom * 100)}
                // 三态直传，不再把 comment 折成 select（折了之后回读永远是 pointer，
                // 点评论模式看起来毫无反应）
                mode={interactionMode === 'pan' ? 'hand' : interactionMode === 'comment' ? 'comment' : 'pointer'}
                onModeChange={(m) => setInteractionMode(m === 'hand' ? 'pan' : m === 'comment' ? 'comment' : 'select')}
                canUndo={historyFlags.undo}
                canRedo={historyFlags.redo}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onAutoLayout={handleAutoLayout}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onZoomReset={() => setZoom(1)}
                onFitView={handleFitView}
                variableInspectOpen={variableInspectOpen}
                onToggleVariableInspect={() => setVariableInspectOpen((v) => !v)}
                onOpenShortcuts={() => setShortcutsOpen(true)}
              />

              {/* WF-4：两个面板此前已实现却从未被挂载，按钮自然点不出东西 */}
              <VariableInspectPanel
                isOpen={variableInspectOpen}
                onClose={() => setVariableInspectOpen(false)}
                variables={inspectedVariables}
              />
            </div>

            <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

            {/* Copilot Toggle Button */}
            <Button
              onClick={() => setCopilotOpen(!copilotOpen)}
              className="absolute top-4 right-4 z-10 shadow-md gap-1.5"
              size="sm"
              variant={copilotOpen ? 'default' : 'outline'}
            >
              <Sparkles className="h-4 w-4" />
              AI 编排
            </Button>

            {/* Copilot 对话栏 */}
            {copilotOpen && (
              <div className="absolute top-0 right-0 bottom-0 w-80 z-20 bg-card border-l border-border flex flex-col shadow-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">AI 编排助手</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCopilotOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div ref={copilotScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {copilotMessages.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-8 space-y-2">
                      <Sparkles className="h-8 w-8 mx-auto text-primary/30" />
                      <p>用自然语言描述你想要的工作流</p>
                      <p className="text-[11px]">例如：「收到客户邮件后，AI 分类并分配给对应部门」</p>
                    </div>
                  )}
                  {copilotMessages.map((msg, i) => (
                    <div key={i} className={`text-xs leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'text-foreground bg-muted/40 rounded-lg p-2.5' : 'text-muted-foreground'}`}>
                      {msg.content}
                    </div>
                  ))}
                  {copilotLoading && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      生成中...
                    </div>
                  )}
                </div>
                {/* 能力缺口（WF-17）：差什么、已有资产里有没有能顶上的、没有就一键起草。
                    安装与发布不在这里做——起草出来的是 draft，仍要人工提审。 */}
                {gapResolutions.length > 0 && (
                  <div className="px-3 py-2 border-t border-sky-500/30 bg-sky-500/5 space-y-2.5 max-h-56 overflow-y-auto">
                    <p className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                      这条流程还差 {gapResolutions.length} 项能力：
                    </p>
                    {gapResolutions.map((r) => (
                      <div key={r.gap.nodeId} className="space-y-1">
                        <p className="text-xs text-foreground/80">{r.gap.message}</p>
                        {r.candidates.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">已有可用：</span>
                            {r.candidates.map((c) => (
                              <span
                                key={`${c.source}-${c.id}`}
                                className="text-[11px] px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                title={c.description}
                              >
                                {c.name}
                                <span className="ml-1 opacity-60">
                                  {c.source === 'mcp' ? 'MCP' : c.status === 'published' ? 'Skill' : 'Skill·草稿'}
                                </span>
                              </span>
                            ))}
                            <span className="text-[10px] text-muted-foreground">（在节点配置里挂上即可）</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">工作区里没有现成能力</span>
                            <button
                              disabled={gapBusy === r.gap.need}
                              onClick={() => draftSkillForGap(r.gap.need, r.gap.nodeLabel)}
                              className="text-[11px] px-2 py-0.5 rounded-full border border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:bg-sky-500/25 transition-colors disabled:opacity-50"
                            >
                              {gapBusy === r.gap.need ? '起草中…' : `一键起草「${r.gap.need}」Skill`}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground">
                      起草的 Skill 为草稿态，需补齐凭证并提交审核后才能使用；系统不会自动安装外部能力。
                    </p>
                  </div>
                )}
                {/* ③ 澄清面板 */}
                {copilotClarifications.length > 0 && (
                  <div className="px-3 py-2 border-t border-amber-500/30 bg-amber-500/5 space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">需要补充以下信息：</p>
                    {copilotClarifications.map((c, i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-xs text-foreground/80">{c.question}</p>
                        {c.options && c.options.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {c.options.map((opt, j) => (
                              <button key={j}
                                className="text-[11px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                                onClick={() => handleCopilotSend(`${c.field}：${opt}`)}
                              >{opt}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-3 border-t border-border">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/60 outline-none focus:border-primary/50"
                      placeholder={copilotClarifications.length > 0 ? '回答上面的问题，或继续描述...' : '描述你想要的流程...'}
                      value={copilotInput}
                      onChange={e => setCopilotInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCopilotSend(); } }}
                      disabled={copilotLoading}
                    />
                    <Button size="sm" className="h-9 px-3" disabled={!copilotInput.trim() || copilotLoading} onClick={() => handleCopilotSend()}>
                      {copilotLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Block Selector Panel */}
            <BlockSelectorPanel
              appType={appType}
              isOpen={showBlockSelector}
              onClose={() => setShowBlockSelector(false)}
              onSelect={handleBlockSelect}
              recentBlocks={recentBlocks}
            />

            {/* Right Config Panel */}
            {selectedWorkflowNode && (
              <NodeConfigPanel
                node={selectedWorkflowNode}
                allNodes={allWorkflowNodes}
                appType={appType}
                onUpdate={handleNodeUpdate}
                onTitleChange={handleTitleUpdate}
                onClose={handleCloseConfigPanel}
              />
            )}
          </div>

          {/* 其它下级页 */}
          {activeTab === 'logs' && workflowId && (
            <div className="absolute inset-0 z-10"><WorkflowLogsPage key={logsRefreshKey} workflowId={workflowId} /></div>
          )}
          {activeTab === 'api' && (
            <div className="absolute inset-0 z-10">
              {workflowId ? (
                <WorkflowApiPage workflowId={workflowId} />
              ) : (
                <WorkflowPlaceholderPage
                  icon={Code2}
                  title="访问 API"
                  desc="保存工作流后即可生成对外调用的 API 端点与文档。"
                  bullets={['先保存工作流以生成调用端点']}
                />
              )}
            </div>
          )}
          {activeTab === 'monitor' && (
            <div className="absolute inset-0 z-10">
              {workflowId ? (
                <WorkflowMonitorPage workflowId={workflowId} />
              ) : (
                <WorkflowPlaceholderPage
                  icon={Activity}
                  title="监测"
                  desc="保存并运行工作流后，这里展示调用次数、成功率、平均耗时与趋势。"
                  bullets={['先保存并测试运行以产生指标']}
                />
              )}
            </div>
          )}
          {activeTab === 'annotations' && (
            <div className="absolute inset-0 z-10">
              <WorkflowPlaceholderPage
                icon={Tags}
                title="标注"
                desc="对话回复的人工标注：标注优质回复、命中率统计与标注库管理（仅 Chatflow）。"
                bullets={['人工标注回复', '标注命中率', '标注库管理']}
              />
            </div>
          )}

          {/* 版本历史面板（4.4.10）：真实数据；恢复即回滚重建画布 */}
          <VersionHistoryPanel
            isOpen={showVersionHistory}
            isLoading={versionsLoading}
            onClose={() => setShowVersionHistory(false)}
            currentUserId={undefined}
            versions={versions.map((v) => ({
              id: String(v.version),
              number: v.version,
              description: v.note ?? '',
              createdAt: new Date(v.createdAt.replace(' ', 'T')),
              createdBy: { id: v.createdBy ?? '', name: v.createdBy ? v.createdBy.slice(0, 8) : '未知' },
            }))}
            onRestore={handleRestoreVersion}
          />

          {/* 测试运行抽屉（右侧覆盖） */}
          {workflowId && (
            <WorkflowRunDrawer
              workflowId={workflowId}
              open={showRunPanel}
              needsInput={needsRunInput}
              beforeRun={saveNow}
              onClose={() => setShowRunPanel(false)}
              onFinished={() => setLogsRefreshKey((k) => k + 1)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export interface WorkflowPageProps {
  workflowId?: string;
  /** 加载时的 updated_at（乐观锁基线，WF-28） */
  initialUpdatedAt?: string | null;
  title?: string;
  appType?: 'workflow' | 'chatflow';
  initialGraph?: PersistedGraph;
  onlineUsers?: OnlineUser[];
}

export function WorkflowPage(props: WorkflowPageProps) {
  return (
    <ReactFlowProvider>
      <WorkflowPageInner {...props} />
    </ReactFlowProvider>
  );
}
