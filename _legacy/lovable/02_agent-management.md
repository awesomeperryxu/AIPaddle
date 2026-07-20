在当前项目中，请生成"Agent 管理"页面。

## 页面信息
- 页面标题：Agent 管理
- 副标题：创建、配置和管理 AI Agent
- 布局：flex h-full gap-6（左侧列表 + 右侧详情面板）

## 左侧列表区（flex-1，选中 Agent 时 max-w-2xl）

### Header
- 左侧：标题 + 副标题
- 右侧：创建 Agent 按钮（Button gap-2 shadow-sm，Plus 图标 + "创建 Agent"）

### 统计卡片（grid grid-cols-4 gap-3 mb-5）
4 张小卡片（Card p-3），每张：
- w-9 h-9 rounded-lg 图标容器 + 数值 text-lg font-semibold + 标签 text-xs
- 全部(6, Bot, bg-primary/10) / 已发布(3, CheckCircle2, bg-success/10) / 待审核(2, Clock, bg-warning/10) / 草稿(1, XCircle, bg-muted)

### 搜索和筛选（flex gap-3 mb-4）
- 搜索框：relative, Search 图标 absolute left-3, Input pl-9 h-9 bg-card border-border, placeholder="搜索 Agent 名称或部门..."
- Tab 筛选：TabsList bg-muted/50 h-9, TabsTrigger text-xs px-3（全部/已发布/待审核/草稿）

### Agent 列表（space-y-2，overflow-y-auto）
每个 Agent 为一个 Card：
- 整体：bg-card border-border cursor-pointer hover:shadow-md transition-all
- 选中态：ring-2 ring-primary shadow-md
- 内容（p-4 flex items-start gap-3）：
  - 头像：w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20，居中显示 emoji
  - 信息区（flex-1 min-w-0）：
    - 第一行：名称（font-medium truncate）+ 部门 Badge（variant="outline" text-[10px] px-1.5 h-4）+ 状态（ml-auto，w-1.5 h-1.5 圆点 + text-xs 文字）
    - 第二行：描述（text-sm text-muted-foreground line-clamp-1）
    - 第三行：指标（flex gap-4 text-xs text-muted-foreground）：模型名(Bot h-3) + 调用数(MessageSquare h-3) + 成功率(TrendingUp h-3)
  - 操作按钮：DropdownMenu（MoreHorizontal 触发，ghost h-8 w-8）
    - 菜单项：配置(Settings) / 复制(Copy) / 启动(Play) / 暂停(Pause) / 删除(Trash2, text-destructive)

### 状态配置
- draft: 圆点 bg-muted-foreground，文字"草稿"
- pending: 圆点 bg-warning，文字"待审核"
- published: 圆点 bg-success，文字"已发布"
- offline: 圆点 bg-destructive，文字"已下线"

## 右侧详情面板（选中 Agent 后显示，w-96）

Card 包含：
- Agent 头像 + 名称 + 状态 Badge + 描述
- 使用场景卡片（2x2 grid）：本地CC(Phone,蓝) / 企微对话(MessagesSquare,绿) / Web接入(Globe,紫) / API调用(Zap,橙)
- 关联 Skill 列表
- 性能指标（调用次数、成功率、平均响应时间）

## Mock 数据
生成 6 个 Agent：智能客服、HR助手、财务分析、代码审查、文档助手、数据分析，各有不同状态和指标。
