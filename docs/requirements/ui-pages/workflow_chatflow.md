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
