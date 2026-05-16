在当前项目中，请生成"工作流管理"列表页（工作流编辑器的入口页面）。

## 页面信息
- 页面标题：工作流管理
- 副标题：创建和管理 AI 工作流应用
- 布局：垂直堆叠 space-y-6

## 页面内容

### Header
- 左侧：标题 + 副标题
- 右侧：创建应用按钮（Plus 图标 + "创建应用"），点击打开 Dialog

### 应用类型筛选（Tabs 或按钮组）
5 个选项，每个带图标和颜色：
- 全部
- 工作流（GitBranch, text-blue-500, bg-blue-500/10）
- Chatflow（MessageSquare, text-green-500, bg-green-500/10）
- Agent（Bot, text-purple-500, bg-purple-500/10）
- 文本生成（FileText, text-orange-500, bg-orange-500/10）

### 搜索框
- Input pl-9 h-9

### 应用卡片网格（grid grid-cols-3 gap-4）或列表
每张应用卡片（Card hover:shadow-md cursor-pointer transition-all）：
- 顶部行：类型图标容器（w-9 h-9 rounded-lg bg-{color}/10）+ 应用名称(font-medium) + 状态Badge
- 描述：text-sm text-muted-foreground line-clamp-2
- 标签行：Badge variant="outline" text-xs（多个标签）
- 底部行（text-xs text-muted-foreground）：最后编辑人 + 时间 | 执行次数 | 成功率
- 操作：DropdownMenu（编辑/复制/删除）
- 点击卡片 → 进入工作流编辑器（下一个 prompt 生成）

### 状态配置
- draft: bg-muted text-muted-foreground，"草稿"
- published: bg-green-500/10 text-green-500，"已发布"
- offline: bg-destructive/10 text-destructive，"已下线"

### 创建应用 Dialog（DialogContent，宽度 480px）
- 标题"创建新应用"
- 应用名称 Input
- 应用类型选择（4 张卡片，2x2 grid，每张含图标+名称+描述，选中态 ring-2 ring-primary）
- 描述 Textarea
- 标签 Input
- 底部：取消 + 创建按钮

## Mock 数据
5 个应用：
1. Github热榜日报（workflow, published, 1234次, 98.5%）
2. 代码转换器（workflow, published, 567次, 95.2%）
3. 每日行业分析报告（text-generation, published, 89次, 100%）
4. 智能客服助手（chatflow, published, 3456次, 97.8%）
5. 数据分析 Agent（agent, draft, 0次）
