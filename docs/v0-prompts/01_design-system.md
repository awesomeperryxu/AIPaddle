# 【第 1 步】设计系统基础 — 每次新对话必须先发送此文件

请基于以下设计系统规范，作为后续所有组件生成的基础。不需要生成任何组件，只需确认理解。

---

## 技术栈要求

- React 18 + TypeScript
- `"use client"` 指令（Next.js App Router）
- TailwindCSS（样式）
- shadcn/ui（组件库：Button、Input、Select、Badge、Switch、Slider、Checkbox、Textarea、Dialog 等）
- lucide-react（图标库）
- reactflow（画布，仅画布页面需要）
- 所有 UI 文本标签使用**中文**

---

## 颜色 Token（节点主题色）

```css
/* 画布背景 */
--canvas-bg: #F9FAFB;
--canvas-dot-color: #D1D5DB;

/* 节点颜色（左侧边框条 + 图标背景） */
--node-start:      #2970FF;   /* 开始节点 */
--node-end:        #6B7280;   /* 结束节点 */
--node-answer:     #2970FF;   /* 回复节点（Chatflow） */
--node-llm:        #7C3AED;   /* LLM 节点 */
--node-agent:      #10B981;   /* Agent 节点 */
--node-code:       #F59E0B;   /* 代码执行节点 */
--node-ifelse:     #F59E0B;   /* 条件分支节点 */
--node-http:       #EF4444;   /* HTTP 请求节点 */
--node-knowledge:  #06B6D4;   /* 知识检索节点 */
--node-iteration:  #3B82F6;   /* 迭代容器节点 */
--node-loop:       #8B5CF6;   /* 循环容器节点 */
--node-tool:       #64748B;   /* 工具调用节点 */
--node-trigger:    #F97316;   /* 触发器节点 */
--node-note:       #FEF08A;   /* 备注节点（便利贴） */
```

---

## 节点尺寸规范

| 属性 | 值 |
|------|-----|
| 节点宽度 | 240px（固定） |
| 节点最小高度 | 80px |
| 节点圆角 | 12px（rounded-xl） |
| 左侧边框条宽度 | 4px |
| 节点间距 X | 60px |
| 节点间距 Y | 39px |
| 容器节点最小宽度 | 400px |

---

## 面板尺寸规范

| 面板 | 宽度 |
|------|------|
| 节点配置面板（右侧抽屉） | 380px |
| 运行调试面板 | 340px |
| Chatflow 预览面板 | 380px |
| 版本历史面板 | 320px |
| 环境变量面板 | 360px |
| 评论面板 | 320px |

---

## 通用 UI 规范

- 面板内基础字号：`text-xs`（12px）
- 次要文字：`text-[10px]` 或 `text-[11px]`
- 面板内输入框高度：`h-7`（28px）
- 面板内按钮高度：`h-7` 或 `h-8`
- 面板底部操作按钮：`h-8 flex-1`，左"重置"（outline）右"保存"（primary）
- 节点配置面板三 Tab：参数配置 / 输入变量 / 输出变量（下划线激活样式）
- 所有面板背景：白色，左侧 `border-l border-gray-200`，`shadow-xl`

---

## 变量选择器存根（VarReferencePicker）

在配置面板中，变量选择器统一用以下 Select 存根代替（真实实现为两级弹出选择器）：

```tsx
function VarReferencePicker({ value, onChange, placeholder = "选择变量" }: {
  value?: string; onChange?: (v: string) => void; placeholder?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="sys.query">sys.query</SelectItem>
        <SelectItem value="sys.files">sys.files</SelectItem>
        <SelectItem value="node1.output">node1.output</SelectItem>
        <SelectItem value="conversation.var1">conversation.var1</SelectItem>
      </SelectContent>
    </Select>
  )
}
```

---

已理解以上设计系统规范，后续生成所有组件时请严格遵守。
