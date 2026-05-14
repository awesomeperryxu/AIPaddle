# Workflow & Chatflow UI 设计文档

**文档版本**: v2.0  
**更新日期**: 2026-05-11  
**基于**: Dify 开源代码深度分析（937 个 TSX 文件）  
**用途**: v0.dev 可用的 TSX 组件代码 + 提示词

---

## 1. 设计系统

### 1.1 颜色 Token

```css
/* 画布背景 */
--canvas-bg: #F9FAFB;
--canvas-dot-color: #D1D5DB;

/* 节点颜色（左侧边框条 + 图标背景） */
--node-start:      #2970FF;
--node-end:        #6B7280;
--node-answer:     #2970FF;
--node-llm:        #7C3AED;
--node-agent:      #10B981;
--node-code:       #F59E0B;
--node-ifelse:     #F59E0B;
--node-http:       #EF4444;
--node-knowledge:  #06B6D4;
--node-iteration:  #3B82F6;
--node-loop:       #8B5CF6;
--node-tool:       #64748B;
--node-trigger:    #F97316;
```

### 1.2 节点尺寸规范

- 节点宽度：240px（固定）
- 节点最小高度：80px
- 节点圆角：12px
- 左侧边框条宽度：4px
- 节点间距 X：60px，Y：39px
- 容器节点（迭代/循环）：宽度自适应，最小 400px

---

## 2. 整体页面布局

```tsx
// WorkflowPage.tsx
"use client"
import { useState } from "react"
import ReactFlow, { Background, BackgroundVariant, MiniMap,
  useNodesState, useEdgesState, ReactFlowProvider } from "reactflow"
import "reactflow/dist/style.css"

export default function WorkflowPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [showRunPanel, setShowRunPanel] = useState(false)

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-gray-50">
      <WorkflowHeader title="我的工作流" onRun={() => setShowRunPanel(true)} />
      <div className="relative flex-1 overflow-hidden">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => setSelectedNode(node.id)}
            onPaneClick={() => setSelectedNode(null)}
            fitView className="bg-[#F9FAFB]"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1.5} color="#D1D5DB" />
            <MiniMap className="!bottom-16 !right-4 !rounded-xl !border !border-gray-100 !shadow-md"
              nodeColor="#E5E7EB" maskColor="rgba(249,250,251,0.7)" />
          </ReactFlow>
        </ReactFlowProvider>
        <WorkflowOperator />
        {selectedNode && (
          <div className="absolute right-0 top-0 h-full">
            <NodeConfigPanel nodeId={selectedNode} onClose={() => setSelectedNode(null)} />
          </div>
        )}
        {showRunPanel && <WorkflowRunPanel status="succeeded" onClose={() => setShowRunPanel(false)} />}
      </div>
    </div>
  )
}
```

---

## 3. 顶部 Header（三种状态）

```tsx
// WorkflowHeader.tsx
"use client"
import { useState } from "react"
import { ArrowLeft, Play, ChevronDown, Clock, Users, Globe, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type HeaderMode = "normal" | "restoring" | "view-history"

interface WorkflowHeaderProps {
  title: string
  mode?: HeaderMode
  isDirty?: boolean
  onlineUsers?: { id: string; name: string; color: string }[]
  onRun?: () => void
  onPublish?: () => void
  onHistory?: () => void
  onBack?: () => void
}

export function WorkflowHeader({
  title, mode = "normal", isDirty = false,
  onlineUsers = [], onRun, onPublish, onHistory, onBack
}: WorkflowHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(title)

  if (mode === "restoring") {
    return (
      <div className="flex h-12 items-center justify-between border-b border-gray-100 bg-white px-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          正在恢复版本...
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs">取消恢复</Button>
      </div>
    )
  }

  if (mode === "view-history") {
    return (
      <div className="flex h-12 items-center gap-3 border-b border-gray-100 bg-amber-50 px-4">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-amber-700">正在查看历史版本 · 只读模式</span>
        <Button size="sm" className="ml-auto h-7 text-xs" onClick={onBack}>返回当前版本</Button>
      </div>
    )
  }

  return (
    <div className="flex h-12 items-center justify-between border-b border-gray-100 bg-white px-4">
      {/* 左侧 */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {editingTitle ? (
          <Input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
            className="h-7 w-48 text-sm"
            autoFocus
          />
        ) : (
          <button
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-sm font-medium hover:bg-gray-100"
            onClick={() => setEditingTitle(true)}
          >
            {titleValue}
            {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />}
          </button>
        )}
      </div>

      {/* 右侧 */}
      <div className="flex items-center gap-2">
        {/* 在线用户 */}
        {onlineUsers.length > 0 && (
          <div className="flex -space-x-1.5 mr-1">
            {onlineUsers.slice(0, 3).map(u => (
              <Avatar key={u.id} className="h-6 w-6 border-2 border-white">
                <AvatarFallback className="text-[10px]" style={{ backgroundColor: u.color }}>
                  {u.name[0]}
                </AvatarFallback>
              </Avatar>
            ))}
            {onlineUsers.length > 3 && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] text-gray-600">
                +{onlineUsers.length - 3}
              </div>
            )}
          </div>
        )}

        {/* 添加节点 */}
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> 添加节点
        </Button>

        {/* 运行 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <Play className="h-3.5 w-3.5" /> 运行
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={onRun}>测试运行</DropdownMenuItem>
            <DropdownMenuItem>Webhook 触发</DropdownMenuItem>
            <DropdownMenuItem>定时触发</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 历史 */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onHistory}>
          <Clock className="h-4 w-4" />
        </Button>

        {/* 发布 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-7 gap-1 text-xs">
              <Globe className="h-3.5 w-3.5" /> 发布
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={onPublish}>发布工作流</DropdownMenuItem>
            <DropdownMenuItem>发布为 API</DropdownMenuItem>
            <DropdownMenuItem>发布为 Webhook</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
```

---

## 4. 节点卡片系统

### 4.1 节点基础卡片

```tsx
// NodeCard.tsx
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, Loader2, Clock, AlertTriangle } from "lucide-react"

type NodeStatus = "idle" | "running" | "succeeded" | "failed" | "waiting" | "exception"

const statusRing: Record<NodeStatus, string> = {
  idle:      "",
  running:   "ring-2 ring-blue-400",
  succeeded: "ring-2 ring-green-400",
  failed:    "ring-2 ring-red-400",
  waiting:   "ring-1 ring-gray-300",
  exception: "ring-2 ring-orange-400",
}

const statusIcon: Record<NodeStatus, React.ReactNode> = {
  idle:      null,
  running:   <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
  succeeded: <CheckCircle2 className="h-3 w-3 text-green-500" />,
  failed:    <XCircle className="h-3 w-3 text-red-500" />,
  waiting:   <Clock className="h-3 w-3 text-gray-400" />,
  exception: <AlertTriangle className="h-3 w-3 text-orange-500" />,
}

interface NodeCardProps {
  title: string
  icon: React.ReactNode
  accentColor: string
  status?: NodeStatus
  selected?: boolean
  disabled?: boolean
  children?: React.ReactNode
}

export function NodeCard({
  title, icon, accentColor, status = "idle", selected, disabled, children
}: NodeCardProps) {
  return (
    <div className={cn(
      "w-[240px] rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden transition-all",
      selected && "ring-2 ring-primary ring-offset-1",
      disabled && "opacity-50",
      statusRing[status]
    )}>
      <div className="flex">
        <div className="w-1 flex-shrink-0" style={{ backgroundColor: accentColor }} />
        <div className="flex-1 min-w-0">
          {/* 节点头部 */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-50">
            <div className="flex h-6 w-6 items-center justify-center rounded-md shrink-0"
                 style={{ backgroundColor: accentColor + "20" }}>
              <span style={{ color: accentColor }} className="flex items-center">{icon}</span>
            </div>
            <span className="flex-1 text-xs font-medium text-gray-800 truncate">{title}</span>
            {statusIcon[status]}
          </div>
          {/* 节点内容 */}
          {children && <div className="px-3 py-2">{children}</div>}
        </div>
      </div>
    </div>
  )
}
```

### 4.2 各节点类型展示

```tsx
// AllNodeTypes.tsx - 所有节点类型展示
import { NodeCard } from "./NodeCard"
import { Play, Square, MessageSquare, Brain, GitBranch, RefreshCw,
         RotateCcw, Code2, Globe, Wrench, BookOpen, Zap, Webhook,
         Clock, Puzzle, Variable, FileText, List, Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// ── Start 节点 ──────────────────────────────────────────────
export function StartNode({ isChatflow = false }: { isChatflow?: boolean }) {
  return (
    <NodeCard title="开始" icon={<Play className="h-3.5 w-3.5" />} accentColor="#2970FF">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
          <span>输入变量</span>
          <Badge variant="secondary" className="h-4 text-[10px]">
            {isChatflow ? "2 个" : "1 个"}
          </Badge>
        </div>
        {isChatflow && (
          <div className="flex items-center gap-1.5 rounded bg-gray-50 px-2 py-1 text-[11px]">
            <span className="font-mono text-gray-700">sys.query</span>
            <span className="ml-auto text-blue-500">string</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 rounded bg-gray-50 px-2 py-1 text-[11px]">
          <span className="font-mono text-gray-700">sys.files</span>
          <span className="ml-auto text-purple-500">array[file]</span>
        </div>
      </div>
    </NodeCard>
  )
}

// ── LLM 节点 ──────────────────────────────────────────────
export function LLMNode() {
  return (
    <NodeCard title="LLM" icon={<Brain className="h-3.5 w-3.5" />} accentColor="#7C3AED">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 rounded bg-purple-50 px-2 py-1">
          <div className="h-3.5 w-3.5 rounded-full bg-purple-200 flex items-center justify-center">
            <span className="text-[8px] font-bold text-purple-700">G</span>
          </div>
          <span className="text-[11px] text-purple-700">gpt-4o-mini</span>
          <Badge variant="secondary" className="ml-auto h-3.5 text-[9px]">0.7</Badge>
        </div>
        <div className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed px-0.5">
          你是一个专业助手，请根据 {"{{"} query {"}}"}...
        </div>
      </div>
    </NodeCard>
  )
}

// ── If-Else 节点 ──────────────────────────────────────────────
export function IfElseNode() {
  return (
    <NodeCard title="条件分支" icon={<GitBranch className="h-3.5 w-3.5" />} accentColor="#F59E0B">
      <div className="space-y-1">
        {[
          { label: "IF",   cond: "query 包含 '帮助'" },
          { label: "ELIF", cond: "query 长度 > 100" },
          { label: "ELSE", cond: null },
        ].map(({ label, cond }) => (
          <div key={label} className="flex items-center gap-2">
            <Badge
              className={`text-[10px] h-4 w-9 justify-center shrink-0 ${
                label === "IF" ? "bg-amber-100 text-amber-700 border-0" : ""
              }`}
              variant={label === "IF" ? "default" : "secondary"}
            >
              {label}
            </Badge>
            {cond && <span className="text-[11px] text-gray-500 truncate">{cond}</span>}
          </div>
        ))}
      </div>
    </NodeCard>
  )
}

// ── Code 节点 ──────────────────────────────────────────────
export function CodeNode() {
  return (
    <NodeCard title="代码" icon={<Code2 className="h-3.5 w-3.5" />} accentColor="#F59E0B">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] h-4">Python3</Badge>
          <span className="text-[10px] text-gray-400">2 输入 · 1 输出</span>
        </div>
        <div className="rounded bg-gray-900 px-2 py-1 font-mono text-[10px] text-green-400">
          def main(query, context):
        </div>
      </div>
    </NodeCard>
  )
}

// ── HTTP Request 节点 ──────────────────────────────────────────────
export function HttpNode() {
  return (
    <NodeCard title="HTTP 请求" icon={<Globe className="h-3.5 w-3.5" />} accentColor="#EF4444">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Badge className="text-[10px] h-4 bg-red-100 text-red-700 border-0">POST</Badge>
          <span className="text-[11px] text-gray-500 truncate">api.example.com/v1/...</span>
        </div>
        <div className="text-[10px] text-gray-400">Bearer Token · 30s 超时</div>
      </div>
    </NodeCard>
  )
}

// ── Knowledge Retrieval 节点 ──────────────────────────────────────────────
export function KnowledgeNode() {
  return (
    <NodeCard title="知识库检索" icon={<BookOpen className="h-3.5 w-3.5" />} accentColor="#06B6D4">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] h-4">混合检索</Badge>
          <span className="text-[10px] text-gray-400">2 个知识库</span>
        </div>
        <div className="text-[10px] text-gray-400">重排序: bge-reranker-v2</div>
      </div>
    </NodeCard>
  )
}

// ── Iteration 节点（容器节点）──────────────────────────────────────────────
export function IterationNode() {
  return (
    <div className="min-w-[400px] rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100">
          <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
        </div>
        <span className="text-xs font-medium text-blue-700">迭代</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] h-4">并行 × 5</Badge>
          <span className="text-[10px] text-blue-500 font-mono">items</span>
        </div>
      </div>
      <div className="rounded-lg bg-white/70 p-3 text-[11px] text-gray-400 text-center border border-dashed border-blue-200 min-h-[60px] flex items-center justify-center">
        拖入节点到此区域
      </div>
    </div>
  )
}

// ── Loop 节点（容器节点）──────────────────────────────────────────────
export function LoopNode() {
  return (
    <div className="min-w-[400px] rounded-xl border-2 border-dashed border-purple-300 bg-purple-50/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100">
          <RotateCcw className="h-3.5 w-3.5 text-purple-600" />
        </div>
        <span className="text-xs font-medium text-purple-700">循环</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-purple-500">最多 10 次</span>
        </div>
      </div>
      <div className="rounded-lg bg-white/70 p-3 text-[11px] text-gray-400 text-center border border-dashed border-purple-200 min-h-[60px] flex items-center justify-center">
        拖入节点到此区域
      </div>
    </div>
  )
}

// ── Agent 节点 ──────────────────────────────────────────────
export function AgentNode() {
  return (
    <NodeCard title="Agent" icon={<Zap className="h-3.5 w-3.5" />} accentColor="#10B981">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">策略</span>
          <Badge variant="secondary" className="text-[10px] h-4">Function Calling</Badge>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 mr-0.5">工具</span>
          {["搜索", "计算器", "代码"].map(t => (
            <Badge key={t} variant="outline" className="text-[10px] h-4">{t}</Badge>
          ))}
        </div>
      </div>
    </NodeCard>
  )
}

// ── Answer 节点（Chatflow 专属）──────────────────────────────────────────────
export function AnswerNode() {
  return (
    <NodeCard title="直接回复" icon={<MessageSquare className="h-3.5 w-3.5" />} accentColor="#2970FF">
      <div className="text-[11px] text-gray-500 leading-relaxed">
        根据 {"{{"} llm.text {"}}"}，为您提供以下回答...
        <span className="inline-block w-1 h-3 bg-blue-400 ml-0.5 animate-pulse align-middle" />
      </div>
    </NodeCard>
  )
}

// ── End 节点 ──────────────────────────────────────────────
export function EndNode() {
  return (
    <NodeCard title="结束" icon={<Square className="h-3.5 w-3.5" />} accentColor="#6B7280">
      <div className="space-y-1">
        <div className="text-[10px] text-gray-400 mb-1">输出变量</div>
        <div className="flex items-center gap-1.5 rounded bg-gray-50 px-2 py-1 text-[11px]">
          <span className="font-mono text-gray-700">answer</span>
          <span className="ml-auto text-blue-500">string</span>
        </div>
      </div>
    </NodeCard>
  )
}

// ── Trigger 节点 ──────────────────────────────────────────────
export function TriggerWebhookNode() {
  return (
    <NodeCard title="Webhook 触发" icon={<Webhook className="h-3.5 w-3.5" />} accentColor="#F97316">
      <div className="space-y-1">
        <div className="text-[10px] text-gray-400">触发 URL</div>
        <div className="rounded bg-orange-50 px-2 py-1 text-[10px] font-mono text-orange-700 truncate">
          https://api.example.com/webhook/abc123
        </div>
      </div>
    </NodeCard>
  )
}
```

---

## 5. 节点配置面板（右侧抽屉）

```tsx
// NodeConfigPanel.tsx - 完整配置面板（以 LLM 节点为例）
"use client"
import { useState } from "react"
import { X, Plus, Trash2, ChevronDown, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface NodeConfigPanelProps {
  nodeId: string
  nodeType?: string
  nodeTitle?: string
  onClose: () => void
}

export function NodeConfigPanel({
  nodeId, nodeType = "llm", nodeTitle = "LLM", onClose
}: NodeConfigPanelProps) {
  const [memory, setMemory] = useState(false)
  const [vision, setVision] = useState(false)
  const [temperature, setTemperature] = useState([0.7])

  return (
    <div className="flex h-full w-[380px] flex-col border-l border-gray-100 bg-white shadow-xl">
      {/* 面板头部 */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 shrink-0">
        <div className="h-2 w-2 rounded-full bg-purple-500" />
        <span className="flex-1 text-sm font-medium">{nodeTitle}</span>
        <Badge variant="secondary" className="text-[10px] h-5">{nodeType}</Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tab 导航 */}
      <Tabs defaultValue="params" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="w-full shrink-0 rounded-none border-b border-gray-100 bg-transparent px-4 justify-start gap-0">
          {["params", "input", "output"].map((tab) => (
            <TabsTrigger key={tab} value={tab}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3">
              {tab === "params" ? "参数配置" : tab === "input" ? "输入变量" : "输出变量"}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 参数配置 Tab */}
        <TabsContent value="params" className="flex-1 overflow-y-auto m-0">
          <div className="space-y-4 p-4">

            {/* 模型选择 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">模型</Label>
              <Select defaultValue="gpt-4o-mini">
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
                  <SelectItem value="deepseek-v3">DeepSeek V3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 上下文变量 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-gray-600">上下文</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent className="text-xs max-w-[200px]">
                    引用上游节点的文本变量作为上下文
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400 cursor-pointer hover:border-primary hover:text-primary transition-colors">
                <Plus className="h-3.5 w-3.5" /> 选择变量
              </div>
            </div>

            {/* 系统提示词 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600">系统提示词</Label>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary px-1 gap-0.5">
                  <Plus className="h-3 w-3" /> 插入变量
                </Button>
              </div>
              <Textarea
                className="min-h-[90px] resize-none text-xs font-mono"
                placeholder="你是一个专业助手..."
              />
            </div>

            {/* 用户提示词 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600">用户提示词</Label>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary px-1 gap-0.5">
                  <Plus className="h-3 w-3" /> 插入变量
                </Button>
              </div>
              <Textarea
                className="min-h-[60px] resize-none text-xs font-mono"
                placeholder="{'{{'} query {'}}'}"
              />
            </div>

            {/* 参数 */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600">参数</Label>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">Temperature</span>
                    <span className="text-[11px] font-mono text-gray-700">{temperature[0]}</span>
                  </div>
                  <Slider value={temperature} onValueChange={setTemperature}
                    min={0} max={2} step={0.1} className="h-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400">Max Tokens</span>
                    <Input type="number" defaultValue="2048" className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400">Top P</span>
                    <Input type="number" defaultValue="1" className="h-7 text-xs" step="0.1" />
                  </div>
                </div>
              </div>
            </div>

            {/* 记忆（Chatflow） */}
            <div className="rounded-lg border border-gray-100 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">记忆</p>
                  <p className="text-[10px] text-gray-400">引用对话历史（仅 Chatflow）</p>
                </div>
                <Switch checked={memory} onCheckedChange={setMemory} />
              </div>
              {memory && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400">AI 角色名</span>
                    <Input defaultValue="Assistant" className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400">历史消息数</span>
                    <Input type="number" defaultValue="10" className="h-7 text-xs" />
                  </div>
                </div>
              )}
            </div>

            {/* 视觉 */}
            <div className="rounded-lg border border-gray-100 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">视觉</p>
                  <p className="text-[10px] text-gray-400">处理图片输入</p>
                </div>
                <Switch checked={vision} onCheckedChange={setVision} />
              </div>
              {vision && (
                <Select defaultValue="auto">
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动</SelectItem>
                    <SelectItem value="low">低分辨率</SelectItem>
                    <SelectItem value="high">高分辨率</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </TabsContent>

        {/* 输入变量 Tab */}
        <TabsContent value="input" className="flex-1 overflow-y-auto m-0 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">输入变量</span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1">
                <Plus className="h-3 w-3" /> 添加
              </Button>
            </div>
            {[
              { name: "query", type: "string", source: "start.query" },
              { name: "context", type: "string", source: "knowledge.result" },
            ].map(v => (
              <div key={v.name} className="rounded-md border border-gray-100 p-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-xs font-mono font-medium">{v.name}</span>
                  <Badge variant="secondary" className="text-[10px] h-4">{v.type}</Badge>
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Trash2 className="h-3 w-3 text-gray-400" />
                  </Button>
                </div>
                <div className="text-[10px] text-gray-400 font-mono">{v.source}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* 输出变量 Tab */}
        <TabsContent value="output" className="flex-1 overflow-y-auto m-0 p-4">
          <div className="rounded-md bg-gray-50 p-3 space-y-1.5">
            <p className="text-xs font-medium text-gray-600 mb-2">输出变量（只读）</p>
            {[
              { name: "text", type: "string" },
              { name: "usage", type: "object" },
              { name: "finish_reason", type: "string" },
            ].map(v => (
              <div key={v.name} className="flex items-center gap-2 text-[11px]">
                <span className="font-mono text-gray-700">{v.name}</span>
                <span className={`ml-auto ${v.type === "string" ? "text-blue-500" : "text-purple-500"}`}>
                  {v.type}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* 底部操作 */}
      <div className="shrink-0 border-t border-gray-100 px-4 py-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

---

## 6. 底部操作栏 + 变量检查面板

```tsx
// WorkflowOperator.tsx
"use client"
import { useState } from "react"
import { ZoomIn, ZoomOut, Maximize2, Undo2, Redo2, Map, Variable } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

interface WorkflowOperatorProps {
  zoom?: number
  canUndo?: boolean
  canRedo?: boolean
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFitView?: () => void
  onUndo?: () => void
  onRedo?: () => void
}

export function WorkflowOperator({
  zoom = 1, canUndo = false, canRedo = false,
  onZoomIn, onZoomOut, onFitView, onUndo, onRedo
}: WorkflowOperatorProps) {
  const [showMinimap, setShowMinimap] = useState(true)
  const [showVarInspect, setShowVarInspect] = useState(false)

  return (
    <>
      {/* 底部工具栏 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-1 rounded-xl bg-white shadow-lg border border-gray-100 px-2 py-1.5">
          {/* 撤销/重做 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"
                disabled={!canUndo} onClick={onUndo}>
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">撤销 (⌘Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"
                disabled={!canRedo} onClick={onRedo}>
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">重做 (⌘⇧Z)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* 变量检查 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={showVarInspect ? "secondary" : "ghost"} size="icon"
                className="h-7 w-7" onClick={() => setShowVarInspect(!showVarInspect)}>
                <Variable className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">变量检查</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* 缩放 */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[40px] text-center text-xs text-gray-600 tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onFitView}>
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">适应画布 (⌘⇧F)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* 小地图 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={showMinimap ? "secondary" : "ghost"} size="icon"
                className="h-7 w-7" onClick={() => setShowMinimap(!showMinimap)}>
                <Map className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">小地图</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 变量检查面板（底部可调整高度，支持拖拽 resize） */}
      {showVarInspect && (
        <div
          className="absolute bottom-16 left-4 right-4 z-10 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden flex flex-col"
          style={{ height: "240px", minHeight: "120px", maxHeight: "480px" }}
        >
          {/* Resize Handle */}
          <div
            className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize bg-transparent hover:bg-primary/20 transition-colors"
            onMouseDown={(e) => {
              const startY = e.clientY
              const startH = e.currentTarget.parentElement!.offsetHeight
              const onMove = (ev: MouseEvent) => {
                const delta = startY - ev.clientY
                const newH = Math.min(480, Math.max(120, startH + delta))
                ;(e.currentTarget.parentElement as HTMLElement).style.height = `${newH}px`
              }
              const onUp = () => {
                document.removeEventListener("mousemove", onMove)
                document.removeEventListener("mouseup", onUp)
              }
              document.addEventListener("mousemove", onMove)
              document.addEventListener("mouseup", onUp)
            }}
          />
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <Variable className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs font-medium">变量检查</span>
              <Badge variant="secondary" className="text-[10px] h-4">运行时</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]">重置所有</Button>
          </div>
          <div className="overflow-y-auto p-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { name: "sys.query", value: "如何使用工作流？", type: "string" },
                { name: "llm.text", value: "工作流是一种...", type: "string" },
                { name: "llm.usage.tokens", value: "342", type: "number" },
              ].map(v => (
                <div key={v.name} className="rounded-md border border-gray-100 p-2 space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-gray-500 truncate flex-1">{v.name}</span>
                    <Badge variant="secondary" className="text-[9px] h-3.5 shrink-0">{v.type}</Badge>
                  </div>
                  <p className="text-[11px] text-gray-700 line-clamp-2">{v.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

---

## 7. 运行调试面板

### 7.1 Workflow 运行结果面板（三 Tab）

```tsx
// WorkflowRunPanel.tsx
"use client"
import { useState } from "react"
import { CheckCircle2, XCircle, Clock, X, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type RunStatus = "running" | "succeeded" | "failed"

interface NodeTrace {
  id: string
  title: string
  type: string
  status: "succeeded" | "failed" | "running"
  duration?: number
  tokens?: number
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  children?: NodeTrace[]
}

interface WorkflowRunPanelProps {
  status: RunStatus
  totalDuration?: number
  totalTokens?: number
  outputs?: Record<string, unknown>
  traces?: NodeTrace[]
  onClose: () => void
}

export function WorkflowRunPanel({
  status, totalDuration, totalTokens, outputs = {}, traces = [], onClose
}: WorkflowRunPanelProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="absolute right-4 top-14 bottom-4 w-[340px] z-10 flex flex-col rounded-xl bg-white shadow-xl border border-gray-100">
      {/* 状态头部 */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-t-xl shrink-0",
        status === "succeeded" && "bg-green-50",
        status === "failed" && "bg-red-50",
        status === "running" && "bg-blue-50"
      )}>
        {status === "succeeded" && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
        {status === "failed" && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
        {status === "running" && <Clock className="h-4 w-4 text-blue-600 animate-pulse shrink-0" />}
        <span className="flex-1 text-sm font-medium">
          {status === "succeeded" ? "运行成功" : status === "failed" ? "运行失败" : "运行中..."}
        </span>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {totalDuration && <span>{totalDuration}ms</span>}
          {totalTokens && <Badge variant="secondary" className="text-[10px] h-4">{totalTokens}t</Badge>}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 三 Tab */}
      <Tabs defaultValue="result" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="shrink-0 w-full rounded-none border-b border-gray-100 bg-transparent px-4 justify-start gap-0">
          {["result", "detail", "tracing"].map(tab => (
            <TabsTrigger key={tab} value={tab}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3">
              {tab === "result" ? "结果" : tab === "detail" ? "详情" : "追踪"}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 结果 Tab */}
        <TabsContent value="result" className="flex-1 overflow-y-auto m-0 p-4">
          <div className="space-y-2">
            {Object.entries(outputs).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <span className="text-[10px] font-mono text-gray-500">{key}</span>
                <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700 whitespace-pre-wrap">
                  {String(value)}
                </div>
              </div>
            ))}
            {Object.keys(outputs).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">暂无输出</p>
            )}
          </div>
        </TabsContent>

        {/* 详情 Tab */}
        <TabsContent value="detail" className="flex-1 overflow-y-auto m-0 p-4">
          <div className="space-y-3">
            {[
              { label: "执行时间", value: `${totalDuration ?? "-"}ms` },
              { label: "Token 用量", value: `${totalTokens ?? "-"}` },
              { label: "状态", value: status === "succeeded" ? "成功" : "失败" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* 追踪 Tab */}
        <TabsContent value="tracing" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full px-3 py-2">
            <div className="space-y-1">
              {traces.map((trace, i) => (
                <div key={trace.id}>
                  <div
                    className="flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleNode(trace.id)}
                  >
                    <span className="text-[10px] text-gray-400 w-4 shrink-0">{i + 1}</span>
                    {trace.children ? (
                      expandedNodes.has(trace.id)
                        ? <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
                        : <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
                    ) : <div className="w-3" />}
                    <span className="flex-1 text-xs font-medium truncate">{trace.title}</span>
                    {trace.duration && <span className="text-[10px] text-gray-400">{trace.duration}ms</span>}
                    {trace.tokens && <Badge variant="secondary" className="text-[10px] h-4">{trace.tokens}t</Badge>}
                    {trace.status === "succeeded" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                    {trace.status === "failed" && <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  </div>
                  {/* 子节点（迭代/循环） */}
                  {trace.children && expandedNodes.has(trace.id) && (
                    <div className="ml-6 border-l border-gray-100 pl-2 space-y-1">
                      {trace.children.map((child, j) => (
                        <div key={child.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs">
                          <span className="text-[10px] text-gray-400 w-4">{j + 1}</span>
                          <span className="flex-1 truncate text-gray-600">{child.title}</span>
                          {child.duration && <span className="text-[10px] text-gray-400">{child.duration}ms</span>}
                          {child.status === "succeeded" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                          {child.status === "failed" && <XCircle className="h-3 w-3 text-red-500" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### 7.2 Chatflow 对话预览面板

```tsx
// ChatflowPreviewPanel.tsx
"use client"
import { useState, useRef, useEffect } from "react"
import { Send, RefreshCw, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
  error?: boolean
}

interface ChatflowPreviewPanelProps {
  onClose: () => void
  onSend?: (message: string) => Promise<void>
}

export function ChatflowPreviewPanel({ onClose, onSend }: ChatflowPreviewPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input }
    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "", isStreaming: true }
    setMessages(prev => [...prev, userMsg, aiMsg])
    setInput("")
    setIsLoading(true)
    // 模拟流式输出
    await onSend?.(input)
    setIsLoading(false)
  }

  return (
    <div className="absolute right-4 top-14 bottom-4 w-[380px] z-10 flex flex-col rounded-xl bg-white shadow-xl border border-gray-100">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 shrink-0">
        <span className="text-sm font-medium">对话预览</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => setMessages([])}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 消息列表 */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-400 py-16">
            发送消息开始测试对话
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex gap-2.5", msg.role === "user" && "flex-row-reverse")}>
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                  msg.role === "user" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
                )}>
                  {msg.role === "user" ? "U" : "AI"}
                </div>
                <div className={cn(
                  "max-w-[260px] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-white rounded-tr-sm"
                    : msg.error
                      ? "bg-red-50 text-red-600 rounded-tl-sm"
                      : "bg-gray-50 text-gray-800 rounded-tl-sm"
                )}>
                  {msg.content || (msg.isStreaming && (
                    <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                  ))}
                  {msg.isStreaming && msg.content && (
                    <span className="inline-block w-0.5 h-3 bg-current ml-0.5 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* 输入区域 */}
      <div className="shrink-0 border-t border-gray-100 p-3 flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          className="min-h-[36px] max-h-[120px] resize-none text-xs flex-1"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSend} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
```

---

## 8. 版本历史 + 环境变量面板

```tsx
// VersionHistoryPanel.tsx
"use client"
import { Clock, GitBranch, RotateCcw, X, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface WorkflowVersion {
  id: string
  version: string
  createdAt: string
  createdBy: string
  description?: string
  isPublished: boolean
  isCurrent: boolean
}

export function VersionHistoryPanel({
  versions, onRestore, onClose
}: {
  versions: WorkflowVersion[]
  onRestore: (id: string) => void
  onClose: () => void
}) {
  return (
    <div className="absolute right-4 top-14 bottom-4 w-[320px] z-10 flex flex-col rounded-xl bg-white shadow-xl border border-gray-100">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 shrink-0">
        <Clock className="h-4 w-4 text-gray-500" />
        <span className="flex-1 text-sm font-medium">版本历史</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-1">
          {versions.map(v => (
            <div key={v.id} className={cn(
              "group rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors",
              v.isCurrent ? "border-primary/30 bg-primary/5" : "border-gray-100"
            )}>
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="flex-1 text-xs font-medium truncate">{v.version}</span>
                {v.isPublished && (
                  <Badge className="text-[10px] h-4 bg-green-100 text-green-700 border-0 shrink-0">
                    已发布
                  </Badge>
                )}
                {v.isCurrent && (
                  <Badge variant="secondary" className="text-[10px] h-4 shrink-0">当前</Badge>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400">
                <span>{v.createdAt}</span>
                <span>·</span>
                <span>{v.createdBy}</span>
              </div>
              {v.description && (
                <p className="mt-1 text-[11px] text-gray-500 line-clamp-1">{v.description}</p>
              )}
              {!v.isCurrent && (
                <Button variant="ghost" size="sm"
                  className="mt-1.5 h-6 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); onRestore(v.id) }}>
                  <RotateCcw className="h-3 w-3" /> 恢复此版本
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
```

```tsx
// EnvVariablePanel.tsx - 环境变量面板
"use client"
import { useState } from "react"
import { X, Plus, Trash2, Eye, EyeOff, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface EnvVar {
  id: string
  name: string
  value: string
  type: "string" | "number" | "secret"
  encrypted: boolean
}

export function EnvVariablePanel({ onClose }: { onClose: () => void }) {
  const [vars, setVars] = useState<EnvVar[]>([
    { id: "1", name: "API_KEY", value: "sk-***", type: "secret", encrypted: true },
    { id: "2", name: "BASE_URL", value: "https://api.example.com", type: "string", encrypted: false },
  ])
  const [showValues, setShowValues] = useState<Set<string>>(new Set())

  return (
    <div className="absolute right-4 top-14 bottom-4 w-[360px] z-10 flex flex-col rounded-xl bg-white shadow-xl border border-gray-100">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 shrink-0">
        <Lock className="h-4 w-4 text-gray-500" />
        <span className="flex-1 text-sm font-medium">环境变量</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-2">
          {vars.map(v => (
            <div key={v.id} className="rounded-lg border border-gray-100 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs font-mono font-medium">{v.name}</span>
                <Badge variant={v.encrypted ? "default" : "secondary"} className="text-[10px] h-4">
                  {v.encrypted ? "加密" : v.type}
                </Badge>
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Trash2 className="h-3 w-3 text-gray-400" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type={v.encrypted && !showValues.has(v.id) ? "password" : "text"}
                  value={v.value}
                  className="h-7 text-xs font-mono flex-1"
                  readOnly={v.encrypted}
                />
                {v.encrypted && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                    onClick={() => setShowValues(prev => {
                      const next = new Set(prev)
                      next.has(v.id) ? next.delete(v.id) : next.add(v.id)
                      return next
                    })}>
                    {showValues.has(v.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="shrink-0 border-t border-gray-100 p-3">
        <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> 添加环境变量
        </Button>
      </div>
    </div>
  )
}
```

---

## 9. Block Selector（节点添加面板）

```tsx
// BlockSelector.tsx - 节点选择面板
"use client"
import { useState } from "react"
import { Search, Play, Brain, GitBranch, Code2, Globe, BookOpen,
         Zap, RefreshCw, RotateCcw, Wrench, Square, MessageSquare,
         Webhook, Clock, Variable, FileText, List, Filter, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface NodeType {
  type: string
  label: string
  description: string
  icon: React.ReactNode
  color: string
  category: string
}

const NODE_TYPES: NodeType[] = [
  { type: "start", label: "开始", description: "工作流入口，定义输入变量", icon: <Play className="h-4 w-4" />, color: "#2970FF", category: "trigger" },
  { type: "trigger-webhook", label: "Webhook 触发", description: "通过 HTTP 请求触发", icon: <Webhook className="h-4 w-4" />, color: "#F97316", category: "trigger" },
  { type: "trigger-schedule", label: "定时触发", description: "按计划自动执行", icon: <Clock className="h-4 w-4" />, color: "#F97316", category: "trigger" },
  { type: "llm", label: "LLM", description: "调用大语言模型", icon: <Brain className="h-4 w-4" />, color: "#7C3AED", category: "ai" },
  { type: "agent", label: "Agent", description: "智能体，自主使用工具", icon: <Zap className="h-4 w-4" />, color: "#10B981", category: "ai" },
  { type: "if-else", label: "条件分支", description: "根据条件路由流程", icon: <GitBranch className="h-4 w-4" />, color: "#F59E0B", category: "logic" },
  { type: "iteration", label: "迭代", description: "对数组元素循环处理", icon: <RefreshCw className="h-4 w-4" />, color: "#3B82F6", category: "logic" },
  { type: "loop", label: "循环", description: "条件循环执行", icon: <RotateCcw className="h-4 w-4" />, color: "#8B5CF6", category: "logic" },
  { type: "code", label: "代码", description: "执行 Python/JS 代码", icon: <Code2 className="h-4 w-4" />, color: "#F59E0B", category: "transform" },
  { type: "http-request", label: "HTTP 请求", description: "调用外部 API", icon: <Globe className="h-4 w-4" />, color: "#EF4444", category: "integration" },
  { type: "knowledge-retrieval", label: "知识库检索", description: "从知识库检索相关内容", icon: <BookOpen className="h-4 w-4" />, color: "#06B6D4", category: "integration" },
  { type: "tool", label: "工具", description: "调用已安装的工具", icon: <Wrench className="h-4 w-4" />, color: "#64748B", category: "integration" },
  { type: "variable-assigner", label: "变量赋值", description: "为变量赋值", icon: <Variable className="h-4 w-4" />, color: "#64748B", category: "transform" },
  { type: "end", label: "结束", description: "Workflow 出口", icon: <Square className="h-4 w-4" />, color: "#6B7280", category: "output" },
  { type: "answer", label: "直接回复", description: "Chatflow 流式回复", icon: <MessageSquare className="h-4 w-4" />, color: "#2970FF", category: "output" },
]

const CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "trigger", label: "触发器" },
  { id: "ai", label: "AI" },
  { id: "logic", label: "逻辑控制" },
  { id: "transform", label: "数据处理" },
  { id: "integration", label: "集成" },
  { id: "output", label: "输出" },
]

interface BlockSelectorProps {
  onSelect: (type: string) => void
  onClose: () => void
}

export function BlockSelector({ onSelect, onClose }: BlockSelectorProps) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")

  const filtered = NODE_TYPES.filter(n => {
    const matchSearch = !search || n.label.includes(search) || n.description.includes(search)
    const matchCategory = activeCategory === "all" || n.category === activeCategory
    return matchSearch && matchCategory
  })

  return (
    <div className="w-[320px] rounded-xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
      {/* 搜索框 */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
        <Search className="h-4 w-4 text-gray-400 shrink-0" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索节点..."
          className="h-7 border-0 p-0 text-xs focus-visible:ring-0 shadow-none"
          autoFocus
        />
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 分类 Tab */}
      <div className="flex gap-1 overflow-x-auto px-3 py-2 border-b border-gray-50 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button key={cat.id}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
              activeCategory === cat.id
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 节点列表 */}
      <ScrollArea className="max-h-[360px]">
        <div className="p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">未找到匹配节点</p>
          ) : (
            filtered.map(node => (
              <button key={node.type}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                onClick={() => { onSelect(node.type); onClose() }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                     style={{ backgroundColor: node.color + "20" }}>
                  <span style={{ color: node.color }}>{node.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800">{node.label}</p>
                  <p className="text-[10px] text-gray-400 truncate">{node.description}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
```

---

## 10. v0.dev 提示词

### 10.1 整体画布页面

```
Create a full-screen workflow canvas editor using React, Tailwind CSS, and ReactFlow.

Layout:
- Top header bar (48px): left = back arrow + editable workflow title + unsaved dot indicator; right = online user avatars + "添加节点" button + "运行" dropdown (测试运行/Webhook触发/定时触发) + clock icon (history) + "发布" dropdown (发布工作流/发布为API)
- Main canvas: full remaining height, #F9FAFB background with dot grid pattern (gap 16px, dot size 1.5px, color #D1D5DB)
- Bottom center floating toolbar: white rounded-xl pill with undo/redo + variable inspect toggle + zoom controls (- / percentage / + / fit) + minimap toggle
- Right side: 380px config panel slides in when node is selected

Node cards: 240px wide, white bg, rounded-xl, shadow-md, 4px left colored accent border
Use shadcn/ui components throughout.
```

### 10.2 节点卡片全集

```
Create a showcase of all workflow node card types for a visual AI workflow editor.
Each card is 240px wide, white background, rounded-xl (12px), subtle shadow, 4px left accent border.
Card structure: colored icon (24px rounded-md) + title + status icon (right side of header) + content body.

Node types to create:
1. Start (blue #2970FF): shows sys.query string + sys.files array[file] variable chips
2. LLM (purple #7C3AED): shows model chip (gpt-4o-mini) + truncated prompt preview text
3. If-Else (amber #F59E0B): shows IF/ELIF/ELSE rows with condition text
4. Code (amber #F59E0B): shows Python3 badge + code snippet in dark bg
5. HTTP Request (red #EF4444): shows POST badge + URL + auth info
6. Knowledge Retrieval (cyan #06B6D4): shows retrieval mode badge + knowledge base count
7. Iteration (blue, dashed border, 400px wide): container with dotted bg, "拖入节点" placeholder
8. Loop (purple, dashed border, 400px wide): container with dotted bg, max iterations badge
9. Agent (green #10B981): shows strategy badge + tool chips
10. Answer (blue #2970FF): shows streaming text with blinking cursor (Chatflow only)
11. End (gray #6B7280): shows output variable list
12. Webhook Trigger (orange #F97316): shows webhook URL chip

Status variants for each: idle, running (blue ring + spinner), succeeded (green ring + checkmark), failed (red ring + X)
```

### 10.3 节点配置面板（LLM）

```
Create a right-side node configuration panel (380px wide) for an LLM workflow node.

Structure:
- Header: purple dot + "LLM" title + "llm" type badge + X close button
- Tab bar: "参数配置" | "输入变量" | "输出变量" (underline style, active = primary color border)

Params tab:
- Model selector dropdown (shows provider icon + model name)
- Context variable picker (dashed border button "选择变量")
- System prompt textarea (with "插入变量" button, monospace font)
- User prompt textarea (with "插入变量" button)
- Temperature slider (0-2, shows current value) + Max Tokens + Top P inputs in grid
- Memory section (collapsible card): toggle switch + AI role name + user role name + history count inputs
- Vision section (collapsible card): toggle switch + resolution select (自动/低/高)

Input Variables tab:
- List of variable rows: monospace name + type badge + source path + delete button

Output Variables tab:
- Read-only schema: text (string), usage (object), finish_reason (string)

Footer: "重置" + "保存" buttons (equal width)
```

### 10.4 Block Selector（节点添加面板）

```
Create a node type selector popup (320px wide) for adding nodes to a workflow canvas.

Structure:
- Search bar at top: search icon + input + X button
- Category filter pills (scrollable horizontal): 全部 | 触发器 | AI | 逻辑控制 | 数据处理 | 集成 | 输出
  Active pill: primary blue filled; inactive: gray-100 bg
- Scrollable node list (max 360px height):
  Each row: 32px colored icon square (bg = color at 12% opacity) + node name (12px bold) + description (10px gray)

Node types to include (with colors):
- 开始 #2970FF, Webhook触发 #F97316, 定时触发 #F97316
- LLM #7C3AED, Agent #10B981
- 条件分支 #F59E0B, 迭代 #3B82F6, 循环 #8B5CF6
- 代码 #F59E0B, 模板转换 #F59E0B, 变量赋值 #64748B
- HTTP请求 #EF4444, 工具 #64748B, 知识库检索 #06B6D4
- 结束 #6B7280, 直接回复 #2970FF

Empty state: "未找到匹配节点" centered text
```

### 10.5 运行结果面板（三 Tab）

```
Create a workflow run result panel (340px wide, positioned absolute right-4 top-14 bottom-4).

Status header variants:
- Running: blue-50 bg + animated clock icon + "运行中..." text
- Succeeded: green-50 bg + green checkmark + "运行成功" + duration ms + token count badge
- Failed: red-50 bg + red X icon + "运行失败"
Plus X close button on right.

Three tabs (underline style):
1. 结果 tab: key-value output display, each value in gray-50 rounded box
2. 详情 tab: execution time, token usage, status in a clean list
3. 追踪 tab (scrollable list):
   - Each node row: index number + expand arrow (if has children) + node title + duration + token badge + status icon
   - Expanded children (iteration/loop): indented list with left border, same row format
   - Click row to expand/collapse

Use shadcn/ui Tabs, ScrollArea, Badge, lucide-react icons.
```

### 10.6 Chatflow 对话预览面板

```
Create a Chatflow conversation preview panel (380px wide, absolute right-4 top-14 bottom-4).

Header: "对话预览" title + refresh button (clears messages) + X close button

Message list (scrollable):
- User messages: right-aligned, primary blue bubble (rounded-2xl rounded-tr-sm), white text, "U" avatar circle
- AI messages: left-aligned, gray-50 bubble (rounded-2xl rounded-tl-sm), dark text, "AI" avatar circle
- Streaming state: loading spinner OR blinking cursor at end of text
- Error state: red-50 bubble with red text

Empty state: centered "发送消息开始测试对话" text

Input area (bottom):
- Auto-resize textarea (min 36px, max 120px)
- Send button (icon only, shows spinner when loading)
- Enter to send, Shift+Enter for newline

Style: clean white panel, smooth scroll, 12px font throughout
```

---

## 11. 剩余节点卡片（补充 10 种类型）

> 以下节点卡片沿用 Section 4 的 `NodeCard` 基础组件，仅展示各类型的 body 内容差异。

```tsx
"use client"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  HelpCircle, Sliders, FileText, ArrowLeftRight,
  List, FileSearch, UserCheck, Clock, Wrench, StickyNote
} from "lucide-react"

// ── QuestionClassifier 节点 ──────────────────────────────────────
export function QuestionClassifierNode({ title = "问题分类", classCount = 3 }: {
  title?: string; classCount?: number
}) {
  return (
    <div className="w-[240px] rounded-xl border border-amber-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-100 bg-amber-50 rounded-t-xl">
        <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
          <HelpCircle className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{title}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-300 text-amber-600">分类器</Badge>
      </div>
      <div className="px-3 py-2 space-y-1">
        <div className="text-[10px] text-gray-500">查询变量</div>
        <div className="text-xs bg-gray-50 rounded px-2 py-1 text-gray-700 truncate">sys.query</div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-gray-500">分类数量</span>
          <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">{classCount} 个分类</Badge>
        </div>
      </div>
    </div>
  )
}

// ── ParameterExtractor 节点 ──────────────────────────────────────
export function ParameterExtractorNode({ title = "参数提取", model = "gpt-4o", paramCount = 2 }: {
  title?: string; model?: string; paramCount?: number
}) {
  return (
    <div className="w-[240px] rounded-xl border border-amber-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-100 bg-amber-50 rounded-t-xl">
        <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
          <Sliders className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{title}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-300 text-amber-600">提取器</Badge>
      </div>
      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">模型</span>
          <Badge className="text-[10px] bg-purple-100 text-purple-700 border-0 ml-auto">{model}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">参数数量</span>
          <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">{paramCount} 个参数</Badge>
        </div>
      </div>
    </div>
  )
}

// ── TemplateTransform 节点 ──────────────────────────────────────
export function TemplateTransformNode({ title = "模板转换", preview = "Hello {{name}}, ..." }: {
  title?: string; preview?: string
}) {
  return (
    <div className="w-[240px] rounded-xl border border-amber-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-100 bg-amber-50 rounded-t-xl">
        <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
          <FileText className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{title}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-300 text-amber-600">Jinja2</Badge>
      </div>
      <div className="px-3 py-2">
        <div className="text-[10px] text-gray-500 mb-1">模板预览</div>
        <div className="text-xs bg-gray-900 text-green-400 rounded px-2 py-1 font-mono truncate">{preview}</div>
      </div>
    </div>
  )
}

// ── VariableAssigner 节点 ──────────────────────────────────────
export function VariableAssignerNode({ title = "变量赋值", ruleCount = 2 }: {
  title?: string; ruleCount?: number
}) {
  return (
    <div className="w-[240px] rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <div className="w-5 h-5 rounded bg-slate-500 flex items-center justify-center">
          <ArrowLeftRight className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{title}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-slate-300 text-slate-600">赋值</Badge>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">赋值规则</span>
          <Badge className="text-[10px] bg-slate-100 text-slate-700 border-0">{ruleCount} 条规则</Badge>
        </div>
      </div>
    </div>
  )
}

// ── ListOperator 节点 ──────────────────────────────────────
export function ListOperatorNode({ title = "列表操作", operation = "过滤" }: {
  title?: string; operation?: "过滤" | "排序" | "切片" | "去重"
}) {
  const opColor: Record<string, string> = {
    "过滤": "bg-blue-100 text-blue-700",
    "排序": "bg-green-100 text-green-700",
    "切片": "bg-orange-100 text-orange-700",
    "去重": "bg-purple-100 text-purple-700",
  }
  return (
    <div className="w-[240px] rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <div className="w-5 h-5 rounded bg-slate-500 flex items-center justify-center">
          <List className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{title}</span>
        <Badge className={cn("text-[10px] border-0", opColor[operation])}>{operation}</Badge>
      </div>
      <div className="px-3 py-2">
        <div className="text-[10px] text-gray-500">输入列表变量</div>
        <div className="text-xs bg-gray-50 rounded px-2 py-1 text-gray-700 mt-1 truncate">node.output</div>
      </div>
    </div>
  )
}

// ── DocumentExtractor 节点 ──────────────────────────────────────
export function DocumentExtractorNode({ title = "文档提取", mode = "自动" }: {
  title?: string; mode?: string
}) {
  return (
    <div className="w-[240px] rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <div className="w-5 h-5 rounded bg-slate-500 flex items-center justify-center">
          <FileSearch className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{title}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-slate-300 text-slate-600">{mode}</Badge>
      </div>
      <div className="px-3 py-2 space-y-1">
        <div className="text-[10px] text-gray-500">文件变量</div>
        <div className="text-xs bg-gray-50 rounded px-2 py-1 text-gray-700 truncate">sys.files[0]</div>
      </div>
    </div>
  )
}

// ── HumanInput 节点 ──────────────────────────────────────
export function HumanInputNode({ title = "人工输入", timeout = 0 }: {
  title?: string; timeout?: number
}) {
  return (
    <div className="w-[240px] rounded-xl border border-blue-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-100 bg-blue-50 rounded-t-xl">
        <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
          <UserCheck className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{title}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-300 text-blue-600">等待输入</Badge>
      </div>
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] text-gray-500">超时时间</span>
        <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0">
          {timeout === 0 ? "不限时" : `${timeout}s`}
        </Badge>
      </div>
    </div>
  )
}

// ── TriggerSchedule 节点 ──────────────────────────────────────
export function TriggerScheduleNode({ title = "定时触发", cron = "0 9 * * 1-5", nextRun = "明天 09:00" }: {
  title?: string; cron?: string; nextRun?: string
}) {
  return (
    <div className="w-[240px] rounded-xl border border-orange-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-orange-100 bg-orange-50 rounded-t-xl">
        <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center">
          <Clock className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{title}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-orange-300 text-orange-600">定时</Badge>
      </div>
      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Cron</span>
          <code className="text-[10px] bg-gray-100 rounded px-1 font-mono text-gray-700">{cron}</code>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">下次执行</span>
          <span className="text-[10px] text-orange-600">{nextRun}</span>
        </div>
      </div>
    </div>
  )
}

// ── Tool 节点 ──────────────────────────────────────
export function ToolNode({ title = "工具调用", toolName = "搜索工具", paramCount = 2 }: {
  title?: string; toolName?: string; paramCount?: number
}) {
  return (
    <div className="w-[240px] rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <div className="w-5 h-5 rounded bg-slate-500 flex items-center justify-center">
          <Wrench className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{title}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-slate-300 text-slate-600">工具</Badge>
      </div>
      <div className="px-3 py-2 space-y-1">
        <div className="text-xs font-medium text-gray-700 truncate">{toolName}</div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">参数</span>
          <Badge className="text-[10px] bg-slate-100 text-slate-700 border-0">{paramCount} 个</Badge>
        </div>
      </div>
    </div>
  )
}

// ── NoteNode 节点 ──────────────────────────────────────
const NOTE_THEMES: Record<string, { bg: string; border: string; text: string }> = {
  yellow:  { bg: "bg-yellow-50",  border: "border-yellow-200", text: "text-yellow-900" },
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-900"   },
  green:   { bg: "bg-green-50",   border: "border-green-200",  text: "text-green-900"  },
  purple:  { bg: "bg-purple-50",  border: "border-purple-200", text: "text-purple-900" },
  pink:    { bg: "bg-pink-50",    border: "border-pink-200",   text: "text-pink-900"   },
  orange:  { bg: "bg-orange-50",  border: "border-orange-200", text: "text-orange-900" },
  gray:    { bg: "bg-gray-50",    border: "border-gray-200",   text: "text-gray-900"   },
  white:   { bg: "bg-white",      border: "border-gray-200",   text: "text-gray-900"   },
}

export function NoteNode({
  content = "在此输入备注内容...",
  theme = "yellow",
  author,
  width = 240,
  height = 120,
}: {
  content?: string; theme?: keyof typeof NOTE_THEMES
  author?: string; width?: number; height?: number
}) {
  const t = NOTE_THEMES[theme] ?? NOTE_THEMES.yellow
  return (
    <div
      className={cn("rounded-xl border-2 p-3 relative", t.bg, t.border)}
      style={{ width, minHeight: height }}
    >
      <div className={cn("text-xs whitespace-pre-wrap", t.text)}>{content}</div>
      {author && (
        <div className={cn("text-[10px] mt-2 opacity-60", t.text)}>— {author}</div>
      )}
      {/* 右下角拖拽调整大小手柄 */}
      <div className="absolute bottom-1 right-1 w-3 h-3 cursor-se-resize opacity-40">
        <svg viewBox="0 0 12 12" fill="currentColor" className={t.text}>
          <path d="M10 2L2 10M10 6L6 10M10 10H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}
```

> **交互说明**
> - NoteNode 双击进入编辑模式，显示富文本工具栏（加粗/斜体/下划线/链接/列表）
> - 右下角拖拽手柄调整节点尺寸（最小 160×80px）
> - 主题色点击切换，8 种颜色实时预览
> - NoteNode 不参与工作流执行，无连接端口

---

## 12. 节点配置面板（完整 TSX）

> 所有配置面板遵循统一结构：380px 宽右侧抽屉，顶部节点色标题栏，三 Tab（参数配置 / 输入变量 / 输出变量），底部保存/重置按钮。
> `VarReferencePicker` 为变量选择器存根，真实实现为两级弹出选择器。

### 12.1 Code 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Code2, X } from "lucide-react"

function VarReferencePicker({ value, onChange, placeholder = "选择变量" }: {
  value?: string; onChange?: (v: string) => void; placeholder?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="sys.query">sys.query</SelectItem>
        <SelectItem value="sys.files">sys.files</SelectItem>
        <SelectItem value="node1.output">node1.output</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function CodeNodePanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<"params" | "inputs" | "outputs">("params")
  const [lang, setLang] = useState<"python3" | "javascript">("python3")
  const [inputs, setInputs] = useState([{ name: "input1", ref: "" }])
  const [code, setCode] = useState(`def main(input1: str) -> dict:\n    return {"output": input1}`)
  const tabs = [{ key: "params", label: "参数配置" }, { key: "inputs", label: "输入变量" }, { key: "outputs", label: "输出变量" }]
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-slate-50">
        <div className="w-5 h-5 rounded bg-slate-500 flex items-center justify-center">
          <Code2 className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">代码执行</span>
        <Badge variant="outline" className="text-[10px]">Code</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex border-b">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "params" && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">编程语言</label>
              <div className="flex gap-2">
                {(["python3", "javascript"] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${lang === l ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    {l === "python3" ? "Python 3" : "JavaScript"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">输入变量</label>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                  onClick={() => setInputs([...inputs, { name: `input${inputs.length + 1}`, ref: "" }])}>
                  <Plus className="w-3 h-3 mr-1" />添加
                </Button>
              </div>
              {inputs.map((inp, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input value={inp.name} onChange={e => setInputs(inputs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="h-7 w-24 text-xs border rounded px-2 bg-gray-50" placeholder="变量名" />
                  <div className="flex-1"><VarReferencePicker value={inp.ref} onChange={v => setInputs(inputs.map((x, j) => j === i ? { ...x, ref: v } : x))} /></div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500"
                    onClick={() => setInputs(inputs.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">代码编辑器</label>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2">同步函数签名</Button>
              </div>
              {/* 真实实现使用 @monaco-editor/react，此处用 Textarea 模拟 */}
              <Textarea value={code} onChange={e => setCode(e.target.value)}
                className="font-mono text-xs bg-gray-900 text-green-400 border-gray-700 min-h-[160px] resize-none" />
            </div>
          </>
        )}
        {tab === "outputs" && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500">输出变量由代码 return 字典自动推断</div>
            <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2">
              <span className="text-xs font-mono text-gray-700">output</span>
              <Badge variant="outline" className="text-[10px] ml-auto">string</Badge>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.2 IfElse 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, GitBranch, X, GripVertical } from "lucide-react"

type Condition = { varRef: string; operator: string; value: string }
type ConditionGroup = { id: string; logic: "AND" | "OR"; conditions: Condition[] }

const OPERATORS = ["包含", "不包含", "等于", "不等于", "大于", "小于", "大于等于", "小于等于", "为空", "不为空", "以...开头", "以...结尾"]

export function IfElseNodePanel({ onClose }: { onClose?: () => void }) {
  const [groups, setGroups] = useState<ConditionGroup[]>([
    { id: "if", logic: "AND", conditions: [{ varRef: "", operator: "包含", value: "" }] }
  ])
  const addElif = () => setGroups([...groups, { id: `elif-${Date.now()}`, logic: "AND", conditions: [{ varRef: "", operator: "包含", value: "" }] }])
  const removeGroup = (id: string) => setGroups(groups.filter(g => g.id !== id))
  const addCondition = (gid: string) => setGroups(groups.map(g => g.id === gid ? { ...g, conditions: [...g.conditions, { varRef: "", operator: "包含", value: "" }] } : g))
  const removeCondition = (gid: string, ci: number) => setGroups(groups.map(g => g.id === gid ? { ...g, conditions: g.conditions.filter((_, i) => i !== ci) } : g))
  const updateCondition = (gid: string, ci: number, field: keyof Condition, val: string) =>
    setGroups(groups.map(g => g.id === gid ? { ...g, conditions: g.conditions.map((c, i) => i === ci ? { ...c, [field]: val } : c) } : g))
  const toggleLogic = (gid: string) => setGroups(groups.map(g => g.id === gid ? { ...g, logic: g.logic === "AND" ? "OR" : "AND" } : g))
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-blue-50">
        <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
          <GitBranch className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">条件分支</span>
        <Badge variant="outline" className="text-[10px]">IF/ELSE</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {groups.map((group, gi) => (
          <div key={group.id} className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
              <div className="flex items-center gap-2">
                <GripVertical className="w-3 h-3 text-gray-400" />
                <Badge className={`text-[10px] ${group.id === "if" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"} border-0`}>
                  {group.id === "if" ? "IF" : "ELIF"}
                </Badge>
                <button onClick={() => toggleLogic(group.id)}
                  className="text-[10px] px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100">
                  {group.logic}
                </button>
              </div>
              {group.id !== "if" && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => removeGroup(group.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
            <div className="p-3 space-y-2">
              {group.conditions.map((cond, ci) => (
                <div key={ci} className="flex items-center gap-1">
                  <Select value={cond.varRef} onValueChange={v => updateCondition(group.id, ci, "varRef", v)}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="选择变量" /></SelectTrigger>
                    <SelectContent><SelectItem value="sys.query">sys.query</SelectItem><SelectItem value="node1.output">node1.output</SelectItem></SelectContent>
                  </Select>
                  <Select value={cond.operator} onValueChange={v => updateCondition(group.id, ci, "operator", v)}>
                    <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>{OPERATORS.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={cond.value} onChange={e => updateCondition(group.id, ci, "value", e.target.value)}
                    className="h-7 text-xs flex-1" placeholder="值" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeCondition(group.id, ci)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-gray-500" onClick={() => addCondition(group.id)}>
                <Plus className="w-3 h-3 mr-1" />添加条件
              </Button>
            </div>
          </div>
        ))}
        <div className="border-2 border-dashed border-gray-200 rounded-lg px-3 py-2 text-center">
          <Badge className="text-[10px] bg-gray-100 text-gray-600 border-0">ELSE</Badge>
          <div className="text-[10px] text-gray-400 mt-1">其他情况走此分支</div>
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={addElif}>
          <Plus className="w-3 h-3 mr-1" />添加 ELIF 分支
        </Button>
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.3 HTTP Request 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Globe, X } from "lucide-react"

type KVRow = { key: string; value: string }
type AuthType = "none" | "basic" | "bearer" | "apikey"
type BodyType = "none" | "form-data" | "x-www-form-urlencoded" | "raw"

export function HttpRequestNodePanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<"params" | "inputs" | "outputs">("params")
  const [method, setMethod] = useState("GET")
  const [url, setUrl] = useState("")
  const [authType, setAuthType] = useState<AuthType>("none")
  const [headers, setHeaders] = useState<KVRow[]>([{ key: "", value: "" }])
  const [params, setParams] = useState<KVRow[]>([{ key: "", value: "" }])
  const [bodyType, setBodyType] = useState<BodyType>("none")
  const [rawBody, setRawBody] = useState("")
  const [sslVerify, setSslVerify] = useState(true)
  const [timeout, setTimeout_] = useState(10)
  const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"]
  const addRow = (setter: React.Dispatch<React.SetStateAction<KVRow[]>>) =>
    setter(prev => [...prev, { key: "", value: "" }])
  const removeRow = (setter: React.Dispatch<React.SetStateAction<KVRow[]>>, i: number) =>
    setter(prev => prev.filter((_, j) => j !== i))
  const updateRow = (setter: React.Dispatch<React.SetStateAction<KVRow[]>>, i: number, field: "key" | "value", val: string) =>
    setter(prev => prev.map((r, j) => j === i ? { ...r, [field]: val } : r))
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-blue-50">
        <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
          <Globe className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">HTTP 请求</span>
        <Badge variant="outline" className="text-[10px]">HTTP</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex border-b">
        {[{ key: "params", label: "参数配置" }, { key: "inputs", label: "输入变量" }, { key: "outputs", label: "输出变量" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "params" && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">请求方法 & URL</label>
              <div className="flex gap-2">
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={url} onChange={e => setUrl(e.target.value)} className="h-8 text-xs flex-1" placeholder="https://api.example.com/endpoint" />
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2 mt-1 text-gray-500">导入 cURL</Button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">认证方式</label>
              <Select value={authType} onValueChange={v => setAuthType(v as AuthType)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无认证</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="apikey">API Key</SelectItem>
                </SelectContent>
              </Select>
              {authType === "bearer" && <Input className="h-7 text-xs mt-2" placeholder="Bearer Token" />}
              {authType === "basic" && <div className="flex gap-2 mt-2"><Input className="h-7 text-xs" placeholder="用户名" /><Input className="h-7 text-xs" placeholder="密码" type="password" /></div>}
              {authType === "apikey" && <div className="flex gap-2 mt-2"><Input className="h-7 text-xs" placeholder="Header 名称" /><Input className="h-7 text-xs" placeholder="API Key 值" /></div>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">请求头</label>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => addRow(setHeaders)}><Plus className="w-3 h-3 mr-1" />添加</Button>
              </div>
              {headers.map((h, i) => (
                <div key={i} className="flex gap-1 mb-1">
                  <Input value={h.key} onChange={e => updateRow(setHeaders, i, "key", e.target.value)} className="h-7 text-xs w-32" placeholder="Key" />
                  <Input value={h.value} onChange={e => updateRow(setHeaders, i, "value", e.target.value)} className="h-7 text-xs flex-1" placeholder="Value" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeRow(setHeaders, i)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">请求体</label>
              <Select value={bodyType} onValueChange={v => setBodyType(v as BodyType)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无</SelectItem>
                  <SelectItem value="form-data">form-data</SelectItem>
                  <SelectItem value="x-www-form-urlencoded">x-www-form-urlencoded</SelectItem>
                  <SelectItem value="raw">raw (JSON/XML/text)</SelectItem>
                </SelectContent>
              </Select>
              {bodyType === "raw" && <Textarea value={rawBody} onChange={e => setRawBody(e.target.value)} className="mt-2 text-xs font-mono min-h-[80px]" placeholder='{"key": "value"}' />}
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-700">SSL 验证</label>
              <Switch checked={sslVerify} onCheckedChange={setSslVerify} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700 flex-1">超时时间（秒）</label>
              <Input type="number" value={timeout} onChange={e => setTimeout_(Number(e.target.value))} className="h-7 text-xs w-20" min={0} />
            </div>
          </>
        )}
        {tab === "outputs" && (
          <div className="space-y-2">
            {[{ name: "body", type: "string" }, { name: "status_code", type: "number" }, { name: "headers", type: "object" }, { name: "files", type: "array[file]" }].map(v => (
              <div key={v.name} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2">
                <span className="text-xs font-mono text-gray-700 flex-1">{v.name}</span>
                <Badge variant="outline" className="text-[10px]">{v.type}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.4 Knowledge Retrieval 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { BookOpen, X } from "lucide-react"

const KNOWLEDGE_BASES = [
  { id: "kb1", name: "产品文档库", docCount: 128 },
  { id: "kb2", name: "FAQ 知识库", docCount: 56 },
  { id: "kb3", name: "技术手册", docCount: 234 },
]

export function KnowledgeRetrievalNodePanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<"params" | "inputs" | "outputs">("params")
  const [queryVar, setQueryVar] = useState("")
  const [selectedKBs, setSelectedKBs] = useState<string[]>([])
  const [retrievalMode, setRetrievalMode] = useState<"single" | "multi" | "hybrid">("single")
  const [topK, setTopK] = useState(3)
  const toggleKB = (id: string) => setSelectedKBs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-green-50">
        <div className="w-5 h-5 rounded bg-green-500 flex items-center justify-center">
          <BookOpen className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">知识检索</span>
        <Badge variant="outline" className="text-[10px]">Knowledge</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex border-b">
        {[{ key: "params", label: "参数配置" }, { key: "inputs", label: "输入变量" }, { key: "outputs", label: "输出变量" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "params" && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">查询变量</label>
              <Select value={queryVar} onValueChange={setQueryVar}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="选择查询变量" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sys.query">sys.query</SelectItem>
                  <SelectItem value="node1.output">node1.output</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">知识库（可多选）</label>
              <div className="space-y-2">
                {KNOWLEDGE_BASES.map(kb => (
                  <div key={kb.id} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleKB(kb.id)}>
                    <Checkbox checked={selectedKBs.includes(kb.id)} onCheckedChange={() => toggleKB(kb.id)} />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-800">{kb.name}</div>
                      <div className="text-[10px] text-gray-500">{kb.docCount} 个文档</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">检索模式</label>
              <div className="flex gap-2">
                {[{ v: "single", label: "单路" }, { v: "multi", label: "多路" }, { v: "hybrid", label: "混合" }].map(m => (
                  <button key={m.v} onClick={() => setRetrievalMode(m.v as typeof retrievalMode)}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${retrievalMode === m.v ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {(retrievalMode === "multi" || retrievalMode === "hybrid") && (
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Reranker 模型</label>
                <Select>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="选择 Reranker 模型" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bge-reranker">BGE Reranker</SelectItem>
                    <SelectItem value="cohere-rerank">Cohere Rerank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700 flex-1">返回结果数量 (Top-K)</label>
              <Input type="number" value={topK} onChange={e => setTopK(Number(e.target.value))}
                className="h-7 text-xs w-16" min={1} max={20} />
            </div>
          </>
        )}
        {tab === "outputs" && (
          <div className="space-y-2">
            {[{ name: "result", type: "array[object]" }, { name: "result_str", type: "string" }].map(v => (
              <div key={v.name} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2">
                <span className="text-xs font-mono text-gray-700 flex-1">{v.name}</span>
                <Badge variant="outline" className="text-[10px]">{v.type}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.5 Iteration 容器节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { RefreshCw, X } from "lucide-react"

type ErrorMode = "terminated" | "continueOnError" | "removeAbnormal"

export function IterationNodePanel({ onClose }: { onClose?: () => void }) {
  const [inputVar, setInputVar] = useState("")
  const [parallelEnabled, setParallelEnabled] = useState(false)
  const [parallelLimit, setParallelLimit] = useState(10)
  const [errorMode, setErrorMode] = useState<ErrorMode>("terminated")
  const [flattenOutput, setFlattenOutput] = useState(false)
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-blue-50">
        <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
          <RefreshCw className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">迭代</span>
        <Badge variant="outline" className="text-[10px]">Iteration</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">输入数组变量</label>
          <Select value={inputVar} onValueChange={setInputVar}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="选择数组变量" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="node1.list">node1.list</SelectItem>
              <SelectItem value="sys.files">sys.files</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-[10px] text-gray-400 mt-1">迭代器将遍历此数组的每个元素</div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-700">并行执行</div>
            <div className="text-[10px] text-gray-400">同时处理多个迭代项</div>
          </div>
          <Switch checked={parallelEnabled} onCheckedChange={setParallelEnabled} />
        </div>
        {parallelEnabled && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">最大并行数</label>
              <span className="text-xs text-primary font-medium">{parallelLimit}</span>
            </div>
            <Slider value={[parallelLimit]} onValueChange={([v]) => setParallelLimit(v)} min={1} max={100} step={1} className="w-full" />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-2 block">错误处理策略</label>
          <div className="space-y-2">
            {[
              { v: "terminated", label: "终止迭代", desc: "遇到错误立即停止整个迭代" },
              { v: "continueOnError", label: "继续执行", desc: "跳过错误项，继续处理其余项" },
              { v: "removeAbnormal", label: "移除异常输出", desc: "从输出数组中移除失败项" },
            ].map(opt => (
              <div key={opt.v} className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${errorMode === opt.v ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"}`}
                onClick={() => setErrorMode(opt.v as ErrorMode)}>
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center ${errorMode === opt.v ? "border-primary" : "border-gray-300"}`}>
                  {errorMode === opt.v && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-800">{opt.label}</div>
                  <div className="text-[10px] text-gray-500">{opt.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-700">展平输出</div>
            <div className="text-[10px] text-gray-400">将嵌套数组展平为一维数组</div>
          </div>
          <Switch checked={flattenOutput} onCheckedChange={setFlattenOutput} />
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.6 Loop 容器节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Repeat, X } from "lucide-react"

type LoopVar = { name: string; type: string; initialValue: string }
type BreakCondition = { varRef: string; operator: string; value: string }

export function LoopNodePanel({ onClose }: { onClose?: () => void }) {
  const [loopVars, setLoopVars] = useState<LoopVar[]>([{ name: "counter", type: "number", initialValue: "0" }])
  const [conditions, setConditions] = useState<BreakCondition[]>([{ varRef: "", operator: "大于等于", value: "10" }])
  const [logic, setLogic] = useState<"AND" | "OR">("AND")
  const [maxCount, setMaxCount] = useState(100)
  const OPERATORS = ["等于", "不等于", "大于", "小于", "大于等于", "小于等于"]
  const VAR_TYPES = ["string", "number", "boolean", "array", "object"]
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-purple-50">
        <div className="w-5 h-5 rounded bg-purple-500 flex items-center justify-center">
          <Repeat className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">循环</span>
        <Badge variant="outline" className="text-[10px]">Loop</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">循环变量</label>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
              onClick={() => setLoopVars([...loopVars, { name: `var${loopVars.length + 1}`, type: "number", initialValue: "0" }])}>
              <Plus className="w-3 h-3 mr-1" />添加
            </Button>
          </div>
          {loopVars.map((v, i) => (
            <div key={i} className="flex items-center gap-1 mb-2">
              <Input value={v.name} onChange={e => setLoopVars(loopVars.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                className="h-7 text-xs w-24" placeholder="变量名" />
              <Select value={v.type} onValueChange={val => setLoopVars(loopVars.map((x, j) => j === i ? { ...x, type: val } : x))}>
                <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{VAR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={v.initialValue} onChange={e => setLoopVars(loopVars.map((x, j) => j === i ? { ...x, initialValue: e.target.value } : x))}
                className="h-7 text-xs flex-1" placeholder="初始值" />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500"
                onClick={() => setLoopVars(loopVars.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">退出条件</label>
            <button onClick={() => setLogic(l => l === "AND" ? "OR" : "AND")}
              className="text-[10px] px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100">{logic}</button>
          </div>
          {conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-1 mb-2">
              <Select value={c.varRef} onValueChange={v => setConditions(conditions.map((x, j) => j === i ? { ...x, varRef: v } : x))}>
                <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="变量" /></SelectTrigger>
                <SelectContent><SelectItem value="counter">counter</SelectItem></SelectContent>
              </Select>
              <Select value={c.operator} onValueChange={v => setConditions(conditions.map((x, j) => j === i ? { ...x, operator: v } : x))}>
                <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                <SelectContent>{OPERATORS.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={c.value} onChange={e => setConditions(conditions.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                className="h-7 text-xs flex-1" placeholder="值" />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500"
                onClick={() => setConditions(conditions.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-gray-500"
            onClick={() => setConditions([...conditions, { varRef: "", operator: "等于", value: "" }])}>
            <Plus className="w-3 h-3 mr-1" />添加条件
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 flex-1">最大循环次数</label>
          <Input type="number" value={maxCount} onChange={e => setMaxCount(Number(e.target.value))}
            className="h-7 text-xs w-20" min={1} max={1000} />
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.7 Agent 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Bot, X, Plus, Trash2 } from "lucide-react"

const TOOLS = [
  { id: "search", name: "网络搜索", desc: "搜索互联网信息" },
  { id: "calculator", name: "计算器", desc: "执行数学计算" },
  { id: "code_runner", name: "代码执行", desc: "运行 Python 代码" },
]

export function AgentNodePanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<"params" | "inputs" | "outputs">("params")
  const [strategy, setStrategy] = useState<"function_calling" | "react">("function_calling")
  const [model, setModel] = useState("gpt-4o")
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [maxSteps, setMaxSteps] = useState(5)
  const [memoryEnabled, setMemoryEnabled] = useState(false)
  const [historyCount, setHistoryCount] = useState(3)
  const [outputFields, setOutputFields] = useState([{ name: "output", type: "string" }])
  const toggleTool = (id: string) => setSelectedTools(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-indigo-50">
        <div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center">
          <Bot className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">Agent</span>
        <Badge variant="outline" className="text-[10px]">Agent</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex border-b">
        {[{ key: "params", label: "参数配置" }, { key: "inputs", label: "输入变量" }, { key: "outputs", label: "输出变量" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "params" && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Agent 策略</label>
              <div className="flex gap-2">
                {[{ v: "function_calling", label: "Function Calling" }, { v: "react", label: "ReAct" }].map(s => (
                  <button key={s.v} onClick={() => setStrategy(s.v as typeof strategy)}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors ${strategy === s.v ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">模型</label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">工具</label>
              <div className="space-y-2">
                {TOOLS.map(tool => (
                  <div key={tool.id} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${selectedTools.includes(tool.id) ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"}`}
                    onClick={() => toggleTool(tool.id)}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedTools.includes(tool.id) ? "border-primary bg-primary" : "border-gray-300"}`}>
                      {selectedTools.includes(tool.id) && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-800">{tool.name}</div>
                      <div className="text-[10px] text-gray-500">{tool.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-700">最大执行步数</label>
                <span className="text-xs text-primary font-medium">{maxSteps}</span>
              </div>
              <Slider value={[maxSteps]} onValueChange={([v]) => setMaxSteps(v)} min={1} max={20} step={1} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-700">记忆（Chatflow 专属）</div>
                <div className="text-[10px] text-gray-400">使用对话历史作为上下文</div>
              </div>
              <Switch checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
            </div>
            {memoryEnabled && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-700 flex-1">历史消息数量</label>
                <Input type="number" value={historyCount} onChange={e => setHistoryCount(Number(e.target.value))}
                  className="h-7 text-xs w-16" min={1} max={50} />
              </div>
            )}
          </>
        )}
        {tab === "outputs" && (
          <div className="space-y-2">
            {outputFields.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={f.name} onChange={e => setOutputFields(outputFields.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  className="h-7 text-xs flex-1" placeholder="字段名" />
                <Select value={f.type} onValueChange={v => setOutputFields(outputFields.map((x, j) => j === i ? { ...x, type: v } : x))}>
                  <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["string", "number", "boolean", "object", "array"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500"
                  onClick={() => setOutputFields(outputFields.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-gray-500"
              onClick={() => setOutputFields([...outputFields, { name: "", type: "string" }])}>
              <Plus className="w-3 h-3 mr-1" />添加输出字段
            </Button>
          </div>
        )}
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.8 Answer 节点配置面板（Chatflow 专属）

```tsx
"use client"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, X, Plus } from "lucide-react"

const VAR_CHIPS = [
  { label: "sys.query", color: "bg-blue-100 text-blue-700" },
  { label: "llm1.text", color: "bg-purple-100 text-purple-700" },
  { label: "node1.output", color: "bg-green-100 text-green-700" },
]

export function AnswerNodePanel({ onClose }: { onClose?: () => void }) {
  const [content, setContent] = useState("您好！根据您的问题：{{sys.query}}\n\n{{llm1.text}}")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const insertVar = (varName: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const newContent = content.slice(0, start) + `{{${varName}}}` + content.slice(end)
    setContent(newContent)
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + varName.length + 4; ta.focus() }, 0)
  }
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-blue-50">
        <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
          <MessageSquare className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">回复</span>
        <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0">Chatflow 专属</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-2 block">回复内容</label>
          <div className="border rounded-lg overflow-hidden">
            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b">
              <span className="text-[10px] text-gray-500 self-center mr-1">插入变量：</span>
              {VAR_CHIPS.map(v => (
                <button key={v.label} onClick={() => insertVar(v.label)}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${v.color} hover:opacity-80 transition-opacity`}>
                  {v.label}
                </button>
              ))}
              <button className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300">
                <Plus className="w-2.5 h-2.5 inline" /> 更多
              </button>
            </div>
            <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)}
              className="w-full p-3 text-xs resize-none min-h-[160px] focus:outline-none"
              placeholder="输入回复内容，使用 {{变量名}} 插入变量..." />
          </div>
          <div className="text-[10px] text-gray-400 mt-1">支持 Markdown 格式，使用 {"{{变量名}}"} 引用变量</div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">文件变量（可选）</label>
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center">
            <div className="text-[10px] text-gray-400">选择文件类型变量以附加到回复</div>
            <Button variant="ghost" size="sm" className="h-6 text-xs mt-1">选择变量</Button>
          </div>
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.9 End 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Square, X } from "lucide-react"

type OutputVar = { name: string; varRef: string }

export function EndNodePanel({ onClose }: { onClose?: () => void }) {
  const [outputs, setOutputs] = useState<OutputVar[]>([{ name: "result", varRef: "" }])
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
        <div className="w-5 h-5 rounded bg-gray-500 flex items-center justify-center">
          <Square className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">结束</span>
        <Badge variant="outline" className="text-[10px]">End</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">输出变量映射</label>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
              onClick={() => setOutputs([...outputs, { name: "", varRef: "" }])}>
              <Plus className="w-3 h-3 mr-1" />添加
            </Button>
          </div>
          <div className="text-[10px] text-gray-400 mb-3">定义工作流的最终输出，可在运行结果中查看</div>
          {outputs.map((out, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <Input value={out.name} onChange={e => setOutputs(outputs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                className="h-7 text-xs w-28" placeholder="输出名称" />
              <Select value={out.varRef} onValueChange={v => setOutputs(outputs.map((x, j) => j === i ? { ...x, varRef: v } : x))}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="选择变量" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="llm1.text">llm1.text</SelectItem>
                  <SelectItem value="code1.output">code1.output</SelectItem>
                  <SelectItem value="node1.result">node1.result</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500"
                onClick={() => setOutputs(outputs.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.10 QuestionClassifier 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, HelpCircle, X, GripVertical, ChevronDown } from "lucide-react"

type ClassItem = { id: string; name: string; description: string }

export function QuestionClassifierNodePanel({ onClose }: { onClose?: () => void }) {
  const [queryVar, setQueryVar] = useState("sys.query")
  const [model, setModel] = useState("gpt-4o")
  const [classes, setClasses] = useState<ClassItem[]>([
    { id: "1", name: "技术问题", description: "关于产品技术实现的问题" },
    { id: "2", name: "价格咨询", description: "关于产品定价和套餐的问题" },
  ])
  const [showInstruction, setShowInstruction] = useState(false)
  const [instruction, setInstruction] = useState("")
  const addClass = () => setClasses([...classes, { id: Date.now().toString(), name: "", description: "" }])
  const removeClass = (id: string) => setClasses(classes.filter(c => c.id !== id))
  const updateClass = (id: string, field: keyof ClassItem, val: string) =>
    setClasses(classes.map(c => c.id === id ? { ...c, [field]: val } : c))
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-amber-50">
        <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
          <HelpCircle className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">问题分类</span>
        <Badge variant="outline" className="text-[10px]">Classifier</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">查询变量</label>
          <Select value={queryVar} onValueChange={setQueryVar}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="sys.query">sys.query</SelectItem><SelectItem value="node1.output">node1.output</SelectItem></SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">模型</label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">分类列表</label>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={addClass}>
              <Plus className="w-3 h-3 mr-1" />添加分类
            </Button>
          </div>
          <div className="space-y-2">
            {classes.map((cls, i) => (
              <div key={cls.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-3 h-3 text-gray-400 cursor-grab" />
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0 w-5 h-5 flex items-center justify-center p-0">{i + 1}</Badge>
                  <Input value={cls.name} onChange={e => updateClass(cls.id, "name", e.target.value)}
                    className="h-7 text-xs flex-1" placeholder="分类名称" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeClass(cls.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input value={cls.description} onChange={e => updateClass(cls.id, "description", e.target.value)}
                  className="h-7 text-xs" placeholder="分类描述（帮助模型理解分类意图）" />
              </div>
            ))}
          </div>
        </div>
        <div>
          <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700" onClick={() => setShowInstruction(!showInstruction)}>
            <ChevronDown className={`w-3 h-3 transition-transform ${showInstruction ? "rotate-180" : ""}`} />
            自定义指令（可选）
          </button>
          {showInstruction && (
            <Textarea value={instruction} onChange={e => setInstruction(e.target.value)}
              className="mt-2 text-xs min-h-[80px]" placeholder="补充分类规则或特殊说明..." />
          )}
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.11 ParameterExtractor 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Sliders, X, ChevronDown } from "lucide-react"

type Param = { name: string; type: string; description: string; required: boolean }

export function ParameterExtractorNodePanel({ onClose }: { onClose?: () => void }) {
  const [inputVar, setInputVar] = useState("")
  const [model, setModel] = useState("gpt-4o")
  const [params, setParams] = useState<Param[]>([
    { name: "name", type: "string", description: "用户姓名", required: true },
    { name: "age", type: "number", description: "用户年龄", required: false },
  ])
  const [showInstruction, setShowInstruction] = useState(false)
  const [instruction, setInstruction] = useState("")
  const addParam = () => setParams([...params, { name: "", type: "string", description: "", required: false }])
  const removeParam = (i: number) => setParams(params.filter((_, j) => j !== i))
  const updateParam = (i: number, field: keyof Param, val: string | boolean) =>
    setParams(params.map((p, j) => j === i ? { ...p, [field]: val } : p))
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-amber-50">
        <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
          <Sliders className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">参数提取</span>
        <Badge variant="outline" className="text-[10px]">Extractor</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">输入文本变量</label>
          <Select value={inputVar} onValueChange={setInputVar}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="选择文本变量" /></SelectTrigger>
            <SelectContent><SelectItem value="sys.query">sys.query</SelectItem><SelectItem value="node1.output">node1.output</SelectItem></SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">模型</label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">参数列表</label>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={addParam}>
              <Plus className="w-3 h-3 mr-1" />添加参数
            </Button>
          </div>
          <div className="space-y-2">
            {params.map((p, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={p.name} onChange={e => updateParam(i, "name", e.target.value)}
                    className="h-7 text-xs flex-1" placeholder="参数名" />
                  <Select value={p.type} onValueChange={v => updateParam(i, "type", v)}>
                    <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["string", "number", "boolean", "array", "object"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeParam(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <Input value={p.description} onChange={e => updateParam(i, "description", e.target.value)}
                  className="h-7 text-xs" placeholder="参数描述" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">必填</span>
                  <Switch checked={p.required} onCheckedChange={v => updateParam(i, "required", v)} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700" onClick={() => setShowInstruction(!showInstruction)}>
            <ChevronDown className={`w-3 h-3 transition-transform ${showInstruction ? "rotate-180" : ""}`} />
            自定义指令（可选）
          </button>
          {showInstruction && (
            <Textarea value={instruction} onChange={e => setInstruction(e.target.value)}
              className="mt-2 text-xs min-h-[80px]" placeholder="补充提取规则..." />
          )}
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.12 TemplateTransform 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, FileText, X } from "lucide-react"

type InputVar = { name: string; varRef: string }

export function TemplateTransformNodePanel({ onClose }: { onClose?: () => void }) {
  const [inputs, setInputs] = useState<InputVar[]>([{ name: "name", varRef: "" }, { name: "content", varRef: "" }])
  const [template, setTemplate] = useState("你好，{{name}}！\n\n以下是您的内容：\n{{content}}")
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-amber-50">
        <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
          <FileText className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">模板转换</span>
        <Badge variant="outline" className="text-[10px]">Jinja2</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">输入变量</label>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
              onClick={() => setInputs([...inputs, { name: "", varRef: "" }])}>
              <Plus className="w-3 h-3 mr-1" />添加
            </Button>
          </div>
          {inputs.map((inp, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <Input value={inp.name} onChange={e => setInputs(inputs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                className="h-7 text-xs w-24" placeholder="变量名" />
              <Select value={inp.varRef} onValueChange={v => setInputs(inputs.map((x, j) => j === i ? { ...x, varRef: v } : x))}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="选择变量" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sys.query">sys.query</SelectItem>
                  <SelectItem value="node1.output">node1.output</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500"
                onClick={() => setInputs(inputs.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Jinja2 模板</label>
          <Textarea value={template} onChange={e => setTemplate(e.target.value)}
            className="text-xs font-mono min-h-[160px]" placeholder="使用 {{变量名}} 引用输入变量" />
          <div className="text-[10px] text-gray-400 mt-1">支持 Jinja2 语法：{"{{var}}"} 变量、{"{% if %}...{% endif %}"} 条件、{"{% for %}...{% endfor %}"} 循环</div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">输出变量</label>
          <div className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2">
            <span className="text-xs font-mono text-gray-700 flex-1">output</span>
            <Badge variant="outline" className="text-[10px]">string</Badge>
          </div>
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.13 VariableAssigner 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, ArrowLeftRight, X, ArrowRight } from "lucide-react"

type AssignRule = { targetVar: string; sourceVar: string }

export function VariableAssignerNodePanel({ onClose }: { onClose?: () => void }) {
  const [rules, setRules] = useState<AssignRule[]>([{ targetVar: "", sourceVar: "" }])
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-slate-50">
        <div className="w-5 h-5 rounded bg-slate-500 flex items-center justify-center">
          <ArrowLeftRight className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">变量赋值</span>
        <Badge variant="outline" className="text-[10px]">Assigner</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-[10px] text-gray-500 bg-blue-50 rounded p-2">
          将源变量的值赋给目标变量（对话变量或环境变量）。常用于在 Chatflow 中更新对话状态。
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">赋值规则</label>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
              onClick={() => setRules([...rules, { targetVar: "", sourceVar: "" }])}>
              <Plus className="w-3 h-3 mr-1" />添加
            </Button>
          </div>
          {rules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <Select value={rule.targetVar} onValueChange={v => setRules(rules.map((x, j) => j === i ? { ...x, targetVar: v } : x))}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="目标变量" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="conversation.user_name">conversation.user_name</SelectItem>
                  <SelectItem value="conversation.count">conversation.count</SelectItem>
                  <SelectItem value="env.api_key">env.api_key</SelectItem>
                </SelectContent>
              </Select>
              <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <Select value={rule.sourceVar} onValueChange={v => setRules(rules.map((x, j) => j === i ? { ...x, sourceVar: v } : x))}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="源变量" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sys.query">sys.query</SelectItem>
                  <SelectItem value="node1.output">node1.output</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500"
                onClick={() => setRules(rules.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.14 HumanInput 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, UserCheck, X } from "lucide-react"

type FormField = { name: string; type: string; required: boolean; label: string }

export function HumanInputNodePanel({ onClose }: { onClose?: () => void }) {
  const [prompt, setPrompt] = useState("请审核以下内容并提供反馈：\n\n{{llm1.text}}")
  const [timeout, setTimeout_] = useState(0)
  const [fields, setFields] = useState<FormField[]>([
    { name: "approved", type: "boolean", required: true, label: "是否批准" },
    { name: "feedback", type: "string", required: false, label: "反馈意见" },
  ])
  const [delivery, setDelivery] = useState<"email" | "webhook">("email")
  const [email, setEmail] = useState("")
  const addField = () => setFields([...fields, { name: "", type: "string", required: false, label: "" }])
  const removeField = (i: number) => setFields(fields.filter((_, j) => j !== i))
  const updateField = (i: number, field: keyof FormField, val: string | boolean) =>
    setFields(fields.map((f, j) => j === i ? { ...f, [field]: val } : f))
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-blue-50">
        <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
          <UserCheck className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">人工输入</span>
        <Badge variant="outline" className="text-[10px]">Human</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">提示内容</label>
          <Textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            className="text-xs min-h-[100px]" placeholder="向人工审核员展示的提示信息，支持 {{变量}} 引用" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 flex-1">超时时间（秒，0 = 不限时）</label>
          <Input type="number" value={timeout} onChange={e => setTimeout_(Number(e.target.value))}
            className="h-7 text-xs w-20" min={0} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">输入字段</label>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={addField}>
              <Plus className="w-3 h-3 mr-1" />添加字段
            </Button>
          </div>
          {fields.map((f, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 mb-2">
              <div className="flex items-center gap-2">
                <Input value={f.label} onChange={e => updateField(i, "label", e.target.value)}
                  className="h-7 text-xs flex-1" placeholder="字段标签" />
                <Select value={f.type} onValueChange={v => updateField(i, "type", v)}>
                  <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["string", "number", "boolean", "select"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeField(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input value={f.name} onChange={e => updateField(i, "name", e.target.value)}
                  className="h-7 text-xs flex-1" placeholder="字段名（变量名）" />
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500">必填</span>
                  <Switch checked={f.required} onCheckedChange={v => updateField(i, "required", v)} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">通知方式</label>
          <div className="flex gap-2">
            {[{ v: "email", label: "邮件" }, { v: "webhook", label: "Webhook" }].map(d => (
              <button key={d.v} onClick={() => setDelivery(d.v as typeof delivery)}
                className={`flex-1 py-1.5 text-xs rounded border transition-colors ${delivery === d.v ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600"}`}>
                {d.label}
              </button>
            ))}
          </div>
          {delivery === "email" && (
            <Input value={email} onChange={e => setEmail(e.target.value)}
              className="h-7 text-xs mt-2" placeholder="审核员邮箱地址" type="email" />
          )}
          {delivery === "webhook" && (
            <Input className="h-7 text-xs mt-2" placeholder="Webhook URL" />
          )}
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.15 TriggerWebhook 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Webhook, X, Copy, Check } from "lucide-react"

export function TriggerWebhookNodePanel({ onClose }: { onClose?: () => void }) {
  const [copied, setCopied] = useState(false)
  const webhookUrl = "https://api.example.com/webhook/wf_abc123xyz"
  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-orange-50">
        <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center">
          <Webhook className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">Webhook 触发</span>
        <Badge variant="outline" className="text-[10px]">Trigger</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-orange-50 rounded-lg p-3 text-[10px] text-orange-700">
          通过 HTTP POST 请求触发此工作流。请求体中的 JSON 数据将作为输入变量。
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Webhook URL</label>
          <div className="flex items-center gap-2">
            <Input value={webhookUrl} readOnly className="h-8 text-xs bg-gray-50 font-mono flex-1" />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={copyUrl}>
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">请求方法</label>
          <Input value="POST" readOnly className="h-7 text-xs bg-gray-50" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-2 block">输出变量（来自请求体）</label>
          {[{ name: "body", type: "object" }, { name: "headers", type: "object" }, { name: "query", type: "object" }].map(v => (
            <div key={v.name} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 mb-1">
              <span className="text-xs font-mono text-gray-700 flex-1">{v.name}</span>
              <Badge variant="outline" className="text-[10px]">{v.type}</Badge>
            </div>
          ))}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">测试请求</label>
          <Button variant="outline" size="sm" className="w-full h-8 text-xs">发送测试请求</Button>
        </div>
      </div>
    </div>
  )
}
```

### 12.16 TriggerSchedule 节点配置面板

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Clock, X } from "lucide-react"

const CRON_PRESETS = [
  { label: "每分钟", value: "* * * * *" },
  { label: "每小时", value: "0 * * * *" },
  { label: "每天 9:00", value: "0 9 * * *" },
  { label: "每周一 9:00", value: "0 9 * * 1" },
  { label: "每月 1 日 9:00", value: "0 9 1 * *" },
  { label: "自定义", value: "custom" },
]

export function TriggerScheduleNodePanel({ onClose }: { onClose?: () => void }) {
  const [preset, setPreset] = useState("0 9 * * *")
  const [customCron, setCustomCron] = useState("0 9 * * *")
  const [timezone, setTimezone] = useState("Asia/Shanghai")
  const isCustom = preset === "custom"
  const cronValue = isCustom ? customCron : preset
  const CRON_FIELDS = ["分钟", "小时", "日", "月", "星期"]
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-orange-50">
        <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center">
          <Clock className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium flex-1">定时触发</span>
        <Badge variant="outline" className="text-[10px]">Schedule</Badge>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">执行频率</label>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CRON_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isCustom && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Cron 表达式</label>
            <Input value={customCron} onChange={e => setCustomCron(e.target.value)}
              className="h-7 text-xs font-mono" placeholder="* * * * *" />
            <div className="flex gap-1 mt-1">
              {CRON_FIELDS.map(f => (
                <div key={f} className="flex-1 text-center text-[9px] text-gray-400 bg-gray-50 rounded py-0.5">{f}</div>
              ))}
            </div>
          </div>
        )}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[10px] text-gray-500 mb-1">当前 Cron 表达式</div>
          <code className="text-xs font-mono text-gray-800">{cronValue}</code>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">时区</label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Asia/Shanghai">Asia/Shanghai (UTC+8)</SelectItem>
              <SelectItem value="UTC">UTC</SelectItem>
              <SelectItem value="America/New_York">America/New_York (UTC-5)</SelectItem>
              <SelectItem value="Europe/London">Europe/London (UTC+0)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">下次执行时间</label>
          <Input value="2026-05-15 09:00:00 (Asia/Shanghai)" readOnly className="h-7 text-xs bg-gray-50" />
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">重置</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">保存</Button>
      </div>
    </div>
  )
}
```

### 12.17 RetryConfig 共享组件

> 作为"高级设置"折叠区嵌入 LLM、HTTP Request、Tool、Agent、Knowledge Retrieval 等节点面板。

```tsx
"use client"
import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { ChevronDown, RefreshCw } from "lucide-react"

export function RetryConfig() {
  const [expanded, setExpanded] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [maxRetries, setMaxRetries] = useState(3)
  const [interval, setInterval_] = useState(1000)
  return (
    <div className="border rounded-lg overflow-hidden">
      <button className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3 h-3 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">重试配置</span>
        </div>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-700">启用重试</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          {enabled && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-700">最大重试次数</span>
                  <Input type="number" value={maxRetries} onChange={e => setMaxRetries(Number(e.target.value))}
                    className="h-6 text-xs w-14 text-center" min={1} max={10} />
                </div>
                <Slider value={[maxRetries]} onValueChange={([v]) => setMaxRetries(v)} min={1} max={10} step={1} />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>1</span><span>10</span></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-700">重试间隔（ms）</span>
                  <Input type="number" value={interval} onChange={e => setInterval_(Number(e.target.value))}
                    className="h-6 text-xs w-16 text-center" min={100} max={5000} step={100} />
                </div>
                <Slider value={[interval]} onValueChange={([v]) => setInterval_(v)} min={100} max={5000} step={100} />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>100ms</span><span>5000ms</span></div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

### 12.18 ErrorHandleConfig 共享组件

> 作为"错误处理"折叠区嵌入支持错误处理的节点面板（LLM、HTTP、Code、Tool 等）。

```tsx
"use client"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ChevronDown, AlertTriangle } from "lucide-react"

type ErrorStrategy = "none" | "failBranch" | "defaultValue"

export function ErrorHandleConfig({ outputVars = [{ name: "output", type: "string" }] }: {
  outputVars?: { name: string; type: string }[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [strategy, setStrategy] = useState<ErrorStrategy>("none")
  const [defaults, setDefaults] = useState<Record<string, string>>({})
  return (
    <div className="border rounded-lg overflow-hidden">
      <button className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-gray-500" />
          <span className="text-xs font-medium text-gray-700">错误处理</span>
        </div>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="p-3 space-y-3">
          <div className="space-y-2">
            {[
              { v: "none", label: "无处理", desc: "节点失败时整个工作流停止" },
              { v: "failBranch", label: "失败分支", desc: "路由到专用的失败处理分支" },
              { v: "defaultValue", label: "默认值", desc: "使用预设默认值继续执行" },
            ].map(opt => (
              <div key={opt.v} className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${strategy === opt.v ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"}`}
                onClick={() => setStrategy(opt.v as ErrorStrategy)}>
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 ${strategy === opt.v ? "border-primary" : "border-gray-300"}`}>
                  {strategy === opt.v && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-800">{opt.label}</div>
                  <div className="text-[10px] text-gray-500">{opt.desc}</div>
                </div>
              </div>
            ))}
          </div>
          {strategy === "failBranch" && (
            <div className="bg-orange-50 rounded p-2 text-[10px] text-orange-700">
              节点右侧将出现"失败"输出端口，连接到错误处理节点
            </div>
          )}
          {strategy === "defaultValue" && (
            <div className="space-y-2">
              <div className="text-[10px] text-gray-500 font-medium">设置各输出变量的默认值：</div>
              {outputVars.map(v => (
                <div key={v.name} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-600 w-20 truncate">{v.name}</span>
                  {v.type === "object" || v.type.startsWith("array") ? (
                    <Textarea value={defaults[v.name] ?? ""} onChange={e => setDefaults({ ...defaults, [v.name]: e.target.value })}
                      className="text-xs font-mono min-h-[60px] flex-1" placeholder={v.type === "object" ? "{}" : "[]"} />
                  ) : (
                    <Input value={defaults[v.name] ?? ""} onChange={e => setDefaults({ ...defaults, [v.name]: e.target.value })}
                      className="h-7 text-xs flex-1" placeholder={`${v.name} 的默认值`} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

---

## 13. 运行调试面板补全

### 13.1 DETAIL Tab 完整版

> 替换 Section 7.1 中 DETAIL Tab 的存根实现，提供完整的输入/输出展示、执行统计和错误信息。

```tsx
"use client"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, Zap, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

type RunStatus = "succeeded" | "failed" | "running" | "stopped"

interface DetailTabProps {
  status: RunStatus
  elapsedMs: number
  promptTokens: number
  completionTokens: number
  errorCount: number
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  errorMessage?: string
}

function JsonViewer({ data, label }: { data: Record<string, unknown>; label: string }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="border rounded-lg overflow-hidden">
      <button className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left"
        onClick={() => setExpanded(!expanded)}>
        <span className="text-xs font-medium text-gray-700">{label}</span>
        {expanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
      </button>
      {expanded && (
        <div className="p-3 bg-gray-50 border-t">
          {Object.entries(data).map(([k, v]) => (
            <div key={k} className="flex gap-2 mb-1">
              <span className="text-[10px] font-mono text-blue-600 flex-shrink-0">{k}:</span>
              <span className="text-[10px] font-mono text-gray-700 break-all">
                {typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DetailTab({
  status = "succeeded",
  elapsedMs = 1234,
  promptTokens = 256,
  completionTokens = 128,
  errorCount = 0,
  inputs = { query: "用户的问题" },
  outputs = { result: "AI 的回答" },
  errorMessage,
}: Partial<DetailTabProps>) {
  const statusConfig: Record<RunStatus, { icon: React.ReactNode; label: string; color: string }> = {
    succeeded: { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, label: "成功", color: "text-green-600" },
    failed: { icon: <XCircle className="w-4 h-4 text-red-500" />, label: "失败", color: "text-red-600" },
    running: { icon: <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />, label: "运行中", color: "text-blue-600" },
    stopped: { icon: <div className="w-4 h-4 rounded-full bg-gray-400" />, label: "已停止", color: "text-gray-600" },
  }
  const sc = statusConfig[status]
  return (
    <div className="p-4 space-y-4">
      {/* 执行状态 */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        {sc.icon}
        <span className={cn("text-sm font-medium", sc.color)}>{sc.label}</span>
      </div>
      {/* 执行统计 2×2 网格 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] text-gray-500">耗时</span>
          </div>
          <div className="text-sm font-semibold text-gray-800">{(elapsedMs / 1000).toFixed(2)}s</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <Zap className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] text-gray-500">总 Token</span>
          </div>
          <div className="text-sm font-semibold text-gray-800">{promptTokens + completionTokens}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[10px] text-gray-500 mb-1">提示 Token</div>
          <div className="text-sm font-semibold text-gray-800">{promptTokens}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[10px] text-gray-500 mb-1">补全 Token</div>
          <div className="text-sm font-semibold text-gray-800">{completionTokens}</div>
        </div>
      </div>
      {/* 异常计数（仅在有异常时显示） */}
      {errorCount > 0 && (
        <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-200">
          <AlertTriangle className="w-3 h-3 text-orange-500" />
          <span className="text-xs text-orange-700">{errorCount} 个节点发生异常</span>
        </div>
      )}
      {/* 错误信息（仅在失败时显示） */}
      {status === "failed" && errorMessage && (
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="text-[10px] font-medium text-red-700 mb-1">错误信息</div>
          <pre className="text-[10px] font-mono text-red-600 whitespace-pre-wrap break-all">{errorMessage}</pre>
        </div>
      )}
      {/* 输入/输出数据 */}
      <JsonViewer data={inputs} label="输入数据" />
      <JsonViewer data={outputs} label="输出数据" />
    </div>
  )
}
```

### 13.2 TRACING Tab 完整版（含专项日志）

```tsx
"use client"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, Bot, RefreshCw, Repeat, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

type NodeStatus = "succeeded" | "failed" | "running" | "waiting" | "retry"
type LogType = "agent" | "iteration" | "loop" | "retry" | null

interface TraceNode {
  id: string; title: string; type: string; status: NodeStatus
  durationMs: number; tokens?: number; logType?: LogType
  agentSteps?: { tool: string; input: string; output: string }[]
  iterationItems?: { index: number; status: NodeStatus; durationMs: number; error?: string }[]
  loopIterations?: { iteration: number; vars: Record<string, unknown>; status: NodeStatus; durationMs: number }[]
  retryAttempts?: { attempt: number; timestamp: string; error: string; status: NodeStatus }[]
}

const STATUS_ICON: Record<NodeStatus, React.ReactNode> = {
  succeeded: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-500" />,
  running: <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />,
  waiting: <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />,
  retry: <RotateCcw className="w-3.5 h-3.5 text-orange-500" />,
}

function AgentLog({ steps }: { steps: TraceNode["agentSteps"] }) {
  if (!steps?.length) return null
  return (
    <div className="ml-6 mt-2 space-y-2 border-l-2 border-indigo-200 pl-3">
      <div className="flex items-center gap-1 text-[10px] text-indigo-600 font-medium">
        <Bot className="w-3 h-3" />Agent 执行步骤
      </div>
      {steps.map((step, i) => (
        <div key={i} className="bg-indigo-50 rounded p-2 space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="text-[9px] bg-indigo-100 text-indigo-700 border-0">步骤 {i + 1}</Badge>
            <span className="text-[10px] font-medium text-indigo-800">{step.tool}</span>
          </div>
          <div className="text-[10px] text-gray-600"><span className="font-medium">输入：</span>{step.input}</div>
          <div className="text-[10px] text-gray-600"><span className="font-medium">输出：</span>{step.output}</div>
        </div>
      ))}
    </div>
  )
}

function IterationLog({ items }: { items: TraceNode["iterationItems"] }) {
  if (!items?.length) return null
  return (
    <div className="ml-6 mt-2 border-l-2 border-blue-200 pl-3">
      <div className="flex items-center gap-1 text-[10px] text-blue-600 font-medium mb-2">
        <RefreshCw className="w-3 h-3" />迭代结果（{items.length} 项）
      </div>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.index} className="flex items-center gap-2 bg-blue-50 rounded px-2 py-1">
            <span className="text-[10px] text-gray-500 w-8">#{item.index + 1}</span>
            {STATUS_ICON[item.status]}
            <span className="text-[10px] text-gray-600 flex-1">{item.error ?? "成功"}</span>
            <span className="text-[10px] text-gray-400">{item.durationMs}ms</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoopLog({ iterations }: { iterations: TraceNode["loopIterations"] }) {
  if (!iterations?.length) return null
  return (
    <div className="ml-6 mt-2 border-l-2 border-purple-200 pl-3">
      <div className="flex items-center gap-1 text-[10px] text-purple-600 font-medium mb-2">
        <Repeat className="w-3 h-3" />循环记录（{iterations.length} 次）
      </div>
      <div className="space-y-1">
        {iterations.map(iter => (
          <div key={iter.iteration} className="bg-purple-50 rounded px-2 py-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-12">第 {iter.iteration} 次</span>
              {STATUS_ICON[iter.status]}
              <span className="text-[10px] text-gray-400 ml-auto">{iter.durationMs}ms</span>
            </div>
            {Object.entries(iter.vars).map(([k, v]) => (
              <div key={k} className="text-[9px] text-gray-500 ml-4">{k}: {String(v)}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function RetryLog({ attempts }: { attempts: TraceNode["retryAttempts"] }) {
  if (!attempts?.length) return null
  return (
    <div className="ml-6 mt-2 border-l-2 border-orange-200 pl-3">
      <div className="flex items-center gap-1 text-[10px] text-orange-600 font-medium mb-2">
        <RotateCcw className="w-3 h-3" />重试记录（{attempts.length} 次）
      </div>
      <div className="space-y-1">
        {attempts.map(att => (
          <div key={att.attempt} className="bg-orange-50 rounded px-2 py-1">
            <div className="flex items-center gap-2">
              <Badge className="text-[9px] bg-orange-100 text-orange-700 border-0">第 {att.attempt} 次</Badge>
              {STATUS_ICON[att.status]}
              <span className="text-[10px] text-gray-400 ml-auto">{att.timestamp}</span>
            </div>
            <div className="text-[10px] text-red-600 ml-2 mt-0.5">{att.error}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TraceNodeRow({ node }: { node: TraceNode }) {
  const [expanded, setExpanded] = useState(false)
  const hasLog = node.logType !== null && (node.agentSteps?.length || node.iterationItems?.length || node.loopIterations?.length || node.retryAttempts?.length)
  return (
    <div>
      <div className={cn("flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer rounded-lg", expanded && "bg-gray-50")}
        onClick={() => hasLog && setExpanded(!expanded)}>
        {hasLog ? (expanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />) : <div className="w-3" />}
        {STATUS_ICON[node.status]}
        <span className="text-xs text-gray-800 flex-1 truncate">{node.title}</span>
        <Badge variant="outline" className="text-[9px] px-1">{node.type}</Badge>
        {node.tokens && <span className="text-[10px] text-gray-400">{node.tokens}t</span>}
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <Clock className="w-2.5 h-2.5" />{node.durationMs}ms
        </div>
      </div>
      {expanded && hasLog && (
        <>
          {node.logType === "agent" && <AgentLog steps={node.agentSteps} />}
          {node.logType === "iteration" && <IterationLog items={node.iterationItems} />}
          {node.logType === "loop" && <LoopLog iterations={node.loopIterations} />}
          {node.logType === "retry" && <RetryLog attempts={node.retryAttempts} />}
        </>
      )}
    </div>
  )
}

const DEMO_TRACE: TraceNode[] = [
  { id: "start", title: "开始", type: "Start", status: "succeeded", durationMs: 2, logType: null },
  { id: "llm1", title: "LLM 处理", type: "LLM", status: "succeeded", durationMs: 1240, tokens: 384, logType: "retry",
    retryAttempts: [{ attempt: 1, timestamp: "09:00:01", error: "Rate limit exceeded", status: "failed" }, { attempt: 2, timestamp: "09:00:02", error: "", status: "succeeded" }] },
  { id: "agent1", title: "Agent 执行", type: "Agent", status: "succeeded", durationMs: 3200, tokens: 512, logType: "agent",
    agentSteps: [{ tool: "网络搜索", input: "最新 AI 新闻", output: "找到 5 条相关结果..." }, { tool: "代码执行", input: "print('hello')", output: "hello" }] },
  { id: "iter1", title: "批量处理", type: "Iteration", status: "succeeded", durationMs: 2100, logType: "iteration",
    iterationItems: [{ index: 0, status: "succeeded", durationMs: 400 }, { index: 1, status: "failed", durationMs: 200, error: "解析失败" }, { index: 2, status: "succeeded", durationMs: 380 }] },
  { id: "end", title: "结束", type: "End", status: "succeeded", durationMs: 1, logType: null },
]

export function TracingTab() {
  return (
    <div className="p-3 space-y-1">
      {DEMO_TRACE.map(node => <TraceNodeRow key={node.id} node={node} />)}
    </div>
  )
}
```

### 13.3 Chatflow 预览面板扩展（三 Tab 版）

> 扩展 Section 7.2 的 ChatflowPreviewPanel，增加"对话变量"和"对话记录"两个 Tab。

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, X, Send, Plus, Trash2, MessageSquare, Variable, History } from "lucide-react"

// ── 对话变量 Tab ──────────────────────────────────────────────
type ConvVar = { name: string; type: string; value: string; description: string }

function ConversationVariablesTab() {
  const [vars, setVars] = useState<ConvVar[]>([
    { name: "user_name", type: "string", value: "张三", description: "用户姓名" },
    { name: "dialog_count", type: "number", value: "3", description: "对话轮次" },
    { name: "is_vip", type: "boolean", value: "false", description: "是否 VIP 用户" },
  ])
  const [showAdd, setShowAdd] = useState(false)
  const [newVar, setNewVar] = useState<ConvVar>({ name: "", type: "string", value: "", description: "" })
  const updateVar = (i: number, field: keyof ConvVar, val: string) =>
    setVars(vars.map((v, j) => j === i ? { ...v, [field]: val } : v))
  const addVar = () => {
    if (newVar.name) { setVars([...vars, newVar]); setNewVar({ name: "", type: "string", value: "", description: "" }); setShowAdd(false) }
  }
  return (
    <div className="p-4 space-y-3">
      <div className="text-[10px] text-gray-500 bg-blue-50 rounded p-2">
        对话变量在整个会话中持久保存，可被工作流节点读取和修改。
      </div>
      <div className="space-y-2">
        {vars.map((v, i) => (
          <div key={i} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-gray-800">{v.name}</span>
                <Badge variant="outline" className="text-[9px] px-1">{v.type}</Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500"
                onClick={() => setVars(vars.filter((_, j) => j !== i))}><Trash2 className="w-3 h-3" /></Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-8">值</span>
              {v.type === "boolean" ? (
                <Switch checked={v.value === "true"} onCheckedChange={val => updateVar(i, "value", String(val))} />
              ) : (
                <Input value={v.value} onChange={e => updateVar(i, "value", e.target.value)}
                  className="h-6 text-xs flex-1" type={v.type === "number" ? "number" : "text"} />
              )}
            </div>
            {v.description && <div className="text-[10px] text-gray-400">{v.description}</div>}
          </div>
        ))}
      </div>
      {showAdd ? (
        <div className="border-2 border-dashed border-primary/30 rounded-lg p-3 space-y-2">
          <div className="flex gap-2">
            <Input value={newVar.name} onChange={e => setNewVar({ ...newVar, name: e.target.value })}
              className="h-7 text-xs flex-1" placeholder="变量名" />
            <Select value={newVar.type} onValueChange={v => setNewVar({ ...newVar, type: v })}>
              <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["string", "number", "boolean", "object", "array"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input value={newVar.description} onChange={e => setNewVar({ ...newVar, description: e.target.value })}
            className="h-7 text-xs" placeholder="描述（可选）" />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={addVar}>确认添加</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAdd(false)}>取消</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="w-3 h-3 mr-1" />添加对话变量
        </Button>
      )}
    </div>
  )
}

// ── 对话记录 Tab ──────────────────────────────────────────────
type ChatRecord = { id: string; timestamp: string; firstMessage: string; messageCount: number; branchCount: number }

function ChatRecordTab() {
  const [records] = useState<ChatRecord[]>([
    { id: "r1", timestamp: "2026-05-14 09:30", firstMessage: "你好，我想了解产品功能", messageCount: 8, branchCount: 1 },
    { id: "r2", timestamp: "2026-05-14 10:15", firstMessage: "如何配置 API 密钥？", messageCount: 5, branchCount: 2 },
    { id: "r3", timestamp: "2026-05-14 11:00", firstMessage: "工作流执行失败怎么办", messageCount: 12, branchCount: 1 },
  ])
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className="p-4 space-y-2">
      <div className="text-[10px] text-gray-500 mb-3">点击记录可在对话 Tab 中加载该会话</div>
      {records.map(rec => (
        <div key={rec.id} className={`border rounded-lg p-3 cursor-pointer transition-colors ${selected === rec.id ? "border-primary bg-primary/5" : "hover:bg-gray-50"}`}
          onClick={() => setSelected(rec.id)}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-800 truncate">{rec.firstMessage}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{rec.timestamp}</div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <Badge variant="outline" className="text-[9px] px-1">{rec.messageCount} 条消息</Badge>
              {rec.branchCount > 1 && (
                <Badge className="text-[9px] bg-orange-100 text-orange-700 border-0 px-1">{rec.branchCount} 个分支</Badge>
              )}
            </div>
          </div>
          {rec.branchCount > 1 && (
            <div className="flex items-center gap-1 mt-2">
              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1">← 上一分支</Button>
              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1">下一分支 →</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── 完整 Chatflow 预览面板（三 Tab） ──────────────────────────
type ChatTab = "chat" | "variables" | "records"

export function ChatflowPreviewPanelV2({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<ChatTab>("chat")
  const [messages, setMessages] = useState([
    { role: "user", content: "你好，请介绍一下你的功能" },
    { role: "assistant", content: "您好！我是基于 Dify 工作流构建的 AI 助手，可以帮您..." },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const sendMessage = () => {
    if (!input.trim() || loading) return
    setMessages([...messages, { role: "user", content: input }])
    setInput("")
    setLoading(true)
    setTimeout(() => { setMessages(m => [...m, { role: "assistant", content: "这是 AI 的回复..." }]); setLoading(false) }, 1500)
  }
  const TABS: { key: ChatTab; label: string; icon: React.ReactNode }[] = [
    { key: "chat", label: "对话", icon: <MessageSquare className="w-3 h-3" /> },
    { key: "variables", label: "对话变量", icon: <Variable className="w-3 h-3" /> },
    { key: "records", label: "对话记录", icon: <History className="w-3 h-3" /> },
  ]
  return (
    <div className="w-[380px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl absolute right-4 top-14 bottom-4 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
        <span className="text-sm font-medium flex-1">对话预览</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMessages([])}><RefreshCw className="w-3 h-3" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      <div className="flex border-b">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {activeTab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${msg.role === "user" ? "bg-primary text-white" : "bg-gray-200 text-gray-600"}`}>
                  {msg.role === "user" ? "U" : "AI"}
                </div>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs ${msg.role === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                  {msg.content}
                  {loading && i === messages.length - 1 && msg.role === "user" && (
                    <div className="flex gap-1 mt-1"><div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} /><div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} /><div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} /></div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                className="flex-1 text-xs border rounded-lg px-3 py-2 resize-none min-h-[36px] max-h-[120px] focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="输入消息... (Enter 发送，Shift+Enter 换行)" rows={1} />
              <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={sendMessage} disabled={loading || !input.trim()}>
                {loading ? <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Send className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </>
      )}
      {activeTab === "variables" && <div className="flex-1 overflow-y-auto"><ConversationVariablesTab /></div>}
      {activeTab === "records" && <div className="flex-1 overflow-y-auto"><ChatRecordTab /></div>}
    </div>
  )
}
```

---

## 14. 高级功能组件

### 14.1 ChecklistModal（发布前校验）

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle2, X, ArrowRight, Puzzle } from "lucide-react"

type CheckItem = {
  id: string; nodeId: string; nodeName: string; nodeType: string
  issue: string; severity: "error" | "warning"
}

type PluginIssue = { pluginName: string; version: string; issue: string }

interface ChecklistModalProps {
  open: boolean; onClose: () => void; onPublish: () => void
  nodeIssues?: CheckItem[]; pluginIssues?: PluginIssue[]
}

export function ChecklistModal({
  open, onClose, onPublish,
  nodeIssues = [
    { id: "1", nodeId: "llm1", nodeName: "LLM 处理", nodeType: "LLM", issue: "未配置模型", severity: "error" },
    { id: "2", nodeId: "http1", nodeName: "HTTP 请求", nodeType: "HTTP", issue: "URL 为空", severity: "error" },
    { id: "3", nodeId: "code1", nodeName: "代码执行", nodeType: "Code", issue: "输入变量未连接", severity: "warning" },
  ],
  pluginIssues = [
    { pluginName: "搜索工具", version: "1.2.0", issue: "版本不兼容，需要 >= 2.0.0" },
  ],
}: ChecklistModalProps) {
  if (!open) return null
  const errors = nodeIssues.filter(i => i.severity === "error")
  const warnings = nodeIssues.filter(i => i.severity === "warning")
  const canPublish = errors.length === 0 && pluginIssues.length === 0
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">发布前检查</div>
            <div className="text-xs text-gray-500">
              {errors.length > 0 ? `${errors.length} 个错误需要修复` : "检查通过，可以发布"}
            </div>
          </div>
          <div className="flex gap-2">
            {errors.length > 0 && <Badge className="bg-red-100 text-red-700 border-0">{errors.length} 错误</Badge>}
            {warnings.length > 0 && <Badge className="bg-yellow-100 text-yellow-700 border-0">{warnings.length} 警告</Badge>}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {nodeIssues.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-2">节点问题</div>
              <div className="space-y-2">
                {nodeIssues.map(item => (
                  <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border ${item.severity === "error" ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"}`}>
                    {item.severity === "error"
                      ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-800">{item.nodeName}</span>
                        <Badge variant="outline" className="text-[9px] px-1">{item.nodeType}</Badge>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">{item.issue}</div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2 flex-shrink-0">
                      转到 <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pluginIssues.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-2">插件问题</div>
              <div className="space-y-2">
                {pluginIssues.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
                    <Puzzle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-800">{p.pluginName}</span>
                        <Badge variant="outline" className="text-[9px] px-1">v{p.version}</Badge>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">{p.issue}</div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2 flex-shrink-0">更新</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {canPublish && (
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <div className="text-sm font-medium text-green-800">所有检查通过</div>
                <div className="text-xs text-green-600">工作流可以安全发布</div>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>取消</Button>
          <Button className="flex-1" disabled={!canPublish} onClick={onPublish}>
            {canPublish ? "发布工作流" : `修复 ${errors.length + pluginIssues.length} 个问题后发布`}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### 14.2 CommentsPanel（评论面板）

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, X, Check, Filter } from "lucide-react"

type Comment = {
  id: string; author: string; avatar: string; content: string
  timestamp: string; replyCount: number; resolved: boolean; isActive: boolean
}

const DEMO_COMMENTS: Comment[] = [
  { id: "1", author: "张三", avatar: "张", content: "这个 LLM 节点的 temperature 参数需要调低，当前输出不够稳定", timestamp: "2 小时前", replyCount: 3, resolved: false, isActive: true },
  { id: "2", author: "李四", avatar: "李", content: "HTTP 请求节点的超时时间建议改为 30 秒", timestamp: "昨天", replyCount: 1, resolved: false, isActive: false },
  { id: "3", author: "王五", avatar: "王", content: "已确认修复，可以发布", timestamp: "3 天前", replyCount: 0, resolved: true, isActive: false },
]

export function CommentsPanel({ onClose }: { onClose?: () => void }) {
  const [filter, setFilter] = useState<"all" | "mine">("all")
  const [showResolved, setShowResolved] = useState(false)
  const [comments, setComments] = useState(DEMO_COMMENTS)
  const toggleResolved = (id: string) => setComments(comments.map(c => c.id === id ? { ...c, resolved: !c.resolved } : c))
  const filtered = comments.filter(c => {
    if (filter === "mine" && c.author !== "张三") return false
    if (!showResolved && c.resolved) return false
    return true
  })
  return (
    <div className="w-[320px] h-full flex flex-col bg-white border-l border-gray-200 shadow-xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
        <MessageSquare className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium flex-1">评论</span>
        <Badge variant="outline" className="text-[10px]">{comments.filter(c => !c.resolved).length}</Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>
      {/* 过滤栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <div className="flex gap-1">
          {[{ v: "all", label: "全部" }, { v: "mine", label: "我的" }].map(f => (
            <button key={f.v} onClick={() => setFilter(f.v as typeof filter)}
              className={`text-xs px-2 py-1 rounded transition-colors ${filter === f.v ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowResolved(!showResolved)}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded ml-auto transition-colors ${showResolved ? "bg-green-100 text-green-700" : "text-gray-500 hover:bg-gray-100"}`}>
          <Filter className="w-3 h-3" />{showResolved ? "隐藏已解决" : "显示已解决"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
            <div className="text-xs">暂无评论</div>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map(comment => (
              <div key={comment.id} className={`p-4 transition-colors ${comment.isActive ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-gray-50"}`}>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {comment.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-800">{comment.author}</span>
                      <span className="text-[10px] text-gray-400">{comment.timestamp}</span>
                      {comment.resolved && <Badge className="text-[9px] bg-green-100 text-green-700 border-0 px-1">已解决</Badge>}
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-3">{comment.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {comment.replyCount > 0 && (
                        <button className="text-[10px] text-primary hover:underline">{comment.replyCount} 条回复</button>
                      )}
                      <button onClick={() => toggleResolved(comment.id)}
                        className={`flex items-center gap-1 text-[10px] ml-auto ${comment.resolved ? "text-gray-400" : "text-green-600 hover:text-green-700"}`}>
                        <Check className="w-3 h-3" />{comment.resolved ? "取消解决" : "标记解决"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

### 14.3 NoteNode 编辑器（内联富文本）

```tsx
"use client"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Bold, Italic, Underline, Link, List, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

const THEMES = [
  { name: "yellow", bg: "bg-yellow-50", border: "border-yellow-300", dot: "bg-yellow-400" },
  { name: "blue", bg: "bg-blue-50", border: "border-blue-300", dot: "bg-blue-400" },
  { name: "green", bg: "bg-green-50", border: "border-green-300", dot: "bg-green-400" },
  { name: "purple", bg: "bg-purple-50", border: "border-purple-300", dot: "bg-purple-400" },
  { name: "pink", bg: "bg-pink-50", border: "border-pink-300", dot: "bg-pink-400" },
  { name: "orange", bg: "bg-orange-50", border: "border-orange-300", dot: "bg-orange-400" },
  { name: "gray", bg: "bg-gray-50", border: "border-gray-300", dot: "bg-gray-400" },
  { name: "white", bg: "bg-white", border: "border-gray-200", dot: "bg-white border border-gray-300" },
]

export function NoteNodeEditor({
  initialContent = "",
  initialTheme = "yellow",
  initialAuthor = "",
  onSave,
}: {
  initialContent?: string; initialTheme?: string; initialAuthor?: string
  onSave?: (content: string, theme: string, showAuthor: boolean) => void
}) {
  const [content, setContent] = useState(initialContent)
  const [theme, setTheme] = useState(initialTheme)
  const [showAuthor, setShowAuthor] = useState(!!initialAuthor)
  const [width, setWidth] = useState(240)
  const [height, setHeight] = useState(160)
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)
  const t = THEMES.find(x => x.name === theme) ?? THEMES[0]
  const execCmd = (cmd: string) => { document.execCommand(cmd, false) }
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: width, startH: height }
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const newW = Math.max(160, resizeRef.current.startW + ev.clientX - resizeRef.current.startX)
      const newH = Math.max(80, resizeRef.current.startH + ev.clientY - resizeRef.current.startY)
      setWidth(newW); setHeight(newH)
    }
    const onUp = () => { resizeRef.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp) }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }
  return (
    <div className={cn("rounded-xl border-2 relative flex flex-col", t.bg, t.border)} style={{ width, minHeight: height }}>
      {/* 工具栏 */}
      <div className={cn("flex items-center gap-1 px-2 py-1.5 border-b", t.border)}>
        {[{ icon: <Bold className="w-3 h-3" />, cmd: "bold" }, { icon: <Italic className="w-3 h-3" />, cmd: "italic" }, { icon: <Underline className="w-3 h-3" />, cmd: "underline" }, { icon: <Link className="w-3 h-3" />, cmd: "createLink" }, { icon: <List className="w-3 h-3" />, cmd: "insertUnorderedList" }].map(({ icon, cmd }) => (
          <button key={cmd} onMouseDown={e => { e.preventDefault(); execCmd(cmd) }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 text-gray-600 transition-colors">
            {icon}
          </button>
        ))}
        <div className="w-px h-4 bg-gray-300 mx-1" />
        {/* 主题色选择 */}
        {THEMES.map(th => (
          <button key={th.name} onClick={() => setTheme(th.name)}
            className={cn("w-4 h-4 rounded-full transition-transform hover:scale-110", th.dot, theme === th.name && "ring-2 ring-offset-1 ring-gray-400")} />
        ))}
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button onClick={() => setShowAuthor(!showAuthor)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 text-gray-600 transition-colors"
          title={showAuthor ? "隐藏作者" : "显示作者"}>
          {showAuthor ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>
      </div>
      {/* 编辑区 */}
      <div contentEditable suppressContentEditableWarning
        onInput={e => setContent((e.target as HTMLDivElement).innerText)}
        className="flex-1 p-3 text-xs text-gray-800 focus:outline-none min-h-[80px]"
        dangerouslySetInnerHTML={{ __html: content }} />
      {showAuthor && initialAuthor && (
        <div className="px-3 pb-2 text-[10px] text-gray-500 opacity-60">— {initialAuthor}</div>
      )}
      {/* 右下角拖拽调整大小 */}
      <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5"
        onMouseDown={handleResizeStart}>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M7 1L1 7M7 4L4 7M7 7H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-gray-400" />
        </svg>
      </div>
    </div>
  )
}
```

> **交互说明**
> - 双击 NoteNode 进入编辑模式，显示工具栏
> - 点击画布其他区域退出编辑，自动保存
> - 主题色实时切换，8 种颜色
> - 右下角拖拽调整尺寸（最小 160×80px）
> - "显示作者"切换显示/隐藏作者署名

---

## 15. 画布交互 UI

### 15.1 键盘快捷键参考表

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Keyboard, X } from "lucide-react"

const SHORTCUTS = [
  { category: "编辑", items: [
    { keys: ["Ctrl", "Z"], desc: "撤销" },
    { keys: ["Ctrl", "Y"], desc: "重做" },
    { keys: ["Ctrl", "C"], desc: "复制节点" },
    { keys: ["Ctrl", "V"], desc: "粘贴节点" },
    { keys: ["Ctrl", "D"], desc: "复制节点（原地）" },
    { keys: ["Del"], desc: "删除选中节点/边" },
    { keys: ["Ctrl", "A"], desc: "全选" },
    { keys: ["Esc"], desc: "取消选择" },
  ]},
  { category: "视图", items: [
    { keys: ["Ctrl", "1"], desc: "适应画布（Fit View）" },
    { keys: ["Shift", "1"], desc: "缩放至 100%" },
    { keys: ["Shift", "5"], desc: "缩放至 50%" },
    { keys: ["Ctrl", "+"], desc: "放大" },
    { keys: ["Ctrl", "-"], desc: "缩小" },
    { keys: ["F"], desc: "聚焦选中节点" },
    { keys: ["Space", "+拖拽"], desc: "平移画布" },
  ]},
  { category: "模式", items: [
    { keys: ["V"], desc: "指针模式（选择/编辑）" },
    { keys: ["H"], desc: "手型模式（平移）" },
    { keys: ["C"], desc: "评论模式（添加评论）" },
  ]},
  { category: "工作流", items: [
    { keys: ["Ctrl", "S"], desc: "保存草稿" },
    { keys: ["Ctrl", "Enter"], desc: "运行工作流" },
    { keys: ["Ctrl", "Shift", "P"], desc: "发布工作流" },
    { keys: ["Ctrl", "O"], desc: "自动整理布局" },
    { keys: ["Ctrl", "Shift", "H"], desc: "版本历史" },
    { keys: ["Ctrl", "/"], desc: "显示快捷键帮助" },
    { keys: ["Alt", "R"], desc: "测试运行菜单" },
  ]},
]

function KeyChip({ k }: { k: string }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-gray-300 bg-gray-100 text-[10px] font-mono text-gray-700 shadow-sm">
      {k}
    </kbd>
  )
}

export function KeyboardShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b">
          <Keyboard className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-semibold flex-1">键盘快捷键</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {SHORTCUTS.map(group => (
              <div key={group.category}>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{group.category}</div>
                <div className="space-y-2">
                  {group.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                      <span className="text-xs text-gray-700">{item.desc}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {item.keys.map((k, ki) => (
                          <span key={ki} className="flex items-center gap-1">
                            <KeyChip k={k} />
                            {ki < item.keys.length - 1 && <span className="text-[10px] text-gray-400">+</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 15.2 控制模式按钮组

```tsx
"use client"
import { MousePointer2, Hand, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

type ControlMode = "pointer" | "hand" | "comment"

const MODES: { mode: ControlMode; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { mode: "pointer", icon: <MousePointer2 className="w-3.5 h-3.5" />, label: "指针模式", shortcut: "V" },
  { mode: "hand", icon: <Hand className="w-3.5 h-3.5" />, label: "手型模式", shortcut: "H" },
  { mode: "comment", icon: <MessageSquare className="w-3.5 h-3.5" />, label: "评论模式", shortcut: "C" },
]

export function ControlModeButtons({
  mode = "pointer",
  onChange,
}: {
  mode?: ControlMode; onChange?: (m: ControlMode) => void
}) {
  return (
    <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {MODES.map(m => (
        <button key={m.mode} onClick={() => onChange?.(m.mode)} title={`${m.label} (${m.shortcut})`}
          className={cn(
            "flex items-center justify-center w-8 h-8 transition-colors",
            mode === m.mode ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"
          )}>
          {m.icon}
        </button>
      ))}
    </div>
  )
}
```

### 15.3 画布右键菜单（三种变体）

```tsx
"use client"
import { Copy, Trash2, Plus, AlignLeft, AlignRight, AlignCenter, AlignVerticalJustifyCenter, AlignHorizontalJustifyCenter, LayoutGrid, Clipboard, Maximize2 } from "lucide-react"

// 边右键菜单
export function EdgeContextMenu({ x, y, onDelete, onEditLabel, onClose }: {
  x: number; y: number; onDelete?: () => void; onEditLabel?: () => void; onClose?: () => void
}) {
  return (
    <div className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-40"
      style={{ left: x, top: y }} onMouseLeave={onClose}>
      <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100" onClick={onEditLabel}>
        <AlignLeft className="w-3 h-3" />编辑标签
      </button>
      <div className="h-px bg-gray-100 my-1" />
      <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50" onClick={onDelete}>
        <Trash2 className="w-3 h-3" />删除连线
      </button>
    </div>
  )
}

// 画布空白区右键菜单
export function PaneContextMenu({ x, y, onAddNode, onPaste, onSelectAll, onAutoLayout, onClose }: {
  x: number; y: number; onAddNode?: () => void; onPaste?: () => void
  onSelectAll?: () => void; onAutoLayout?: () => void; onClose?: () => void
}) {
  return (
    <div className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-44"
      style={{ left: x, top: y }} onMouseLeave={onClose}>
      <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100" onClick={onAddNode}>
        <Plus className="w-3 h-3" />添加节点
      </button>
      <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100" onClick={onPaste}>
        <Clipboard className="w-3 h-3" />粘贴
        <span className="ml-auto text-[10px] text-gray-400">⌘V</span>
      </button>
      <div className="h-px bg-gray-100 my-1" />
      <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100" onClick={onSelectAll}>
        <Maximize2 className="w-3 h-3" />全选
        <span className="ml-auto text-[10px] text-gray-400">⌘A</span>
      </button>
      <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100" onClick={onAutoLayout}>
        <LayoutGrid className="w-3 h-3" />自动整理布局
        <span className="ml-auto text-[10px] text-gray-400">⌘O</span>
      </button>
    </div>
  )
}

// 多选节点右键菜单
export function SelectionContextMenu({ x, y, count, onCopy, onDelete, onGroup, onAlign, onClose }: {
  x: number; y: number; count: number; onCopy?: () => void; onDelete?: () => void
  onGroup?: () => void; onAlign?: (dir: string) => void; onClose?: () => void
}) {
  const ALIGN_OPTIONS = [
    { dir: "left", icon: <AlignLeft className="w-3 h-3" />, label: "左对齐" },
    { dir: "right", icon: <AlignRight className="w-3 h-3" />, label: "右对齐" },
    { dir: "center-h", icon: <AlignHorizontalJustifyCenter className="w-3 h-3" />, label: "水平居中" },
    { dir: "center-v", icon: <AlignVerticalJustifyCenter className="w-3 h-3" />, label: "垂直居中" },
  ]
  return (
    <div className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-44"
      style={{ left: x, top: y }} onMouseLeave={onClose}>
      <div className="px-3 py-1 text-[10px] text-gray-400">已选 {count} 个节点</div>
      <div className="h-px bg-gray-100 my-1" />
      <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100" onClick={onCopy}>
        <Copy className="w-3 h-3" />复制<span className="ml-auto text-[10px] text-gray-400">⌘C</span>
      </button>
      <div className="h-px bg-gray-100 my-1" />
      <div className="px-3 py-1 text-[10px] text-gray-400">对齐</div>
      {ALIGN_OPTIONS.map(opt => (
        <button key={opt.dir} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100" onClick={() => onAlign?.(opt.dir)}>
          {opt.icon}{opt.label}
        </button>
      ))}
      <div className="h-px bg-gray-100 my-1" />
      <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50" onClick={onDelete}>
        <Trash2 className="w-3 h-3" />删除<span className="ml-auto text-[10px] text-gray-400">Del</span>
      </button>
    </div>
  )
}
```

### 15.4 候选节点（拖拽创建时的幽灵节点）

```tsx
"use client"
import { cn } from "@/lib/utils"

// 从 BlockSelector 拖拽到画布时显示的幽灵节点
// 使用 opacity-60 + border-dashed + border-primary 样式
export function CandidateNode({ type = "LLM", title = "LLM", color = "#6366F1" }: {
  type?: string; title?: string; color?: string
}) {
  return (
    <div className={cn(
      "w-[240px] rounded-xl border-2 border-dashed bg-white shadow-lg",
      "opacity-60 pointer-events-none select-none"
    )} style={{ borderColor: color }}>
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ backgroundColor: `${color}15` }}>
        <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold"
          style={{ backgroundColor: color }}>
          {type[0]}
        </div>
        <span className="text-xs font-medium text-gray-800">{title}</span>
      </div>
      <div className="px-3 py-2">
        <div className="h-4 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  )
}
```

> **交互说明**
> - 从 BlockSelector 拖拽节点时，鼠标跟随显示 CandidateNode
> - 拖拽到画布有效区域时，边框变为实线（`border-solid`）
> - 松开鼠标后，CandidateNode 消失，真实节点在该位置创建
> - 拖拽到无效区域（如节点内部）时，显示禁止图标

---

## 16. v0.dev 提示词补全

### 16.1 节点配置面板提示词集

#### 16.1.1 Code 节点面板

```
Create a Code node configuration panel (380px wide right drawer) for a workflow editor.

Header: slate-500 background, Code2 icon, "代码执行" title, "Code" badge, X close button.

Three tabs: 参数配置 / 输入变量 / 输出变量 (underline active indicator).

参数配置 tab:
- Language toggle: "Python 3" / "JavaScript" segmented control (full-width, active = primary bg)
- Input variables section: list of [variable name input (w-24) + variable reference Select + delete button] rows, "添加" button
- Code editor: styled Textarea with font-mono bg-gray-900 text-green-400 min-h-[160px], "同步函数签名" button above

输出变量 tab:
- Read-only display: "output" variable with "string" type badge in gray-50 row
- Note: "输出变量由代码 return 字典自动推断"

Footer: "重置" outline button + "保存" primary button (flex-1 each, h-8).
Use shadcn/ui components. All text in Chinese.
```

#### 16.1.2 IfElse 节点面板

```
Create an IfElse condition branch configuration panel (380px wide right drawer).

Header: blue-500 background, GitBranch icon, "条件分支" title, "IF/ELSE" badge, X close.

Main content (scrollable):
- IF group (required): gray-50 header with "IF" blue badge + AND/OR toggle button + GripVertical drag handle
  - Condition rows: [variable Select (w-28) + operator Select (w-20, options: 包含/不包含/等于/不等于/大于/小于/大于等于/小于等于/为空/不为空) + value Input + delete button]
  - "添加条件" ghost button
- ELIF groups (optional, draggable): same structure as IF but with amber "ELIF" badge + delete button
- ELSE block: dashed border, "ELSE" gray badge, "其他情况走此分支" hint text
- "添加 ELIF 分支" outline button at bottom

Footer: 重置 + 保存 buttons.
Use shadcn/ui. All text Chinese.
```

#### 16.1.3 HTTP Request 节点面板

```
Create an HTTP Request node configuration panel (380px wide right drawer).

Header: blue-500 background, Globe icon, "HTTP 请求" title, "HTTP" badge, X close.

Three tabs: 参数配置 / 输入变量 / 输出变量.

参数配置 tab:
- Method + URL row: method Select (GET/POST/PUT/DELETE/PATCH/HEAD, w-24) + URL Input (flex-1) + "导入 cURL" ghost button
- Auth section: Select (无认证/Basic Auth/Bearer Token/API Key) + conditional fields (token input / username+password / header+key)
- Headers: key-value list with add/delete rows
- Body type: Select (无/form-data/x-www-form-urlencoded/raw) + raw textarea when raw selected
- SSL verify Switch + timeout number Input
- Params: key-value list

输出变量 tab: read-only list: body(string), status_code(number), headers(object), files(array[file])

Footer: 重置 + 保存.
```

#### 16.1.4 Knowledge Retrieval 节点面板

```
Create a Knowledge Retrieval node configuration panel (380px wide right drawer).

Header: green-500 background, BookOpen icon, "知识检索" title, "Knowledge" badge, X close.

Three tabs: 参数配置 / 输入变量 / 输出变量.

参数配置 tab:
- Query variable: Select with sys.query / node output options
- Knowledge bases: checkbox list (kb name + doc count), multi-select
- Retrieval mode: 单一/多路/混合 segmented control
- Reranker model Select (shown only for 多路/混合 mode)
- Top-K number Input

输出变量 tab: result(array[object]), result_str(string)

Footer: 重置 + 保存.
```

#### 16.1.5 Iteration 容器节点面板

```
Create an Iteration container node configuration panel (380px wide right drawer).

Header: blue-500 background, RefreshCw icon, "迭代" title, "Iteration" badge, X close.

Content (no tabs, single scrollable area):
- Input array variable: Select with array variable options + hint text "迭代器将遍历此数组的每个元素"
- Parallel execution: label + description + Switch toggle
- Max parallel slider (1-100) + number input (shown only when parallel enabled)
- Error handling strategy: radio group with 3 options:
  - 终止迭代: "遇到错误立即停止整个迭代"
  - 继续执行: "跳过错误项，继续处理其余项"
  - 移除异常输出: "从输出数组中移除失败项"
  Each option: radio circle + label + description, border highlight when selected
- Flatten output: label + description + Switch

Footer: 重置 + 保存.
```

#### 16.1.6 Loop 容器节点面板

```
Create a Loop container node configuration panel (380px wide right drawer).

Header: purple-500 background, Repeat icon, "循环" title, "Loop" badge, X close.

Content:
- Loop variables section: list of [name Input (w-24) + type Select (string/number/boolean/array/object, w-24) + initial value Input + delete button], "添加" button
- Break conditions: AND/OR toggle + condition rows [variable Select + operator Select + value Input + delete button], "添加条件" button
- Max iterations: label + number Input (w-20)

Footer: 重置 + 保存.
```

#### 16.1.7 Agent 节点面板

```
Create an Agent node configuration panel (380px wide right drawer).

Header: indigo-500 background, Bot icon, "Agent" title, "Agent" badge, X close.

Three tabs: 参数配置 / 输入变量 / 输出变量.

参数配置 tab:
- Strategy: "Function Calling" / "ReAct" segmented control
- Model: Select (GPT-4o / Claude Sonnet 4.6 / Gemini 1.5 Pro)
- Tools: checkbox list (tool name + description), multi-select with border highlight
- Max steps: label + Slider (1-20) + current value display
- Memory (Chatflow only): label + description + Switch, history count Input when enabled

输出变量 tab: dynamic field list with name Input + type Select + delete button, "添加输出字段" button

Footer: 重置 + 保存.
```

#### 16.1.8 Answer 节点面板（Chatflow 专属）

```
Create an Answer node configuration panel (380px wide right drawer) for Chatflow.

Header: blue-500 background, MessageSquare icon, "回复" title, "Chatflow 专属" blue badge, X close.

Content:
- Reply content editor:
  - Variable chip toolbar (gray-50 bg): "插入变量：" label + colored variable chips (sys.query blue, llm1.text purple, node1.output green) + "更多" button
  - Textarea below toolbar (min-h-[160px]), placeholder "输入回复内容，使用 {{变量名}} 插入变量..."
  - Hint: "支持 Markdown 格式，使用 {{变量名}} 引用变量"
- File variable section: dashed border area with "选择变量" button

Footer: 重置 + 保存.
```

#### 16.1.9 QuestionClassifier 节点面板

```
Create a QuestionClassifier node configuration panel (380px wide right drawer).

Header: amber-500 background, HelpCircle icon, "问题分类" title, "Classifier" badge, X close.

Content:
- Query variable: Select
- Model: Select (GPT-4o / Claude Sonnet 4.6)
- Classification list: draggable items, each with [GripVertical + numbered amber badge + name Input + delete button + description Input below]
  "添加分类" button
- Custom instruction: collapsible section (ChevronDown toggle), Textarea when expanded

Footer: 重置 + 保存.
```

#### 16.1.10 ParameterExtractor 节点面板

```
Create a ParameterExtractor node configuration panel (380px wide right drawer).

Header: amber-500 background, Sliders icon, "参数提取" title, "Extractor" badge, X close.

Content:
- Input text variable: Select
- Model: Select
- Parameter list: each item in bordered card with [name Input + type Select + delete button] + [description Input] + [required Switch]
  "添加参数" button
- Custom instruction: collapsible Textarea

Footer: 重置 + 保存.
```

#### 16.1.11 TemplateTransform 节点面板

```
Create a TemplateTransform node configuration panel (380px wide right drawer).

Header: amber-500 background, FileText icon, "模板转换" title, "Jinja2" badge, X close.

Content:
- Input variables: list of [variable name Input (w-24) + variable reference Select + delete button], "添加" button
- Jinja2 template editor: monospace Textarea (min-h-[160px]), placeholder "使用 {{变量名}} 引用输入变量"
  Hint text: "支持 Jinja2 语法：{{var}} 变量、{% if %}...{% endif %} 条件"
- Output variable: read-only "output" (string) in gray-50 row

Footer: 重置 + 保存.
```

#### 16.1.12 VariableAssigner 节点面板

```
Create a VariableAssigner node configuration panel (380px wide right drawer).

Header: slate-500 background, ArrowLeftRight icon, "变量赋值" title, "Assigner" badge, X close.

Content:
- Info box (blue-50): "将源变量的值赋给目标变量（对话变量或环境变量）"
- Assignment rules: list of [target variable Select (conversation.*/env.*) + ArrowRight icon + source variable Select + delete button]
  "添加" button

Footer: 重置 + 保存.
```

#### 16.1.13 HumanInput 节点面板

```
Create a HumanInput node configuration panel (380px wide right drawer).

Header: blue-500 background, UserCheck icon, "人工输入" title, "Human" badge, X close.

Content:
- Prompt textarea (min-h-[100px]): supports {{variable}} interpolation
- Timeout number Input (0 = unlimited)
- Form fields: each in bordered card with [label Input + type Select + delete button] + [field name Input + required Switch]
  "添加字段" button
- Delivery method: "邮件" / "Webhook" segmented control + conditional email Input or webhook URL Input

Footer: 重置 + 保存.
```

#### 16.1.14 TriggerWebhook 节点面板

```
Create a TriggerWebhook node configuration panel (380px wide right drawer).

Header: orange-500 background, Webhook icon, "Webhook 触发" title, "Trigger" badge, X close.

Content:
- Info box (orange-50): "通过 HTTP POST 请求触发此工作流"
- Webhook URL: read-only Input + Copy button (shows Check icon after copy)
- Request method: read-only "POST" Input
- Output variables: read-only list: body(object), headers(object), query(object)
- "发送测试请求" outline button

No footer save/reset (read-only panel).
```

#### 16.1.15 TriggerSchedule 节点面板

```
Create a TriggerSchedule node configuration panel (380px wide right drawer).

Header: orange-500 background, Clock icon, "定时触发" title, "Schedule" badge, X close.

Content:
- Frequency preset Select: 每分钟/每小时/每天9:00/每周一9:00/每月1日9:00/自定义
- Custom cron Input (shown when "自定义" selected): monospace font, with 5-field labels below (分钟/小时/日/月/星期)
- Current cron display: gray-50 box with monospace code
- Timezone Select: Asia/Shanghai / UTC / America/New_York / Europe/London
- Next execution: read-only Input

Footer: 重置 + 保存.
```

### 16.2 运行调试面板提示词

#### 16.2.1 DETAIL Tab 完整版

```
Create a DETAIL tab for a workflow run panel (340px wide).

Content sections:
1. Status row: icon + status text (succeeded=green CheckCircle2, failed=red XCircle, running=blue spinner, stopped=gray circle)
2. Stats grid (2×2): elapsed time (Clock icon + Xs), total tokens (Zap icon + number), prompt tokens, completion tokens
3. Error count badge (orange-50, AlertTriangle icon) — shown only when errorCount > 0
4. Error message section (red-50, monospace pre) — shown only on failure
5. Input data: collapsible section (ChevronDown toggle), JSON key-value display in gray-50 bg
6. Output data: same collapsible pattern

All text Chinese. Use shadcn/ui Badge, no external JSON viewer library.
```

#### 16.2.2 TRACING Tab 含专项日志

```
Create a TRACING tab for a workflow run panel showing node-by-node execution.

Each trace row: [expand chevron (if has log) + status icon + node title + type badge + token count + elapsed time]
Status icons: CheckCircle2 green (succeeded), XCircle red (failed), spinner blue (running), RotateCcw orange (retry)

Expandable log sub-panels (shown when row is expanded):
- Agent log: indigo-200 left border, Bot icon header, tool call cards (tool name chip + input text + output text)
- Iteration log: blue-200 left border, RefreshCw icon header, per-item table (index + status icon + error + duration)
- Loop log: purple-200 left border, Repeat icon header, per-iteration rows (iteration # + loop var values + status + duration)
- Retry log: orange-200 left border, RotateCcw icon header, attempt rows (attempt # + timestamp + error message + status)

Demo data: Start → LLM (with retry log) → Agent (with agent steps) → Iteration (with 3 items) → End
```

#### 16.2.3 Chatflow 预览面板（三 Tab 版）

```
Create a Chatflow preview panel (380px wide, absolute positioned right-4 top-14 bottom-4, rounded-xl).

Header: "对话预览" title + refresh button + X close button.

Three tabs with icons:
1. "对话" tab (MessageSquare icon): chat interface
   - Message list: user messages right-aligned (primary blue bubble, "U" avatar), AI messages left-aligned (gray-100 bubble, "AI" avatar)
   - Loading state: 3 bouncing dots animation
   - Input area: auto-resize textarea + Send button (spinner when loading)
   - Enter to send, Shift+Enter for newline

2. "对话变量" tab (Variable icon): conversation variables management
   - Info box (blue-50): explanation text
   - Variable cards: name (monospace) + type badge + value editor (Input/Switch based on type) + delete button
   - "添加对话变量" button → inline add form with name Input + type Select + description Input

3. "对话记录" tab (History icon): historical conversations
   - Record cards: first message (truncated) + timestamp + message count badge + branch count badge
   - Branch navigation buttons (← →) for multi-branch conversations
   - Click to load conversation in 对话 tab
```

### 16.3 高级功能组件提示词

#### 16.3.1 ChecklistModal

```
Create a workflow publish checklist modal dialog (480px wide, max-h-[80vh]).

Header: AlertTriangle orange icon + "发布前检查" title + error/warning count badges + X close.

Content (scrollable):
- Node issues section: each item in colored card (red-50 for errors, yellow-50 for warnings)
  [severity icon + node name + type badge + issue description + "转到" button with ArrowRight]
- Plugin issues section: each item in red-50 card
  [Puzzle icon + plugin name + version badge + issue description + "更新" button]
- All-clear state: green-50 card with CheckCircle2 icon + "所有检查通过" + "工作流可以安全发布"

Footer: "取消" outline + "发布工作流" primary (disabled when errors exist, shows error count in label)
```

#### 16.3.2 CommentsPanel

```
Create a comments panel (320px wide right sidebar).

Header: MessageSquare icon + "评论" title + unresolved count badge + X close.

Filter bar:
- "全部" / "我的" toggle buttons
- "显示已解决" / "隐藏已解决" filter button (Filter icon, green when active)

Comment list (divided):
- Each comment: user avatar circle (initials) + author name + relative timestamp + resolved badge (if resolved)
- Comment text (line-clamp-3)
- Reply count link + "标记解决" / "取消解决" button (Check icon)
- Active comment: primary left border + primary/5 background

Empty state: centered MessageSquare icon + "暂无评论"
```

#### 16.3.3 NoteNode 编辑器

```
Create an inline NoteNode editor component (resizable, default 240×160px).

Toolbar (top, same background as theme):
- Format buttons: Bold, Italic, Underline, Link, List (icon-only, 24px, hover:bg-black/10)
- Divider
- Theme color swatches: 8 circles (yellow/blue/green/purple/pink/orange/gray/white), active = ring-2
- Divider
- Show/hide author toggle (Eye/EyeOff icon)

Content area: contentEditable div, text-xs, p-3, focus:outline-none

Author line (optional): "— author name" text-[10px] opacity-60

Resize handle: bottom-right corner, 8×8px SVG diagonal lines, cursor-se-resize
Resize logic: mousedown → track delta → update width/height state (min 160×80px)

8 themes: yellow/blue/green/purple/pink/orange/gray/white — each has bg, border-2, text color
```

### 16.4 画布交互提示词

#### 16.4.1 键盘快捷键弹窗

```
Create a keyboard shortcuts reference modal (560px wide, max-h-[80vh]).

Header: Keyboard icon + "键盘快捷键" title + X close.

Content: 2-column grid of shortcut groups:
- 编辑: Ctrl+Z (撤销), Ctrl+Y (重做), Ctrl+C (复制), Ctrl+V (粘贴), Ctrl+D (复制节点), Del (删除), Ctrl+A (全选), Esc (取消选择)
- 视图: Ctrl+1 (适应画布), Shift+1 (100%), Shift+5 (50%), Ctrl++ (放大), Ctrl+- (缩小), F (聚焦节点), Space+拖拽 (平移)
- 模式: V (指针), H (手型), C (评论)
- 工作流: Ctrl+S (保存), Ctrl+Enter (运行), Ctrl+Shift+P (发布), Ctrl+O (自动整理), Ctrl+Shift+H (版本历史), Ctrl+/ (帮助)

Each shortcut row: description text (flex-1) + key chips (kbd elements with border, bg-gray-100, font-mono)
Multi-key shortcuts: chips separated by "+" text
```

#### 16.4.2 控制模式 + 右键菜单

```
Create canvas control mode buttons and context menus for a workflow editor.

Control mode button group (3 buttons, rounded-lg, border, shadow-sm):
- Pointer (MousePointer2 icon, shortcut V): default mode for selecting/editing nodes
- Hand (Hand icon, shortcut H): pan-only mode, cursor changes to grab
- Comment (MessageSquare icon, shortcut C): click canvas to add comment marker
Active mode: bg-primary text-white. Others: text-gray-500 hover:bg-gray-100.

Three context menu variants (fixed positioned, white bg, border, rounded-lg, shadow-lg, py-1):

1. Edge context menu (w-40): "编辑标签" + divider + "删除连线" (red)

2. Pane context menu (w-44): "添加节点" (Plus) + "粘贴" (Clipboard, ⌘V) + divider + "全选" (Maximize2, ⌘A) + "自动整理布局" (LayoutGrid, ⌘O)

3. Selection context menu (w-44, shows selected count): "复制" (Copy, ⌘C) + divider + align options (左/右/水平居中/垂直居中) + divider + "删除" (Trash2 red, Del)

All text Chinese. Use lucide-react icons.
```
