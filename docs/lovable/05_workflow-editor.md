在当前项目中，请生成工作流编辑器的画布页面。这是用户点击工作流列表中的某个应用后进入的全屏编辑器。

## 页面信息
- 布局：全屏画布，隐藏主侧边栏导航
- 技术：使用 ReactFlow 库实现画布
- 安装依赖：reactflow

## 整体布局（5 个区域）

### A - 顶部工具栏（h-14, bg-card, border-b, px-4）
- 左侧：返回箭头按钮(ArrowLeft) | 工作流图标(GitBranch) + 名称（可编辑 Input）| 类型标签 Badge（Workflow=蓝/Chatflow=绿）
- 右侧：环境变量按钮(Variable) | 版本历史按钮(History) | 检查清单按钮(CheckCircle, 带数字角标) | 运行按钮(Play, variant="outline", text-green-500) | 发布按钮(primary) | 更多操作(MoreHorizontal)

### B - 画布主体（flex-1，占满剩余空间）
使用 ReactFlow：
- 背景：MiniMap + Background（dots 类型，gap=20，size=1，color=muted-foreground/20）
- 节点：自定义节点组件（见下方节点规范）
- 连线：smoothstep 类型，animated=true（运行时）
- 默认显示 3 个节点：Start → LLM → End，垂直排列

### C - 左侧节点面板（w-64, bg-card, border-r，可折叠）
- 顶部：搜索框 + 折叠按钮(PanelLeftClose)
- 节点分类列表：
  - 基础节点：开始(CircleDot,绿) / 结束(Square,橙)
  - AI 节点：LLM(Sparkles,蓝) / 知识检索(Database,紫) / 问题分类器(Tag,琥珀) / 参数提取器(Braces,玫红)
  - 逻辑节点：IF/ELSE(Diamond,黄) / 迭代(List,青) / 变量赋值(Variable,青)
  - 集成节点：代码执行(Code,灰) / HTTP请求(Globe,粉) / 模板转换(FileCode,靛蓝)
- 每个节点项：可拖拽，左侧色条(4px) + 图标 + 名称
- 拖拽到画布添加节点

### D - 底部操作栏（fixed bottom-4 left-1/2 -translate-x-1/2）
浮动工具条（bg-card border rounded-lg shadow-lg px-2 py-1 flex gap-1）：
- 指针模式按钮(MousePointer2, 选中态 bg-primary/10)
- 手型模式按钮(Hand)
- 分隔线
- 缩小(ZoomOut) | 缩放百分比(text-xs) | 放大(ZoomIn) | 适应画布(Maximize2)
- 分隔线
- 撤销(Undo2) | 重做(Redo2)

### E - 右侧配置面板（w-96, bg-card, border-l，点击节点后滑出）
- 顶部：节点图标 + 名称 Input + 关闭按钮(X)
- 内容：根据节点类型显示不同表单（下一个 prompt 详细描述）
- 暂时显示占位内容："节点配置面板 - 点击节点查看"

## 自定义节点组件规范

每个节点（宽度 240px）：
- 顶部色条（h-1, rounded-t）：颜色按类型（绿/蓝/黄/灰/粉/橙）
- 内容区（p-3 bg-card border rounded-lg shadow-sm）：
  - 图标(w-5 h-5) + 标题(text-sm font-medium) + 类型小字(text-xs text-muted-foreground)
- 左侧 Handle（Target，小圆点 w-3 h-3 bg-muted border-2）
- 右侧 Handle（Source，小圆点 w-3 h-3 bg-muted border-2）
- 选中态：ring-2 ring-primary shadow-md

## 要求
- 使用 ReactFlow 的 useNodesState 和 useEdgesState
- 节点可拖拽移动
- 从左侧面板拖拽节点到画布可添加新节点
- 点击节点高亮并打开右侧面板
- 底部工具栏的缩放按钮控制画布缩放
