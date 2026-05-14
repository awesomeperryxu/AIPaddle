# 【第 7 步】运行调试面板（Result / Detail / Tracing 三 Tab）

请生成 `WorkflowRunPanel` 组件，340px 宽，绝对定位于画布右侧，白色背景，shadow-xl。

---

## 整体结构

```
┌──────────────────────────────────────┐
│  运行结果              [停止] [×]     │  ← Header
├──────────────────────────────────────┤
│  RESULT │ DETAIL │ TRACING           │  ← Tab 栏
├──────────────────────────────────────┤
│                                      │
│  Tab 内容区（overflow-y-auto）        │
│                                      │
└──────────────────────────────────────┘
```

---

## Tab 1：RESULT（运行结果）

显示工作流最终输出：
- 运行中：蓝色旋转 spinner + "运行中..." 文字
- 成功：输出内容展示（支持文本/JSON/图片/文件）
- 失败：红色错误图标 + 错误信息

---

## Tab 2：DETAIL（执行详情）

### 执行状态行
- 图标 + 状态文字（颜色对应）：
  - succeeded → 绿色 CheckCircle2 + "成功"
  - failed → 红色 XCircle + "失败"
  - running → 蓝色旋转圆圈 + "运行中"
  - stopped → 灰色圆圈 + "已停止"

### 执行统计（2×2 网格，gray-50 背景卡片）
- 耗时：Clock 图标 + "X.XXs"
- 总 Token：Zap 图标 + 数字
- 提示 Token：数字
- 补全 Token：数字

### 异常计数（仅 errorCount > 0 时显示）
- orange-50 背景，AlertTriangle 图标，"X 个节点发生异常"

### 错误信息（仅 failed 时显示）
- red-50 背景，red-200 边框，monospace pre 文字

### 输入数据（可折叠）
- ChevronDown 展开/收起
- 展开后：gray-50 背景，key-value 列表（key 蓝色 monospace，value 灰色 monospace）

### 输出数据（可折叠）
- 同输入数据结构

---

## Tab 3：TRACING（执行追踪）

节点执行树，每行显示：
```
[展开箭头] [状态图标] 节点名称    [类型徽章] [Token数] [耗时ms]
```

状态图标：
- succeeded → 绿色 CheckCircle2
- failed → 红色 XCircle
- running → 蓝色旋转圆圈
- waiting → 灰色空心圆
- retry → 橙色 RotateCcw

**可展开的专项日志子面板（点击行展开）：**

### Agent 日志（Agent 节点）
- indigo-200 左侧边框，Bot 图标标题 "Agent 执行步骤"
- 每个步骤卡片（indigo-50 背景）：
  - 步骤序号徽章 + 工具名称
  - 输入：文字
  - 输出：文字

### Iteration 日志（Iteration 节点）
- blue-200 左侧边框，RefreshCw 图标标题 "迭代结果（N 项）"
- 每项：序号 + 状态图标 + 错误信息（若失败）+ 耗时

### Loop 日志（Loop 节点）
- purple-200 左侧边框，Repeat 图标标题 "循环记录（N 次）"
- 每次：第N次 + 状态图标 + 循环变量值 + 耗时

### Retry 日志（有重试的节点）
- orange-200 左侧边框，RotateCcw 图标标题 "重试记录（N 次）"
- 每次：第N次徽章 + 状态图标 + 时间戳 + 错误信息

---

## Props 接口

```typescript
interface WorkflowRunPanelProps {
  status: "running" | "succeeded" | "failed" | "stopped"
  elapsedMs?: number
  promptTokens?: number
  completionTokens?: number
  errorCount?: number
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  errorMessage?: string
  traceNodes?: TraceNode[]
  onClose?: () => void
  onStop?: () => void
}

interface TraceNode {
  id: string
  title: string
  type: string
  status: "succeeded" | "failed" | "running" | "waiting" | "retry"
  durationMs: number
  tokens?: number
  logType?: "agent" | "iteration" | "loop" | "retry" | null
  // 各类型日志数据...
}
```

---

## 演示数据

使用以下演示数据渲染：
- 状态：succeeded
- 耗时：3.45s，提示 Token：512，补全 Token：256
- 追踪节点：开始 → LLM处理（有 retry 日志，2次重试）→ Agent执行（有 agent 日志，2个工具步骤）→ 批量处理（有 iteration 日志，3项）→ 结束
