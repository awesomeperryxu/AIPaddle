# 【第 10 步】高级功能组件：Checklist / Comments / NoteNode 编辑器

请生成以下 3 个高级功能组件。

---

## 组件 1：ChecklistModal（发布前校验弹窗）

触发时机：点击 Header 的"发布"按钮时，先执行校验，若有问题则弹出此弹窗。

### 弹窗结构（480px 宽，max-h-[80vh]，居中）

**Header**：
- AlertTriangle 橙色图标
- "发布前检查" 标题
- 错误数量徽章（red-100 背景）+ 警告数量徽章（yellow-100 背景）
- X 关闭按钮

**内容区（overflow-y-auto）**：

节点问题列表（若有）：
- 分组标题："节点问题"
- 每项卡片：
  - 错误（severity=error）：red-50 背景，red-200 边框，AlertTriangle 红色图标
  - 警告（severity=warning）：yellow-50 背景，yellow-200 边框，AlertTriangle 黄色图标
  - 内容：节点名称 + 类型徽章 + 问题描述 + "转到" 按钮（ArrowRight 图标）

插件问题列表（若有）：
- 分组标题："插件问题"
- 每项：red-50 背景，Puzzle 图标，插件名 + 版本徽章 + 问题描述 + "更新" 按钮

全部通过状态：
- green-50 背景，green-200 边框，CheckCircle2 绿色图标
- "所有检查通过" + "工作流可以安全发布"

**Footer**：
- "取消" outline 按钮（flex-1）
- "发布工作流" primary 按钮（flex-1）
  - 有错误时：disabled，按钮文字显示 "修复 X 个问题后发布"
  - 无错误时：可点击

---

## 组件 2：CommentsPanel（评论面板）

320px 宽，右侧面板，白色背景，shadow-xl。

### Header
- MessageSquare 图标 + "评论" 标题 + 未解决数量徽章 + X 关闭

### 过滤栏
- "全部" / "我的" 切换按钮（左侧）
- "显示已解决" 过滤按钮（Filter 图标，右侧，激活时 green-100 背景）

### 评论列表（divide-y）

每条评论：
- 激活状态（isActive=true）：primary 左侧边框（border-l-2）+ primary/5 背景
- 用户头像（圆形，显示姓名首字）+ 姓名 + 相对时间
- 已解决徽章（green-100，仅已解决时显示）
- 评论内容（text-xs，line-clamp-3）
- 底部操作：
  - 回复数量链接（"X 条回复"，primary 色）
  - "标记解决" / "取消解决" 按钮（Check 图标，右对齐）

### 空状态
- 居中 MessageSquare 图标（opacity-30）+ "暂无评论"

---

## 组件 3：NoteNode 编辑器（内联富文本）

NoteNode 双击后进入编辑模式，显示此编辑器。

### 整体结构

可调整大小的便利贴容器（默认 240×160px，最小 160×80px）：
- 主题色决定背景色、边框色、文字色
- 右下角拖拽手柄（调整大小）

### 工具栏（顶部，与主题色匹配的浅色背景）

格式按钮（各 24px，hover:bg-black/10）：
- Bold（B）/ Italic（I）/ Underline（U）/ Link（Link 图标）/ 无序列表（List 图标）

分隔线

主题色选择（8 个圆形色块，16px）：
- 黄色（#FEF08A）/ 蓝色（#BFDBFE）/ 绿色（#BBF7D0）/ 紫色（#E9D5FF）
- 粉色（#FBCFE8）/ 橙色（#FED7AA）/ 灰色（#E5E7EB）/ 白色（#FFFFFF）
- 当前主题：ring-2 ring-offset-1 ring-gray-400

分隔线

显示作者切换（Eye / EyeOff 图标）

### 内容区

contentEditable div，text-xs，p-3，focus:outline-none

### 作者署名（可选）

"— 作者姓名"，text-[10px]，opacity-60，底部显示

### 拖拽调整大小

右下角 8×8px SVG 对角线图标，cursor-se-resize。
鼠标按下时：记录起始位置和尺寸，mousemove 时更新宽高，mouseup 时结束。

### 8 种主题配色

| 主题 | 背景 | 边框 | 文字 |
|------|------|------|------|
| yellow | bg-yellow-50 | border-yellow-300 | text-yellow-900 |
| blue | bg-blue-50 | border-blue-300 | text-blue-900 |
| green | bg-green-50 | border-green-300 | text-green-900 |
| purple | bg-purple-50 | border-purple-300 | text-purple-900 |
| pink | bg-pink-50 | border-pink-300 | text-pink-900 |
| orange | bg-orange-50 | border-orange-300 | text-orange-900 |
| gray | bg-gray-50 | border-gray-300 | text-gray-900 |
| white | bg-white | border-gray-200 | text-gray-900 |
