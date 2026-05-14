# 【第 2 步】画布页面布局 + Header 组件

请生成以下 React 组件，使用 TypeScript + TailwindCSS + shadcn/ui + lucide-react。

---

## 组件 1：WorkflowPage（整体页面布局）

生成一个全屏工作流编辑器页面，结构如下：

```
┌─────────────────────────────────────────────────────┐
│  WorkflowHeader（顶部，固定高度 56px）                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ReactFlow 画布（flex-1，背景 #F9FAFB，点阵网格）     │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  WorkflowOperator（底部操作栏，绝对定位）      │   │
│  └──────────────────────────────────────────────┘   │
│                                              ┌────┐ │
│                                              │右侧│ │
│                                              │面板│ │
│                                              └────┘ │
└─────────────────────────────────────────────────────┘
```

技术要求：
- 使用 `reactflow` 的 `ReactFlow`、`Background`（BackgroundVariant.Dots，gap=16，size=1.5，color=#D1D5DB）、`MiniMap`
- MiniMap 定位：右下角，`bottom-16 right-4`，rounded-xl，带边框和阴影
- 点击节点打开右侧配置面板，点击画布空白处关闭
- 右侧面板和运行面板用 `useState` 控制显示/隐藏

---

## 组件 2：WorkflowHeader（三种状态）

生成顶部 Header 组件，高度 56px，白色背景，底部边框。

### 状态 1：normal（正常编辑模式）

左侧区域：
- 返回按钮（ChevronLeft 图标）
- 工作流标题（可点击进入编辑，编辑时变为 Input，失焦保存）
- 未保存状态指示点（橙色小圆点，有改动时显示）

中间区域：
- 撤销按钮（Undo2 图标，disabled 时灰色）
- 重做按钮（Redo2 图标，disabled 时灰色）

右侧区域（从左到右）：
- 在线协作用户头像组（最多显示 3 个，超出显示 +N）
- 环境变量按钮（Variable 图标，点击打开环境变量面板）
- 对话变量按钮（MessageSquare 图标，仅 Chatflow 显示）
- 版本历史按钮（History 图标）
- 运行按钮（Play 图标，绿色，下拉菜单：单步运行/完整运行）
- 发布按钮（Upload 图标，primary 色）

### 状态 2：restoring（版本恢复中）

- 左侧：橙色警告图标 + "正在恢复版本..." 文字
- 右侧：取消恢复按钮 + 确认恢复按钮

### 状态 3：view-history（查看历史版本）

- 左侧：蓝色信息图标 + "正在查看历史版本" + 版本时间戳
- 右侧：恢复此版本按钮（primary）+ 退出查看按钮

---

Props 接口：

```typescript
interface WorkflowHeaderProps {
  mode?: "normal" | "restoring" | "view-history"
  title?: string
  hasUnsavedChanges?: boolean
  onlineUsers?: { id: string; name: string; avatar?: string }[]
  onRun?: () => void
  onPublish?: () => void
  onVersionHistory?: () => void
  onEnvVars?: () => void
}
```
