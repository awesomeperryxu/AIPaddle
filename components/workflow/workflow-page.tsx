'use client';

import { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  NodeTypes,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { WorkflowHeader, OnlineUser } from './header';
import { WorkflowOperator } from './canvas';
import { NodeConfigPanel } from './panels/node-config-panel';
import { nodeRegistry } from './nodes/node-registry';
import { BlockEnum } from './types';
import { cn } from '@/lib/utils';

// Custom node component
function WorkflowNode({ data, selected }: { data: any; selected: boolean }) {
  const config = nodeRegistry[data.blockType as BlockEnum];
  if (!config) return null;

  const Icon = config.icon;
  const isStartOrEnd = data.blockType === BlockEnum.Start || data.blockType === BlockEnum.End;

  return (
    <div
      className={cn(
        'relative bg-white rounded-xl shadow-sm transition-shadow overflow-hidden',
        selected && 'ring-2 ring-primary shadow-md'
      )}
      style={{ width: 240, minHeight: 80 }}
    >
      {/* Left border stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: config.color }}
      />
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

// Initial nodes
const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'workflowNode',
    position: { x: 250, y: 50 },
    data: { blockType: BlockEnum.Start, label: '开始' },
  },
  {
    id: 'llm-1',
    type: 'workflowNode',
    position: { x: 250, y: 180 },
    data: { blockType: BlockEnum.LLM, label: 'LLM', description: '调用大语言模型处理文本' },
  },
  {
    id: 'end',
    type: 'workflowNode',
    position: { x: 250, y: 310 },
    data: { blockType: BlockEnum.End, label: '结束' },
  },
];

// Initial edges
const initialEdges: Edge[] = [
  { id: 'e-start-llm', source: 'start', target: 'llm-1', animated: true },
  { id: 'e-llm-end', source: 'llm-1', target: 'end', animated: true },
];

interface WorkflowPageInnerProps {
  title?: string;
  appType?: 'workflow' | 'chatflow';
  onlineUsers?: OnlineUser[];
}

function WorkflowPageInner({
  title = '未命名工作流',
  appType = 'workflow',
  onlineUsers = [],
}: WorkflowPageInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [headerMode, setHeaderMode] = useState<'normal' | 'restoring' | 'view-history'>('normal');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');
  const [showRunPanel, setShowRunPanel] = useState(false);

  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow();
  const [zoom, setZoom] = useState(1);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));
      setHasUnsavedChanges(true);
    },
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
    (nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        )
      );
      setHasUnsavedChanges(true);
    },
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
      );
      setHasUnsavedChanges(true);
    },
    [setNodes]
  );

  const handleCloseConfigPanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

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

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <WorkflowHeader
        mode={headerMode}
        title={title}
        hasUnsavedChanges={hasUnsavedChanges}
        onlineUsers={onlineUsers}
        appType={appType}
        canUndo={false}
        canRedo={false}
        onBack={() => window.history.back()}
        onRun={() => setShowRunPanel(true)}
        onPublish={() => console.log('Publish')}
        onVersionHistory={() => setHeaderMode('view-history')}
        onEnvVars={() => console.log('Env vars')}
        onConversationVars={() => console.log('Conversation vars')}
        onExitHistory={() => setHeaderMode('normal')}
        onRestoreVersion={() => setHeaderMode('restoring')}
        onCancelRestore={() => setHeaderMode('normal')}
        onConfirmRestore={() => setHeaderMode('normal')}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ReactFlow Canvas */}
        <div className="flex-1 relative">
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
              color="#D1D5DB"
              style={{ backgroundColor: '#F9FAFB' }}
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

          {/* Bottom Operator Bar */}
          <WorkflowOperator
            zoom={zoom}
            interactionMode={interactionMode}
            canUndo={false}
            canRedo={false}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitView={handleFitView}
            onInteractionModeChange={setInteractionMode}
          />
        </div>

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
    </div>
  );
}

export interface WorkflowPageProps {
  title?: string;
  appType?: 'workflow' | 'chatflow';
  onlineUsers?: OnlineUser[];
}

export function WorkflowPage(props: WorkflowPageProps) {
  return (
    <ReactFlowProvider>
      <WorkflowPageInner {...props} />
    </ReactFlowProvider>
  );
}
