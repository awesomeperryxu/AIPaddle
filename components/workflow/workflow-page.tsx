'use client';

import { useState, useCallback, useMemo, useRef, useEffect, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  Background,
  BackgroundVariant,
  MiniMap,
  Node,
  Edge,
  Connection,
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
import { nodeRegistry } from './nodes/node-registry';
import { BlockEnum } from './types';
import { cn } from '@/lib/utils';
import { Plus, Code2, Activity, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  graphToReactFlow,
  reactFlowToGraph,
  type PersistedGraph,
  type RFNodeLike,
  type RFEdgeLike,
} from '@/lib/workflow/graph-adapter';
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

// Custom node component - follows design spec:
// - Width: 240px fixed
// - Min height: 80px
// - Border radius: 12px (rounded-xl)
// - Left border: 4px
function WorkflowNode({ data, selected }: { data: WorkflowNodeData; selected: boolean }) {
  const config = nodeRegistry[data.blockType];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div
      className={cn(
        'relative bg-card rounded-xl shadow-sm transition-shadow overflow-hidden border border-border',
        selected && 'ring-2 ring-primary shadow-md'
      )}
      style={{ 
        width: 240, 
        minHeight: 80,
        borderLeftWidth: '4px',
        borderLeftColor: config.color,
      }}
    >
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

// 保存状态（自动保存指示）
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface WorkflowPageInnerProps {
  workflowId?: string;
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
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');
  const [showBlockSelector, setShowBlockSelector] = useState(false);
  const [recentBlocks, setRecentBlocks] = useState<string[]>(['llm', 'code', 'if-else']);
  const [activeTab, setActiveTab] = useState<WorkflowTab>('orchestrate');
  const [showRunPanel, setShowRunPanel] = useState(false);
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);

  const router = useRouter();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { zoomIn, zoomOut, fitView, getZoom, screenToFlowPosition } = useReactFlow();
  const [zoom, setZoom] = useState(1);

  // 轻量 toast
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // 自动保存（防抖）：节点/连线/标题变更 800ms 后 PATCH 保存真实 graph。
  const firstRun = useRef(true);
  useEffect(() => {
    if (!workflowId) return;
    if (firstRun.current) { firstRun.current = false; return; } // 跳过首次挂载
    const t = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const graph = reactFlowToGraph(nodes as unknown as RFNodeLike[], edges as unknown as RFEdgeLike[]);
        const res = await fetch(`/api/workflows/${workflowId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: title, graph }),
        });
        if (!res.ok) { setSaveStatus('error'); showToast('自动保存失败：无权限或未登录'); return; }
        const { valid, validation } = await res.json();
        setSaveStatus('saved');
        if (!valid && Array.isArray(validation) && validation.length > 0) {
          showToast(`已保存（草稿）· ${validation.length} 处校验问题`);
        }
      } catch { setSaveStatus('error'); showToast('自动保存失败：网络错误'); }
    }, 800);
    return () => clearTimeout(t);
  }, [nodes, edges, title, workflowId, showToast]);

  // 立即保存当前画布（运行前 flush，确保引擎跑的是最新图）
  const saveNow = useCallback(async () => {
    if (!workflowId) return;
    const graph = reactFlowToGraph(nodes as unknown as RFNodeLike[], edges as unknown as RFEdgeLike[]);
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: title, graph }),
      });
      setSaveStatus('saved');
    } catch { /* 运行前保存失败不阻断，交由 /run 报错 */ }
  }, [workflowId, nodes, edges, title]);

  // 发布：先 flush 保存最新图 → POST /publish（非法图 422 拒绝并提示）。
  const handlePublish = useCallback(async () => {
    if (!workflowId) { showToast('请先保存工作流后再发布'); return; }
    try {
      await saveNow();
      const res = await fetch(`/api/workflows/${workflowId}/publish`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(`已发布 v${body.publishedVersion ?? ''} · 已上线`);
      } else if (res.status === 422 && Array.isArray(body.validation)) {
        showToast(`无法发布：${body.validation.map((v: { message: string }) => v.message).join('；')}`);
      } else {
        showToast(body?.error?.message ?? '发布失败：无权限或未登录');
      }
    } catch { showToast('发布失败：网络错误'); }
  }, [workflowId, saveNow, showToast]);

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
        onVersionHistory={() => showToast('版本历史即将上线（W2）')}
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

            {/* ReactFlow Canvas */}
            <div
              className="flex-1 relative"
              ref={reactFlowWrapper}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <ReactFlow
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
                mode={interactionMode === 'pan' ? 'hand' : 'pointer'}
                canUndo={false}
                canRedo={false}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onZoomReset={() => setZoom(1)}
                onFitView={handleFitView}
                onModeChange={(mode) => setInteractionMode(mode === 'hand' ? 'pan' : 'select')}
              />
            </div>

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

          {/* 测试运行抽屉（右侧覆盖） */}
          {workflowId && (
            <WorkflowRunDrawer
              workflowId={workflowId}
              open={showRunPanel}
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
