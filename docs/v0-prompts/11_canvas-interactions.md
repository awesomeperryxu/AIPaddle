# 【第 11 步】画布交互 UI：操作栏 / 控制模式 / 右键菜单 / 快捷键弹窗

请生成以下 4 个画布交互组件。

---

## 组件 1：WorkflowOperator（底部操作栏）

绝对定位于画布底部中央（bottom-4，left-1/2，-translate-x-1/2）。
白色背景，rounded-xl，border，shadow-md，flex 横向排列，px-3 py-2，gap-1。

### 左侧：控制模式按钮组

3 个按钮（各 32px 正方形，rounded-lg）：
- 指针模式（MousePointer2 图标，快捷键 V）
- 手型模式（Hand 图标，快捷键 H）
- 评论模式（MessageSquare 图标，快捷键 C）
- 激活状态：bg-primary text-white
- 非激活：text-gray-500 hover:bg-gray-100

### 分隔线（h-5，w-px，bg-gray-200）

### 中间：编辑操作

- 撤销按钮（Undo2 图标，Ctrl+Z）
- 重做按钮（Redo2 图标，Ctrl+Y）
- 自动整理布局按钮（LayoutGrid 图标，Ctrl+O）

### 分隔线

### 右侧：视图操作

- 缩小按钮（Minus 图标）
- 缩放比例显示（如 "100%"，点击重置为 100%）
- 放大按钮（Plus 图标）
- 适应画布按钮（Maximize2 图标，Ctrl+1）

### 分隔线

### 最右侧：面板切换

- 变量检查按钮（Variable 图标，点击展开变量检查面板）
- 快捷键帮助按钮（Keyboard 图标，点击打开快捷键弹窗）

---

## 组件 2：VariableInspectPanel（变量检查面板）

从底部操作栏向上展开，高度可拖拽调整（默认 240px，最小 120px，最大 480px）。
白色背景，border-t，shadow-lg。

### Header（拖拽调整高度的手柄区域）
- 顶部居中：灰色横条（拖拽手柄，cursor-ns-resize）
- "变量检查" 标题 + 刷新按钮 + X 关闭按钮

### 内容（overflow-y-auto）

变量列表（表格样式）：
- 列：变量名 / 来源节点 / 类型 / 当前值
- 每行：font-mono 变量名 + 节点名徽章 + 类型徽章 + 值（截断）
- 点击行展开查看完整值（JSON 格式化显示）

空状态："运行工作流后可在此查看变量值"

### 拖拽调整高度

顶部手柄 mousedown → 追踪 mousemove delta → 更新面板高度（min 120px，max 480px）

---

## 组件 3：三种右键菜单

### EdgeContextMenu（边右键菜单）

固定定位，w-40，白色背景，border，rounded-lg，shadow-lg，py-1：
- "编辑标签"（AlignLeft 图标）
- 分隔线
- "删除连线"（Trash2 图标，红色文字）

### PaneContextMenu（画布空白区右键菜单）

固定定位，w-44：
- "添加节点"（Plus 图标）
- "粘贴"（Clipboard 图标）+ 快捷键提示 "⌘V"（右对齐，gray-400）
- 分隔线
- "全选"（Maximize2 图标）+ "⌘A"
- "自动整理布局"（LayoutGrid 图标）+ "⌘O"

### SelectionContextMenu（多选节点右键菜单）

固定定位，w-44：
- 顶部：已选 N 个节点（text-[10px]，gray-400）
- 分隔线
- "复制"（Copy 图标）+ "⌘C"
- 分隔线
- 对齐子菜单：
  - "左对齐"（AlignLeft 图标）
  - "右对齐"（AlignRight 图标）
  - "水平居中"（AlignHorizontalJustifyCenter 图标）
  - "垂直居中"（AlignVerticalJustifyCenter 图标）
- 分隔线
- "删除"（Trash2 图标，红色）+ "Del"

---

## 组件 4：KeyboardShortcutsModal（键盘快捷键弹窗）

居中弹窗，560px 宽，max-h-[80vh]，白色背景，rounded-xl，shadow-2xl。

### Header
- Keyboard 图标 + "键盘快捷键" 标题 + X 关闭

### 内容（2 列网格，overflow-y-auto）

**编辑操作**（左列）：
| 快捷键 | 功能 |
|--------|------|
| ⌘Z | 撤销 |
| ⌘Y | 重做 |
| ⌘C | 复制节点 |
| ⌘V | 粘贴节点 |
| ⌘D | 复制节点（原地） |
| Del | 删除选中 |
| ⌘A | 全选 |
| Esc | 取消选择 |

**视图操作**（右列）：
| 快捷键 | 功能 |
|--------|------|
| ⌘1 | 适应画布 |
| Shift+1 | 缩放 100% |
| Shift+5 | 缩放 50% |
| ⌘+ | 放大 |
| ⌘- | 缩小 |
| F | 聚焦节点 |
| Space+拖拽 | 平移画布 |

**控制模式**（左列下方）：
| 快捷键 | 功能 |
|--------|------|
| V | 指针模式 |
| H | 手型模式 |
| C | 评论模式 |

**工作流操作**（右列下方）：
| 快捷键 | 功能 |
|--------|------|
| ⌘S | 保存草稿 |
| ⌘Enter | 运行工作流 |
| ⌘⇧P | 发布工作流 |
| ⌘O | 自动整理 |
| ⌘⇧H | 版本历史 |
| ⌘/ | 显示帮助 |

### 快捷键 chip 样式

每个按键用 `<kbd>` 元素：
- `border border-gray-300 bg-gray-100 rounded px-1.5 py-0.5 text-[10px] font-mono shadow-sm`
- 多键组合：chip 之间用 "+" 文字连接
