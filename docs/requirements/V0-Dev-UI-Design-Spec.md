# AI LLMOps 平台 - v0.dev UI 设计规范文档

**文档版本**: 1.0  
**创建日期**: 2026-05-07  
**用途**: 用于 v0.dev 生成相同的 UI 界面  
**基于**: 已开发的前端代码

---

## 📋 文档说明

本文档专门为 **v0.dev** 设计，包含完整的 UI 规范、组件结构、样式系统和代码示例。
通过本文档，v0.dev 可以生成与现有项目**完全一致**的 UI 界面。

---

## 🎨 设计系统

### 颜色系统 (OKLCH 色彩空间)

```css
/* 亮色模式 */
:root {
  --background: oklch(0.98 0.002 260);      /* 背景色 - 浅灰白 */
  --foreground: oklch(0.18 0.01 260);       /* 前景色 - 深灰黑 */
  --card: oklch(1 0 0);                     /* 卡片背景 - 纯白 */
  --primary: oklch(0.55 0.2 250);           /* 主色 - 蓝色 */
  --accent: oklch(0.6 0.18 180);            /* 强调色 - 青色 */
  --success: oklch(0.6 0.18 145);           /* 成功色 - 绿色 */
  --warning: oklch(0.7 0.18 80);            /* 警告色 - 黄色 */
  --destructive: oklch(0.55 0.22 25);       /* 危险色 - 红色 */
  --muted: oklch(0.95 0.005 260);           /* 弱化色 - 浅灰 */
  --muted-foreground: oklch(0.5 0.01 260);  /* 弱化文字 - 中灰 */
  --border: oklch(0.9 0.005 260);           /* 边框色 - 浅灰 */
  --radius: 0.5rem;                         /* 圆角 - 8px */
}

/* 暗色模式 */
.dark {
  --background: oklch(0.1 0.01 250);        /* 背景色 - 深灰黑 */
  --foreground: oklch(0.95 0.005 260);      /* 前景色 - 浅灰白 */
  --card: oklch(0.14 0.015 250);            /* 卡片背景 - 深灰 */
  --primary: oklch(0.65 0.2 250);           /* 主色 - 亮蓝 */
  --border: oklch(0.25 0.015 250);          /* 边框色 - 深灰 */
  /* ... 其他颜色 */
}
```

### 间距系统

```css
/* Tailwind 默认间距 */
p-1  = 4px    gap-1  = 4px
p-2  = 8px    gap-2  = 8px
p-3  = 12px   gap-3  = 12px
p-4  = 16px   gap-4  = 16px
p-5  = 20px   gap-5  = 20px
p-6  = 24px   gap-6  = 24px

/* 常用间距 */
卡片内边距: p-5 (20px)
卡片间距: gap-4 (16px)
页面边距: p-5 (20px)
```

### 圆角系统

```css
rounded-sm  = 2px
rounded-md  = 6px
rounded-lg  = 8px   /* 默认 */
rounded-xl  = 12px
rounded-2xl = 16px
```

### 阴影系统

```css
shadow-sm   /* 卡片默认阴影 */
shadow-md   /* 悬浮阴影 */
shadow-lg   /* 弹窗阴影 */
```

---

## 🏗️ 布局结构

### 整体布局

```tsx
<div className="flex h-screen bg-background overflow-hidden">
  {/* 侧边栏 - 固定宽度 240px */}
  <AppSidebar />
  
  {/* 主内容区 */}
  <div className="flex-1 flex flex-col overflow-hidden">
    {/* 顶部导航 - 固定高度 48px */}
    <header className="h-12 border-b border-border bg-card px-5">
      {/* 页面标题 + 搜索 + 操作按钮 */}
    </header>
    
    {/* 内容区域 - 可滚动 */}
    <main className="flex-1 overflow-auto p-5 bg-background">
      {/* 页面内容 */}
    </main>
  </div>
</div>
```

### 侧边栏结构

```tsx
<aside className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col">
  {/* Logo 区域 */}
  <div className="h-12 px-4 flex items-center border-b border-sidebar-border">
    <h1 className="text-sm font-semibold text-sidebar-foreground">
      AI LLMOps 平台
    </h1>
  </div>
  
  {/* 导航区域 - 可滚动 */}
  <ScrollArea className="flex-1">
    <nav className="p-3 space-y-1">
      {/* 导航分组 */}
      <div className="space-y-1">
        <h3 className="px-2 text-xs font-medium text-sidebar-foreground/60">
          工作台
        </h3>
        {/* 导航项 */}
        <button className="w-full px-2 py-1.5 rounded-md hover:bg-sidebar-accent">
          <LayoutDashboard className="h-4 w-4" />
          <span>监控</span>
        </button>
      </div>
    </nav>
  </ScrollArea>
  
  {/* 用户区域 */}
  <div className="p-3 border-t border-sidebar-border">
    {/* 用户信息 + 下拉菜单 */}
  </div>
</aside>
```

---

## 📦 核心组件规范

### 1. 统计卡片 (Stats Card)

**用途**: 显示关键指标

```tsx
<Card className="bg-card border-border shadow-sm">
  <CardContent className="p-5">
    <div className="flex items-start justify-between">
      {/* 左侧：数据 */}
      <div>
        <p className="text-sm text-muted-foreground">今日调用量</p>
        <p className="text-2xl font-semibold text-foreground mt-1">
          12,458
        </p>
        <div className="flex items-center gap-1 mt-1.5">
          <TrendingUp className="h-3 w-3 text-green-500" />
          <span className="text-xs text-green-500">+12.5%</span>
          <span className="text-xs text-muted-foreground">vs 昨日</span>
        </div>
      </div>
      
      {/* 右侧：图标 */}
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Activity className="h-5 w-5 text-primary" />
      </div>
    </div>
  </CardContent>
</Card>
```

**样式规范**:
- 卡片内边距: `p-5` (20px)
- 图标容器: `w-10 h-10` (40x40px)
- 图标大小: `h-5 w-5` (20x20px)
- 主数字: `text-2xl font-semibold`
- 标签: `text-sm text-muted-foreground`
- 趋势: `text-xs` + 颜色

### 2. 列表卡片 (List Card)

**用途**: Agent、Skill、知识库列表

```tsx
<Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
  <CardContent className="p-4">
    {/* 头部：图标 + 标题 + 状态 */}
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-medium text-foreground">智能客服 Agent</h3>
          <p className="text-xs text-muted-foreground">客服部</p>
        </div>
      </div>
      <Badge className="bg-success/10 text-success">已发布</Badge>
    </div>
    
    {/* 描述 */}
    <p className="text-sm text-muted-foreground mb-3">
      处理客户咨询，提供7x24小时服务
    </p>
    
    {/* 标签 */}
    <div className="flex flex-wrap gap-1.5 mb-3">
      <Badge variant="outline" className="text-xs">客服</Badge>
      <Badge variant="outline" className="text-xs">自动化</Badge>
    </div>
    
    {/* 底部：指标 */}
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>调用: 1,234</span>
      <span>成功率: 98.5%</span>
      <span>2小时前</span>
    </div>
  </CardContent>
</Card>
```

**样式规范**:
- 卡片内边距: `p-4` (16px)
- 图标容器: `w-10 h-10 rounded-lg`
- 悬浮效果: `hover:shadow-md transition-shadow`
- 标题: `font-medium text-foreground`
- 描述: `text-sm text-muted-foreground`
- 标签间距: `gap-1.5`

### 3. 搜索输入框

```tsx
<div className="relative flex-1">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="搜索..."
    className="pl-9 bg-card border-border h-9"
  />
</div>
```

**样式规范**:
- 图标位置: `left-3` (12px)
- 输入框左边距: `pl-9` (36px)
- 高度: `h-9` (36px)
- 图标大小: `h-4 w-4` (16x16px)

### 4. 状态徽章 (Badge)

```tsx
{/* 成功状态 */}
<Badge className="bg-success/10 text-success border-success/20">
  已发布
</Badge>

{/* 警告状态 */}
<Badge className="bg-warning/10 text-warning border-warning/20">
  待审核
</Badge>

{/* 危险状态 */}
<Badge className="bg-destructive/10 text-destructive border-destructive/20">
  已下线
</Badge>

{/* 中性状态 */}
<Badge className="bg-muted text-muted-foreground">
  草稿
</Badge>
```

### 5. 操作按钮组

```tsx
<div className="flex items-center gap-2">
  {/* 主要操作 */}
  <Button className="gap-2 shadow-sm">
    <Plus className="h-4 w-4" />
    创建 Agent
  </Button>
  
  {/* 次要操作 */}
  <Button variant="outline" size="sm">
    <Download className="h-4 w-4 mr-1.5" />
    导出
  </Button>
  
  {/* 更多操作 */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem>编辑</DropdownMenuItem>
      <DropdownMenuItem>复制</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-destructive">删除</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

---

## 📄 页面模板

### 监控面板 (Dashboard)

**布局**: 4列统计卡片 + 5列次要指标 + 图表区域

```tsx
<div className="space-y-6">
  {/* 页面标题 */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-xl font-semibold text-foreground">监控</h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        企业 AI 使用情况实时监控
      </p>
    </div>
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="gap-1.5 py-1 px-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs">系统正常</span>
      </Badge>
    </div>
  </div>

  {/* 主要统计 - 4列 */}
  <div className="grid grid-cols-4 gap-4">
    {/* 统计卡片 x4 */}
  </div>

  {/* 次要统计 - 5列 */}
  <div className="grid grid-cols-5 gap-3">
    {/* 小统计卡片 x5 */}
  </div>

  {/* 图表区域 - 2列 */}
  <div className="grid grid-cols-2 gap-4">
    {/* 趋势图 */}
    <Card>
      <CardHeader>
        <CardTitle>调用趋势</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            {/* 图表配置 */}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
    
    {/* 分布图 */}
    <Card>
      <CardHeader>
        <CardTitle>Agent 分布</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            {/* 图表配置 */}
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  </div>
</div>
```

### Agent 管理页面

**布局**: 左侧列表 + 右侧详情（可选）

```tsx
<div className="flex h-full gap-6">
  {/* 左侧：列表 */}
  <div className={`flex-1 flex flex-col min-w-0 ${selectedAgent ? 'max-w-2xl' : ''}`}>
    {/* 页面标题 */}
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Agent 管理</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          创建、配置和管理 AI Agent
        </p>
      </div>
      <Button className="gap-2 shadow-sm">
        <Plus className="h-4 w-4" />
        创建 Agent
      </Button>
    </div>

    {/* 统计卡片 - 4列 */}
    <div className="grid grid-cols-4 gap-3 mb-5">
      {/* 统计卡片 x4 */}
    </div>

    {/* 搜索和筛选 */}
    <div className="flex gap-3 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="搜索 Agent..." className="pl-9" />
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="published">已发布</TabsTrigger>
          <TabsTrigger value="pending">待审核</TabsTrigger>
          <TabsTrigger value="draft">草稿</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    {/* Agent 列表 */}
    <ScrollArea className="flex-1">
      <div className="grid grid-cols-2 gap-3">
        {/* Agent 卡片 */}
      </div>
    </ScrollArea>
  </div>

  {/* 右侧：详情面板（可选） */}
  {selectedAgent && (
    <Card className="w-96 flex-shrink-0">
      <CardHeader>
        <CardTitle>{selectedAgent.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 详情内容 */}
      </CardContent>
    </Card>
  )}
</div>
```

---

## 🎯 v0.dev 提示词模板

### 模板 1: 监控面板

```
创建一个 AI LLMOps 平台的监控面板页面，使用 Next.js + TypeScript + Tailwind CSS + shadcn/ui。

布局要求：
1. 页面标题区域：
   - 左侧：标题"监控" + 副标题"企业 AI 使用情况实时监控"
   - 右侧：系统状态徽章（绿点 + "系统正常"）+ 时间筛选按钮

2. 主要统计卡片（4列网格，gap-4）：
   - 今日调用量：数字 + 趋势（+12.5%）+ 图标（Activity）
   - Token 消耗：数字 + 趋势（+8.3%）+ 图标（Zap）
   - 今日成本：数字 + 趋势（-3.2%）+ 图标（DollarSign）
   - 活跃用户：数字 + 趋势（+23.1%）+ 图标（Users）
   
   卡片样式：
   - 内边距 p-5
   - 左侧数据，右侧图标（40x40px 圆角容器）
   - 主数字 text-2xl font-semibold
   - 趋势用绿色/红色小箭头 + 百分比

3. 次要统计卡片（5列网格，gap-3）：
   - 已发布 Agent、已发布 Skill、调用成功率、待审核项、风险告警
   - 更紧凑的布局，p-3.5
   - 横向排列：图标 + 数据

4. 图表区域（2列网格，gap-4）：
   - 左侧：调用趋势（AreaChart，300px高）
   - 右侧：Agent 分布（PieChart，300px高）

颜色系统：
- 使用 OKLCH 色彩空间
- 主色：oklch(0.55 0.2 250) 蓝色
- 成功色：oklch(0.6 0.18 145) 绿色
- 警告色：oklch(0.7 0.18 80) 黄色
- 危险色：oklch(0.55 0.22 25) 红色

组件库：
- 使用 shadcn/ui 的 Card, Badge, Button
- 使用 Recharts 绘制图表
- 使用 Lucide React 图标

请生成完整的 TypeScript 代码。
```

### 模板 2: Agent 管理页面

```
创建一个 AI LLMOps 平台的 Agent 管理页面，使用 Next.js + TypeScript + Tailwind CSS + shadcn/ui。

布局要求：
1. 左右分栏布局（flex gap-6）：
   - 左侧：Agent 列表（flex-1，选中时 max-w-2xl）
   - 右侧：详情面板（w-96，仅在选中时显示）

2. 左侧列表区域：
   a) 页面标题：
      - 左侧：标题"Agent 管理" + 副标题
      - 右侧：创建按钮（带 Plus 图标）
   
   b) 统计卡片（4列，gap-3）：
      - 全部、已发布、待审核、草稿
      - 紧凑样式 p-3
   
   c) 搜索和筛选：
      - 搜索框（带 Search 图标，pl-9）
      - Tab 切换（全部/已发布/待审核/草稿）
   
   d) Agent 卡片网格（2列，gap-3）：
      每个卡片包含：
      - 头部：图标（渐变背景）+ 名称 + 部门 + 状态徽章
      - 描述文字
      - 标签列表
      - 底部指标：调用次数、成功率、更新时间
      - 悬浮效果：hover:shadow-md

3. 右侧详情面板（选中时显示）：
   - 使用 Card 组件
   - 包含：基本信息、使用场景、关联 Skill、性能指标
   - 操作按钮：编辑、启动/暂停、删除

状态徽章颜色：
- 已发布：bg-success/10 text-success
- 待审核：bg-warning/10 text-warning
- 草稿：bg-muted text-muted-foreground
- 已下线：bg-destructive/10 text-destructive

使用场景图标：
- 本地CC：Phone 图标，蓝色
- 企微对话：MessagesSquare 图标，绿色
- Web接入：Globe 图标，紫色
- API调用：Zap 图标，橙色

请生成完整的 TypeScript 代码，包含状态管理。
```

### 模板 3: Skill Hub 页面

```
创建一个 AI LLMOps 平台的 Skill Hub 页面，使用 Next.js + TypeScript + Tailwind CSS + shadcn/ui。

布局要求：
1. 页面标题 + 创建按钮

2. 统计卡片（4列）：
   - 全部 Skill、已发布、待审核、总安装量

3. 搜索和类型筛选：
   - 搜索框
   - 类型按钮组（全部/MCP/API/DB/Workflow/Prompt）

4. Tab 切换：
   - Skill Hub（所有已发布）
   - 我的 Skill（我创建的）

5. Skill 卡片网格（3列，gap-4）：
   每个卡片包含：
   - 类型图标（带颜色背景）
   - Skill 名称 + 版本
   - 描述
   - 发布者
   - 底部：安装量 + 评分 + 风险等级徽章
   - 安装按钮

Skill 类型配置：
- MCP：Globe 图标，蓝色 (text-blue-500, bg-blue-500/10)
- API：Zap 图标，绿色 (text-green-500, bg-green-500/10)
- DB：Database 图标，橙色 (text-orange-500, bg-orange-500/10)
- Workflow：GitBranch 图标，紫色 (text-purple-500, bg-purple-500/10)
- Prompt：MessageSquare 图标，粉色 (text-pink-500, bg-pink-500/10)

风险等级：
- 低：绿色边框徽章
- 中：黄色边框徽章
- 高：红色边框徽章

请生成完整的 TypeScript 代码。
```

---

## 📊 数据结构示例

### Agent 数据

```typescript
interface Agent {
  id: string;
  name: string;
  description: string;
  department: string;
  status: 'draft' | 'pending' | 'published' | 'offline';
  skills: string[];
  knowledgeBases: string[];
  workflows: string[];
  usageScenarios: ('local-cc' | 'wecom' | 'web' | 'api')[];
  metrics: {
    calls: number;
    successRate: number;
    avgResponseTime: number;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// 示例数据
const mockAgent: Agent = {
  id: '1',
  name: '智能客服 Agent',
  description: '处理客户咨询，提供7x24小时服务',
  department: '客服部',
  status: 'published',
  skills: ['skill-1', 'skill-2'],
  knowledgeBases: ['kb-1'],
  workflows: ['wf-1'],
  usageScenarios: ['local-cc', 'wecom'],
  metrics: {
    calls: 1234,
    successRate: 98.5,
    avgResponseTime: 1.2
  },
  tags: ['客服', '自动化'],
  createdAt: '2026-05-01',
  updatedAt: '2026-05-07'
};
```

### Skill 数据

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  type: 'MCP' | 'API' | 'DB' | 'Workflow' | 'Prompt';
  publisher: string;
  version: string;
  installs: number;
  rating: number;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'draft' | 'pending' | 'published';
  tags: string[];
  createdAt: string;
}

// 示例数据
const mockSkill: Skill = {
  id: '1',
  name: 'Google Search MCP',
  description: '通过 MCP 协议调用 Google 搜索',
  type: 'MCP',
  publisher: '系统管理员',
  version: '1.0.0',
  installs: 156,
  rating: 4.8,
  riskLevel: 'low',
  status: 'published',
  tags: ['搜索', 'MCP'],
  createdAt: '2026-04-15'
};
```

---

## ✅ 检查清单

使用本文档在 v0.dev 生成 UI 时，请确保：

- [ ] 使用 OKLCH 色彩空间的颜色变量
- [ ] 使用 shadcn/ui 组件库
- [ ] 使用 Lucide React 图标
- [ ] 遵循间距系统（p-3, p-4, p-5, gap-3, gap-4）
- [ ] 遵循圆角系统（rounded-lg, rounded-xl）
- [ ] 统计卡片使用 p-5 内边距
- [ ] 列表卡片使用 p-4 内边距
- [ ] 图标容器使用 w-10 h-10 或 w-9 h-9
- [ ] 主数字使用 text-2xl font-semibold
- [ ] 标签使用 text-sm text-muted-foreground
- [ ] 悬浮效果使用 hover:shadow-md transition-shadow
- [ ] 状态徽章使用 bg-{color}/10 text-{color}
- [ ] 网格布局使用 grid grid-cols-{n} gap-{n}

---

**文档结束**

*本文档基于 v0-ai-llmops-prototype 项目的实际代码生成，确保 v0.dev 可以生成一致的 UI。*
