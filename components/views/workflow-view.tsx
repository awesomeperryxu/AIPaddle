'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
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
  Eye,
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

export function WorkflowView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<AppType>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<WorkflowApp | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [canvasTool, setCanvasTool] = useState<'select' | 'pan'>('select');
  
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

  const filteredApps = mockApps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || app.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleEditWorkflow = (app: WorkflowApp) => {
    setSelectedApp(app);
    setIsEditorOpen(true);
    // Reset workflow state for new editor session
    setWorkflowNodes(initialWorkflowNodes);
    setConnections(initialConnections);
    setSelectedNode(null);
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <History className="h-4 w-4" />
              历史版本
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Eye className="h-4 w-4" />
              预览
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Redo2 className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <Button variant="outline" size="sm" className="gap-1.5">
              <Play className="h-4 w-4" />
              运行
            </Button>
            <Button size="sm" className="gap-1.5">
              <Save className="h-4 w-4" />
              发布
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Node Library */}
          <div className={`border-r border-border bg-card transition-all duration-200 ${isSidebarCollapsed ? 'w-12' : 'w-60'}`}>
            <div className="h-10 border-b border-border flex items-center justify-between px-3">
              {!isSidebarCollapsed && <span className="text-xs font-medium text-muted-foreground">节点库</span>}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                {isSidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            </div>
            {!isSidebarCollapsed && (
              <ScrollArea className="h-[calc(100%-40px)]">
                <div className="p-3 space-y-4">
                  {nodeCategories.map((category) => (
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
                      拖拽节点到画布中添加
                    </p>
                  </div>
                </div>
              </ScrollArea>
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
                            stroke="hsl(var(--border))"
                            strokeWidth="2"
                            className="transition-colors"
                          />
                          {/* Arrow marker */}
                          <circle
                            cx={targetNode.position.x + 100}
                            cy={targetNode.position.y - 4}
                            r="3"
                            fill="hsl(var(--border))"
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
          {selectedNode && (
            <div className="border-l border-gray-200 bg-white shadow-xl" style={{ width: 380 }}>
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
        </div>
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
              <div 
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setSelectedApp({
                    id: 'new',
                    name: '新建工作流',
                    description: '',
                    type: 'workflow',
                    tags: [],
                    lastEditedBy: 'You',
                    lastEditedAt: new Date().toLocaleString('zh-CN'),
                    status: 'draft',
                    executions: 0,
                    successRate: 0
                  });
                  setWorkflowNodes([
                    { id: 'start-1', type: 'start', label: '开始', position: { x: 250, y: 50 } }
                  ]);
                  setConnections([]);
                  setIsEditorOpen(true);
                }}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">创建空白应用</h3>
                  <p className="text-sm text-muted-foreground">从零开始构建你的工作流</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Copy className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">从应用模板创建</h3>
                  <p className="text-sm text-muted-foreground">使用预设模板快速开始</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors">
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">导入 DSL 文件</h3>
                  <p className="text-sm text-muted-foreground">导入已有的工作流配置</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
              </div>
            </div>
            {/* Drop zone */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">拖放 DSL 文件到此处创建应用</p>
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
    </div>
  );
}
