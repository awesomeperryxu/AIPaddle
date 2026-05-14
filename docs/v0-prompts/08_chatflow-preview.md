# 【第 8 步】Chatflow 对话预览面板（三 Tab 版）

请生成 `ChatflowPreviewPanel` 组件，380px 宽，绝对定位于画布右侧（right-4 top-14 bottom-4），白色背景，rounded-xl，shadow-xl。

---

## 整体结构

```
┌──────────────────────────────────────┐
│  对话预览              [刷新] [×]     │  ← Header（gray-50 背景）
├──────────────────────────────────────┤
│  💬 对话 │ 📊 对话变量 │ 📋 对话记录  │  ← Tab 栏（带图标）
├──────────────────────────────────────┤
│                                      │
│  Tab 内容区                           │
│                                      │
└──────────────────────────────────────┘
```

---

## Tab 1：对话（MessageSquare 图标）

### 消息列表区（flex-1，overflow-y-auto，p-4）

**用户消息**（右对齐）：
- 布局：消息气泡 + 头像（右侧）
- 气泡：primary 蓝色背景，白色文字，rounded-2xl rounded-tr-sm
- 头像：primary 色圆形，白色 "U" 字母

**AI 消息**（左对齐）：
- 布局：头像（左侧）+ 消息气泡
- 气泡：gray-100 背景，深色文字，rounded-2xl rounded-tl-sm
- 头像：gray-200 圆形，灰色 "AI" 字母

**流式输出状态**：
- AI 消息末尾显示闪烁光标（`|` 字符，animate-pulse）

**加载状态**（用户发送后，AI 回复前）：
- 3 个跳动圆点（animate-bounce，延迟 0ms / 150ms / 300ms）

**错误状态**：
- red-50 气泡，红色文字，AlertTriangle 图标

**空状态**：
- 居中显示 MessageSquare 图标 + "发送消息开始测试对话"

### 输入区（底部，border-t，p-3）

- 自动调整高度的 Textarea（min-h-[36px]，max-h-[120px]）
- placeholder："输入消息... (Enter 发送，Shift+Enter 换行)"
- 发送按钮（Send 图标，loading 时显示旋转圆圈）
- Enter 发送，Shift+Enter 换行

---

## Tab 2：对话变量（Variable 图标）

说明框（blue-50）："对话变量在整个会话中持久保存，可被工作流节点读取和修改。"

### 变量列表

每个变量卡片（border，rounded-lg，p-3）：
- 顶部：变量名（font-mono，font-medium）+ 类型徽章 + 删除按钮
- 值编辑器（根据类型不同）：
  - string → Input（h-6，text-xs）
  - number → Input（type=number）
  - boolean → Switch
  - object/array → Textarea（font-mono，min-h-[60px]）
- 描述文字（text-[10px]，gray-400）

### 添加变量

点击 "添加对话变量" 按钮后，展开内联表单：
- 变量名 Input + 类型 Select（string/number/boolean/object/array）
- 描述 Input（可选）
- "确认添加" 按钮 + "取消" 按钮

---

## Tab 3：对话记录（History 图标）

说明文字："点击记录可在对话 Tab 中加载该会话"

### 记录列表

每条记录卡片（border，rounded-lg，p-3，hover:bg-gray-50，点击选中高亮）：
- 第一条消息预览（text-xs，truncate）
- 时间戳（text-[10px]，gray-400）
- 右侧：消息数量徽章 + 分支数量徽章（若 > 1）
- 多分支时显示：← 上一分支 / 下一分支 → 按钮

---

## 演示数据

**对话 Tab**：
- 用户："你好，请介绍一下你的功能"
- AI："您好！我是基于工作流构建的 AI 助手，可以帮您处理各种任务..."
- 用户："如何配置 LLM 节点？"
- AI（流式输出中）："LLM 节点支持配置..."（末尾显示光标）

**对话变量 Tab**：
- user_name（string）= "张三"
- dialog_count（number）= 3
- is_vip（boolean）= false

**对话记录 Tab**：
- 3 条历史记录，第 2 条有 2 个分支
