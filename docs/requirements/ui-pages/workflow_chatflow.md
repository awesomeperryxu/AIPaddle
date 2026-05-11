# Workflow & Chatflow UI 设计文档

**文档类型**: UI 设计文档  
**创建日期**: 2026-05-11  
**目标版本**: v1.04  
**参考来源**: Dify 开源代码 (`/web/app/components/workflow`)  
**用途**: 用于 v0.dev 生成相同的 UI 界面

---

## 一、设计系统规范

### 1.1 颜色 Token（来自 Dify 源码）

```css
/* 画布背景 */
--color-workflow-canvas-workflow-bg: oklch(0.97 0 0);
--color-workflow-canvas-workflow-dot-color: oklch(0.85 0 0);

/* 节点 */
--color-workflow-block-parma-bg: oklch(0.95 0 0);
--color-workflow-minimap-bg: oklch(0.95 0.01 240 / 0.8);
--color-workflow-minimap-block: oklch(0.90 0 0);

/* 状态色 */
--color-text-success: oklch(0.55 0.18 145);
--color-text-destructive: oklch(0.55 0.22 25);
--color-text-warning: oklch(0.65 0.18 85);
--color-text-accent: oklch(0.55 0.25 262);
```

### 1.2 节点尺寸

```
节点宽度: 240px（NODE_WIDTH）
节点间距 X: 60px（X_OFFSET）
节点间距 Y: 39px（Y_OFFSET）
容器节点内边距: top 65px, right/left 16px, bottom 20px
```

### 1.3 圆角规范

```
节点卡片: rounded-2xl (16px)
节点内参数行: rounded-md (8px)
容器节点内背景: rounded-2xl (16px)
按钮: rounded-lg (8px)
```

---

## 二、页面整体布局

### 2.1 Workflow 编辑器整体结构

```tsx
// 整体布局：全屏画布 + 浮动 Header + 浮动 Operator
export default function WorkflowPage() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-[var(--color-workflow-canvas-workflow-bg)]">
      {/* 顶部 Header（绝对定位，浮在画布上方） */}
      <div className="absolute top-7 left-0 z-10 flex h-0 w-full items-center justify-between px-3">
        <WorkflowHeader />
      </div>

      {/* 画布主体 */}
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          selectionMode={SelectionMode.Partial}
        >
          <Background
            gap={[14, 14]}
            size={2}
            color="var(--color-workflow-canvas-workflow-dot-color)"
          />
        </ReactFlow>
      </ReactFlowProvider>

      {/* 底部 Operator（绝对定位，浮在画布下方） */}
      <div className="absolute right-0 bottom-0 left-0 z-[60] px-1">
        <WorkflowOperator />
      </div>

      {/* 右侧节点配置面板（条件显示） */}
      <NodeConfigPanel />

      {/* 右侧调试预览面板（条件显示） */}
      <DebugAndPreviewPanel />
    </div>
  )
}
```

**v0.dev 提示词**:
```
创建一个全屏工作流编辑器页面，使用 ReactFlow。

布局：
- 顶部浮动工具栏（absolute top-7，z-10）：左侧标题编辑，右侧操作按钮组
- 中间画布区域：点状网格背景（oklch(0.97 0 0)），支持拖拽节点
- 底部浮动操作栏（absolute bottom-0，z-60）：撤销/重做、缩放控制、小地图

画布上有 3 个示例节点（Start → LLM → End），用圆角卡片（rounded-2xl）表示，
节点宽度 240px，节点间用箭头连线。

使用 Tailwind CSS，OKLCH 颜色系统。
```

---

## 三、Header 工具栏

### 3.1 正常编辑模式 Header

```tsx
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Play, History, ChevronDown, Undo2, Redo2,
  Variable, Globe, Clock
} from "lucide-react"

export function WorkflowHeader() {
  return (
    <div className="flex w-full items-center justify-between">
      {/* 左侧：标题 */}
      <div className="flex items-center gap-2">
        <input
          className="rounded-md border-transparent bg-transparent px-2 py-1 text-sm font-semibold
                     hover:border-border focus:border-border focus:outline-none focus:ring-0"
          defaultValue="我的工作流"
        />
      </div>

      {/* 中间：在线用户 */}
      <div className="flex items-center gap-1">
        <div className="flex -space-x-1">
          <Avatar className="h-6 w-6 border-2 border-background">
            <AvatarFallback className="text-[10px]">张</AvatarFallback>
          </Avatar>
          <Avatar className="h-6 w-6 border-2 border-background">
            <AvatarFallback className="text-[10px]">李</AvatarFallback>
          </Avatar>
        </div>
        <span className="text-xs text-muted-foreground">2 人在线</span>
      </div>

      {/* 右侧：操作按钮组 */}
      <div className="flex items-center gap-2">
        {/* 运行按钮 */}
        <Button size="sm" className="gap-1.5 h-8">
          <Play className="h-3.5 w-3.5" />
          运行
        </Button>

        {/* 历史按钮 */}
        <Button variant="outline" size="sm" className="gap-1.5 h-8">
          <History className="h-3.5 w-3.5" />
          历史
        </Button>

        {/* 工具按钮组（圆角边框容器） */}
        <div className="flex items-center rounded-lg border border-border bg-background shadow-xs">
          {/* 环境变量 */}
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-r-none border-r">
            <Variable className="h-3.5 w-3.5" />
            <span className="text-xs">环境变量</span>
          </Button>
          {/* 全局变量 */}
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-l-none">
            <Globe className="h-3.5 w-3.5" />
            <span className="text-xs">全局变量</span>
          </Button>
        </div>

        {/* 版本历史 */}
        <Button variant="outline" size="sm" className="gap-1.5 h-8">
          <Clock className="h-3.5 w-3.5" />
          版本历史
        </Button>

        {/* 发布按钮 */}
        <Button size="sm" className="gap-1.5 h-8 bg-primary">
          发布
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
```

---

## 3. 节点卡片设计

### 3.1 节点基础结构

所有节点共享统一的卡片结构：宽度 240px，圆角 12px，带左侧彩色边框条。

```tsx
// NodeCard.tsx - 节点基础卡片
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react"

type NodeStatus = "idle" | "running" | "succeeded" | "failed" | "waiting"

interface NodeCardProps {
  title: string
  icon: React.ReactNode
  accentColor: string   // e.g. "#2970FF"
  status?: NodeStatus
  selected?: boolean
  children: React.ReactNode
}

const statusConfig = {
  idle:      { icon: null,                                    bg: "" },
  running:   { icon: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,  bg: "ring-2 ring-blue-400" },
  succeeded: { icon: <CheckCircle2 className="h-3 w-3 text-green-500" />,         bg: "ring-2 ring-green-400" },
  failed:    { icon: <XCircle className="h-3 w-3 text-red-500" />,                bg: "ring-2 ring-red-400" },
  waiting:   { icon: <Clock className="h-3 w-3 text-gray-400" />,                 bg: "ring-1 ring-gray-300" },
}

export function NodeCard({ title, icon, accentColor, status = "idle", selected, children }: NodeCardProps) {
  return (
    <div
      className={cn(
        "w-[240px] rounded-xl bg-white shadow-md border border-gray-100 overflow-hidden",
        selected && "ring-2 ring-primary ring-offset-1",
        statusConfig[status].bg
      )}
    >
      {/* 左侧彩色边框条 */}
      <div className="flex">
        <div className="w-1 flex-shrink-0" style={{ backgroundColor: accentColor }} />
        <div className="flex-1">
          {/* 节点头部 */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-50">
            <div className="flex h-6 w-6 items-center justify-center rounded-md"
                 style={{ backgroundColor: accentColor + "20" }}>
              <span style={{ color: accentColor }}>{icon}</span>
            </div>
            <span className="flex-1 text-xs font-medium text-gray-800 truncate">{title}</span>
            {status !== "idle" && statusConfig[status].icon}
          </div>
          {/* 节点内容 */}
          <div className="px-3 py-2">{children}</div>
        </div>
      </div>
    </div>
  )
}
```

### 3.2 各类型节点示例

```tsx
// NodeExamples.tsx - 各节点类型展示
import { NodeCard } from "./NodeCard"
import { Play, Square, MessageSquare, Brain, GitBranch,
         RefreshCw, Code2, Globe, Wrench, BookOpen, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// ── Start 节点 ──────────────────────────────────────────────
export function StartNode() {
  return (
    <NodeCard title="开始" icon={<Play className="h-3.5 w-3.5" />} accentColor="#2970FF">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">输入变量</span>
          <Badge variant="secondary" className="text-[10px] h-4">2 个</Badge>
        </div>
        <div className="rounded-md bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
          query <span className="text-blue-500">string</span>
        </div>
        <div className="rounded-md bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
          files <span className="text-purple-500">array[file]</span>
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
        <div className="flex items-center gap-1.5 rounded-md bg-purple-50 px-2 py-1">
          <div className="h-3.5 w-3.5 rounded-full bg-purple-200 flex items-center justify-center">
            <span className="text-[8px] text-purple-700">G</span>
          </div>
          <span className="text-[11px] text-purple-700">gpt-4o-mini</span>
        </div>
        <div className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
          你是一个专业助手，请根据用户输入 {{"{{"}}query{{"}}"}} 给出回答...
        </div>
      </div>
    </NodeCard>
  )
}

// ── IfElse 节点 ──────────────────────────────────────────────
export function IfElseNode() {
  return (
    <NodeCard title="条件分支" icon={<GitBranch className="h-3.5 w-3.5" />} accentColor="#F59E0B">
      <div className="space-y-1">
        {["IF", "ELIF", "ELSE"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <Badge variant={i === 0 ? "default" : "secondary"}
                   className="text-[10px] h-4 w-8 justify-center shrink-0">
              {label}
            </Badge>
            {i < 2 && (
              <span className="text-[11px] text-gray-500 truncate">
                {i === 0 ? "query 包含 '帮助'" : "query 长度 > 100"}
              </span>
            )}
          </div>
        ))}
      </div>
    </NodeCard>
  )
}

// ── Iteration 节点 (容器节点) ──────────────────────────────────────────────
export function IterationNode() {
  return (
    <div className="w-[400px] rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100">
          <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
        </div>
        <span className="text-xs font-medium text-blue-700">迭代</span>
        <Badge variant="secondary" className="text-[10px] h-4 ml-auto">items</Badge>
      </div>
      <div className="rounded-lg bg-white/70 p-2 text-[11px] text-gray-400 text-center border border-dashed border-blue-200">
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
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">工具</span>
          <div className="flex gap-1">
            {["搜索", "计算器"].map(t => (
              <Badge key={t} variant="outline" className="text-[10px] h-4">{t}</Badge>
            ))}
          </div>
        </div>
      </div>
    </NodeCard>
  )
}

// ── End / Answer 节点 ──────────────────────────────────────────────
export function EndNode({ type = "end" }: { type?: "end" | "answer" }) {
  return (
    <NodeCard
      title={type === "end" ? "结束" : "直接回复"}
      icon={type === "end" ? <Square className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
      accentColor={type === "end" ? "#6B7280" : "#2970FF"}
    >
      <div className="text-[11px] text-gray-500">
        {type === "end" ? "输出变量: answer" : "流式输出到对话"}
      </div>
    </NodeCard>
  )
}
```

---

## 4. 节点配置面板（右侧抽屉）

点击节点后，右侧滑出 360px 宽的配置面板。

```tsx
// NodeConfigPanel.tsx
import { X, ChevronDown, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface NodeConfigPanelProps {
  nodeType: string
  nodeTitle: string
  onClose: () => void
}

export function NodeConfigPanel({ nodeType, nodeTitle, onClose }: NodeConfigPanelProps) {
  return (
    <div className="flex h-full w-[360px] flex-col border-l border-gray-100 bg-white shadow-xl">
      {/* 面板头部 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-sm font-medium">{nodeTitle}</span>
          <span className="text-xs text-gray-400">{nodeType}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 面板内容 */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="params">
          <TabsList className="w-full rounded-none border-b border-gray-100 bg-transparent px-4">
            <TabsTrigger value="params" className="text-xs">参数配置</TabsTrigger>
            <TabsTrigger value="input" className="text-xs">输入变量</TabsTrigger>
            <TabsTrigger value="output" className="text-xs">输出变量</TabsTrigger>
          </TabsList>

          <TabsContent value="params" className="space-y-4 p-4">
            {/* 模型选择 (LLM节点示例) */}
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
                </SelectContent>
              </Select>
            </div>

            {/* 系统提示词 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600">系统提示词</Label>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary px-1">
                  插入变量
                </Button>
              </div>
              <Textarea
                className="min-h-[100px] resize-none text-xs"
                placeholder="你是一个专业助手..."
              />
            </div>

            {/* 参数设置 */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-600">参数</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400">Temperature</span>
                  <Input type="number" defaultValue="0.7" className="h-7 text-xs" step="0.1" min="0" max="2" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400">Max Tokens</span>
                  <Input type="number" defaultValue="2048" className="h-7 text-xs" />
                </div>
              </div>
            </div>

            {/* 记忆开关 */}
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <div>
                <p className="text-xs font-medium">记忆</p>
                <p className="text-[10px] text-gray-400">引用对话历史</p>
              </div>
              <Switch />
            </div>
          </TabsContent>

          <TabsContent value="input" className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">输入变量</span>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1">
                  <Plus className="h-3 w-3" /> 添加
                </Button>
              </div>
              {[{ name: "query", type: "string" }, { name: "context", type: "string" }].map(v => (
                <div key={v.name} className="flex items-center gap-2 rounded-md border border-gray-100 px-2 py-1.5">
                  <span className="flex-1 text-xs font-mono">{v.name}</span>
                  <span className="text-[10px] text-blue-500">{v.type}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Trash2 className="h-3 w-3 text-gray-400" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="output" className="p-4">
            <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-500">
              <p className="font-medium mb-1">输出变量</p>
              <div className="font-mono text-[11px] space-y-1">
                <div>text <span className="text-blue-500">string</span></div>
                <div>usage <span className="text-purple-500">object</span></div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 底部操作 */}
      <div className="border-t border-gray-100 px-4 py-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs h-8">重置</Button>
        <Button size="sm" className="flex-1 text-xs h-8">保存</Button>
      </div>
    </div>
  )
}
```

---

## 5. 底部操作栏（Operator Bar）

```tsx
// WorkflowOperator.tsx - 画布底部工具栏
import { ZoomIn, ZoomOut, Maximize2, Undo2, Redo2, Map } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface WorkflowOperatorProps {
  zoom: number
  canUndo: boolean
  canRedo: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
  onUndo: () => void
  onRedo: () => void
  onToggleMinimap: () => void
  showMinimap: boolean
}

export function WorkflowOperator({
  zoom, canUndo, canRedo,
  onZoomIn, onZoomOut, onFitView,
  onUndo, onRedo, onToggleMinimap, showMinimap
}: WorkflowOperatorProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <div className="flex items-center gap-1 rounded-xl bg-white shadow-lg border border-gray-100 px-2 py-1.5">
        {/* 撤销/重做 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canUndo} onClick={onUndo}>
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">撤销 (⌘Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canRedo} onClick={onRedo}>
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">重做 (⌘⇧Z)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* 缩放控制 */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-[40px] text-center text-xs text-gray-600 tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onFitView}>
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* 小地图切换 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showMinimap ? "secondary" : "ghost"}
              size="icon" className="h-7 w-7"
              onClick={onToggleMinimap}
            >
              <Map className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">小地图</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
```

---

## 6. 调试与预览面板

### 6.1 Workflow 运行面板

```tsx
// WorkflowRunPanel.tsx - 运行结果面板
import { CheckCircle2, XCircle, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface NodeRunResult {
  nodeId: string
  nodeTitle: string
  status: "succeeded" | "failed" | "running" | "waiting"
  duration?: number
  tokens?: number
}

interface WorkflowRunPanelProps {
  status: "running" | "succeeded" | "failed"
  totalDuration?: number
  results: NodeRunResult[]
}

export function WorkflowRunPanel({ status, totalDuration, results }: WorkflowRunPanelProps) {
  return (
    <div className="absolute right-4 top-14 bottom-4 w-[320px] z-10 flex flex-col rounded-xl bg-white shadow-xl border border-gray-100">
      <div className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-t-xl",
        status === "succeeded" && "bg-green-50",
        status === "failed" && "bg-red-50",
        status === "running" && "bg-blue-50"
      )}>
        {status === "succeeded" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
        {status === "failed" && <XCircle className="h-4 w-4 text-red-600" />}
        {status === "running" && <Clock className="h-4 w-4 text-blue-600 animate-pulse" />}
        <span className="text-sm font-medium">
          {status === "succeeded" ? "运行成功" : status === "failed" ? "运行失败" : "运行中..."}
        </span>
        {totalDuration && <span className="ml-auto text-xs text-gray-400">{totalDuration}ms</span>}
      </div>
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-1">
          {results.map((result, i) => (
            <div key={result.nodeId} className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                <span className="text-[10px] text-gray-400 w-4">{i + 1}</span>
                <span className="flex-1 text-xs font-medium truncate">{result.nodeTitle}</span>
                {result.duration && <span className="text-[10px] text-gray-400">{result.duration}ms</span>}
                {result.tokens && <Badge variant="secondary" className="text-[10px] h-4">{result.tokens}t</Badge>}
                {result.status === "succeeded" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                {result.status === "failed" && <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
```

### 6.2 Chatflow 对话预览面板

```tsx
// ChatflowPreviewPanel.tsx
import { Send, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Message { role: "user" | "assistant"; content: string; isStreaming?: boolean }

export function ChatflowPreviewPanel({
  messages, onSend, onReset, onClose
}: {
  messages: Message[]
  onSend: (msg: string) => void
  onReset: () => void
  onClose: () => void
}) {
  return (
    <div className="absolute right-4 top-14 bottom-4 w-[360px] z-10 flex flex-col rounded-xl bg-white shadow-xl border border-gray-100">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="text-sm font-medium">对话预览</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReset}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs shrink-0
                ${msg.role === "user" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}>
                {msg.role === "user" ? "U" : "AI"}
              </div>
              <div className={`max-w-[240px] rounded-xl px-3 py-2 text-xs leading-relaxed
                ${msg.role === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-gray-50 text-gray-800 rounded-tl-sm"}`}>
                {msg.content}
                {msg.isStreaming && <span className="inline-block w-1 h-3 bg-current ml-0.5 animate-pulse" />}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="border-t border-gray-100 p-3 flex gap-2">
        <Input placeholder="输入消息..." className="h-8 text-xs flex-1"
          onKeyDown={(e) => e.key === "Enter" && onSend((e.target as HTMLInputElement).value)} />
        <Button size="icon" className="h-8 w-8 shrink-0">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
```

---

## 7. 版本历史面板

```tsx
// VersionHistoryPanel.tsx
import { Clock, GitBranch, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

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
  onRestore: (versionId: string) => void
  onClose: () => void
}) {
  return (
    <div className="absolute right-4 top-14 bottom-4 w-[320px] z-10 flex flex-col rounded-xl bg-white shadow-xl border border-gray-100">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium">版本历史</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-1">
          {versions.map((v) => (
            <div key={v.id}
              className={`group rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors
                ${v.isCurrent ? "border-primary/30 bg-primary/5" : "border-gray-100"}`}>
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="flex-1 text-xs font-medium">{v.version}</span>
                {v.isPublished && (
                  <Badge className="text-[10px] h-4 bg-green-100 text-green-700 border-0">已发布</Badge>
                )}
                {v.isCurrent && (
                  <Badge variant="secondary" className="text-[10px] h-4">当前</Badge>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                <span>{v.createdAt}</span>
                <span>·</span>
                <span>{v.createdBy}</span>
              </div>
              {v.description && (
                <p className="mt-1 text-[11px] text-gray-500 line-clamp-1">{v.description}</p>
              )}
              {!v.isCurrent && (
                <Button
                  variant="ghost" size="sm"
                  className="mt-1.5 h-6 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRestore(v.id)}
                >
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

---

## 8. v0.dev 提示词

以下提示词可直接粘贴到 [v0.dev](https://v0.dev) 生成对应组件。

### 8.1 整体画布页面

```
Create a full-screen workflow canvas editor page using React and Tailwind CSS.

Layout:
- Top header bar (48px height): left side has back button + workflow title (editable inline) + unsaved indicator dot; right side has "Add Node" button, online user avatars, "Run" button, "History" button, "Publish" button with dropdown
- Main canvas area: full remaining height, light gray dotted grid background (#F9FAFB with dot pattern), ReactFlow-style infinite canvas
- Bottom center floating toolbar: white pill with undo/redo buttons, zoom percentage display with +/- buttons, fit-view button, minimap toggle button
- Right side: 360px config panel slides in when a node is selected

Color scheme: white header, #F9FAFB canvas background, primary blue #2970FF for actions
Node cards: 240px wide, white background, rounded-xl, subtle shadow, left colored accent border (4px)
```

### 8.2 节点卡片组件集

```
Create a set of workflow node card components for a visual workflow editor. Each card is 240px wide with:
- Rounded corners (12px), white background, subtle drop shadow
- 4px left border in the node's accent color
- Header: colored icon (24px) + node title + status indicator (right)
- Body: node-specific content

Create these node types:
1. Start Node (blue #2970FF): shows input variable list with type badges
2. LLM Node (purple #7C3AED): shows model name chip + truncated prompt preview
3. If/Else Node (amber #F59E0B): shows IF/ELIF/ELSE branch labels with conditions
4. Iteration Node (blue, dashed border): container node 400px wide with dotted background, shows "drag nodes here" placeholder
5. Agent Node (green #10B981): shows strategy badge + tool chips
6. End Node (gray #6B7280): shows output variable name
7. Answer Node (blue #2970FF): shows "stream to conversation" label

Status variants: idle (default), running (blue ring + spinner), succeeded (green ring + checkmark), failed (red ring + X icon)
```

### 8.3 节点配置面板

```
Create a right-side configuration panel (360px wide) for a workflow node editor.

Structure:
- Header: colored dot + node title + node type label + close button (X)
- Tab navigation: "参数配置" | "输入变量" | "输出变量"

Params tab content (LLM node example):
- Model selector dropdown (shows model name with provider icon)
- System prompt textarea (with "Insert Variable" button)
- Temperature and Max Tokens inputs in 2-column grid
- Memory toggle switch with description

Input Variables tab:
- List of variable rows: name (monospace) + type badge (colored) + delete button
- "Add Variable" button at top

Output Variables tab:
- Read-only display of output schema

Footer: Reset + Save buttons (full width, side by side)

Style: clean white panel, 12px font size throughout, gray-50 section backgrounds
```

### 8.4 调试运行面板

```
Create a workflow run result panel (320px wide, positioned absolute right-4 top-14 bottom-4).

States:
1. Running: blue header with animated clock icon + "运行中..." text
2. Succeeded: green header with checkmark + "运行成功" + total duration
3. Failed: red header with X icon + "运行失败"

Node execution list (scrollable):
- Each row: index number + node title + execution time (ms) + token count badge + status icon
- Expandable to show input/output JSON

Use Tailwind CSS, shadcn/ui components (Badge, ScrollArea), lucide-react icons.
```

### 8.5 Chatflow 对话预览

```
Create a chat preview panel (360px wide) for testing a chatflow workflow.

Layout:
- Header: "对话预览" title + refresh button + close button
- Message list (scrollable): 
  - User messages: right-aligned, primary blue bubble, rounded-tr-sm
  - AI messages: left-aligned, gray-50 bubble, rounded-tl-sm
  - Both have small avatar circles (U / AI initials)
  - Streaming indicator: blinking cursor at end of AI message
- Input area: text input + send button (icon only)

Empty state: centered illustration with "开始对话" prompt text
Style: clean white panel, 12px font, smooth scroll behavior
```

### 8.6 版本历史面板

```
Create a version history panel (320px wide) for a workflow editor.

Each version item shows:
- Git branch icon + version label (e.g. "v1.2.0") + "已发布" green badge (if published) + "当前" gray badge (if current)
- Timestamp + author name on second line
- Optional description text (truncated to 1 line)
- "恢复此版本" button appears on hover (with RotateCcw icon), hidden for current version

Current version item has light blue background tint and primary-colored border.

Header: Clock icon + "版本历史" title + close button
Use shadcn/ui ScrollArea for the list, lucide-react icons.
```
