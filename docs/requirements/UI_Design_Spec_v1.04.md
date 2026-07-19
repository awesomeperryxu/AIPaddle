# AIPaddle - Claude Code UI 设计规范文档

**文档版本**: 1.04  
**创建日期**: 2026-05-07  
**更新日期**: 2026-05-12  
**用途**: 作为 Claude Code 开发和 UI 验收依据
**基于**: 已开发的前端代码 + Dify 开源代码深度分析

**版本变更**:
- v1.01 (2026-05-08): 新增租户管理模块 UI 规范
- v1.02 (2026-05-08): 新增租户内部管理模块 UI 规范（组织架构、人员、角色权限、访问控制、资源配额、审计日志）
- v1.03 (2026-05-08): 增强租户管理模块 UI 规范（开通企业抽屉、企业详情页、配额管理页、账单管理页、多级页面结构）
- v1.04 (2026-05-12): 新增 Workflow & Chatflow 模块 UI 规范（基于 Dify 源码深度分析，937 个 TSX 文件）

---

## 📋 文档说明

本文档专门为 **Claude Code** 设计，包含完整的 UI 规范、组件结构、样式系统和代码示例。
通过本文档，Claude Code 可以生成与现有项目**完全一致**的 UI 界面。

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
      AIPaddle
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

### 租户管理页面 (Tenants)

> **版本**: v1.01 新增  
> **更新日期**: 2026-05-08

**布局**: 统计卡片 + 筛选器 + 租户列表 + 详情面板

```tsx
<div className="space-y-6">
  {/* 页面标题 */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-xl font-semibold text-foreground">租户管理</h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        企业租户治理与资源管理
      </p>
    </div>
    <Button className="gap-2">
      <Plus className="w-4 h-4" />
      创建租户
    </Button>
  </div>

  {/* 统计卡片 - 4列 */}
  <div className="grid grid-cols-4 gap-4">
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          总租户数
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">128</div>
        <p className="text-xs text-muted-foreground mt-1">
          <span className="text-green-600">+12</span> 本月新增
        </p>
      </CardContent>
    </Card>
    {/* 其他统计卡片 */}
  </div>

  {/* 筛选和搜索 */}
  <div className="flex items-center gap-3">
    <div className="flex-1">
      <Input
        placeholder="搜索企业名称、联系人..."
        className="max-w-sm"
      />
    </div>
    <Select defaultValue="all">
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">全部套餐</SelectItem>
        <SelectItem value="free">Free</SelectItem>
        <SelectItem value="pro">Pro</SelectItem>
        <SelectItem value="enterprise">Enterprise</SelectItem>
      </SelectContent>
    </Select>
  </div>

  {/* 租户列表 */}
  <Card>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>企业信息</TableHead>
          <TableHead>套餐</TableHead>
          <TableHead>使用量</TableHead>
          <TableHead>Token消耗</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>创建时间</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenants.map((tenant) => (
          <TableRow key={tenant.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={tenant.logo} />
                  <AvatarFallback>{tenant.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{tenant.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {tenant.contactEmail}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={
                tenant.package === 'Enterprise' ? 'default' :
                tenant.package === 'Pro' ? 'secondary' : 'outline'
              }>
                {tenant.package}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                <div>{tenant.agentCount} Agents</div>
                <div className="text-muted-foreground">
                  {tenant.memberCount} 成员
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm font-medium">
                {tenant.tokenUsed.toLocaleString()}
              </div>
              <Progress value={tenant.tokenUsage} className="mt-1" />
            </TableCell>
            <TableCell>
              <Badge variant={
                tenant.status === 'active' ? 'success' : 'secondary'
              }>
                {tenant.status === 'active' ? '正常' : '试用'}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {tenant.createdAt}
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm">详情</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Card>
</div>
```

#### 租户管理页面增强 (v1.03 新增)

> **版本**: v1.03 新增  
> **更新日期**: 2026-05-08

**新增内容**:
1. 开通企业抽屉（Drawer）
2. 企业详情页（二级页面）
3. 配额管理页（二级页面）
4. 账单管理页（二级页面）
5. 企业列表操作列增强

---

##### 1. 开通企业抽屉

**布局**: 全屏抽屉（高度 90vh），表单分 4 个区块

```tsx
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Upload, Building2, User, Package, Settings } from "lucide-react"

export function CreateTenantDrawer({ open, onOpenChange }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>开通企业租户</DrawerTitle>
          <DrawerDescription>
            填写企业基本信息，系统将自动创建租户账号并发送通知邮件
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="flex-1 overflow-y-auto px-6">
          <form className="space-y-8 pb-6">
            {/* 区块 1: 企业基本信息 */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">企业基本信息</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">企业名称 *</Label>
                  <Input id="name" placeholder="请输入企业名称" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="code">企业编码 *</Label>
                  <Input id="code" placeholder="TENANT_20260508_0001" />
                  <p className="text-xs text-muted-foreground">
                    系统自动生成，可手动修改
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="industry">行业类型 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择行业" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internet">互联网</SelectItem>
                      <SelectItem value="finance">金融</SelectItem>
                      <SelectItem value="education">教育</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                
                <div className="space-y-2">
                  <Label htmlFor="size">企业规模 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择规模" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-50">1-50人</SelectItem>
                      <SelectItem value="51-200">51-200人</SelectItem>
                      <SelectItem value="201-500">201-500人</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* 区块 2: 联系人信息 */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <User className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">联系人信息</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">联系人姓名 *</Label>
                  <Input id="contactName" placeholder="请输入姓名" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">联系邮箱 *</Label>
                  <Input id="contactEmail" type="email" placeholder="用于接收通知" />
                </div>
              </div>
            </section>

            {/* 区块 3: 套餐与配额 */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Package className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">套餐与配额</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>套餐类型 *</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {['免费版', '标准版', '专业版', '企业版'].map((plan) => (
                      <label key={plan} className="relative flex cursor-pointer">
                        <input type="radio" name="plan" className="peer sr-only" />
                        <div className="w-full rounded-lg border-2 border-border p-4 text-center peer-checked:border-primary peer-checked:bg-primary/5">
                          <div className="font-medium">{plan}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tokenQuota">初始 Token 配额 *</Label>
                  <Input id="tokenQuota" type="number" defaultValue="1000000" />
                  <p className="text-xs text-muted-foreground">单位：Token，最小 10 万</p>
                </div>
              </div>
            </section>

            {/* 区块 4: 高级设置 */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Settings className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">高级设置</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mcpEnabled">是否启用 MCP</Label>
                  <div className="flex items-center gap-2">
                    <Switch id="mcpEnabled" />
                    <span className="text-sm text-muted-foreground">
                      开启后租户可申请自定义 MCP
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="notes">备注信息</Label>
                  <Textarea 
                    id="notes" 
                    placeholder="内部备注，租户不可见" 
                    rows={3}
                  />
                </div>
              </div>
            </section>
          </form>
        </div>
        
        <DrawerFooter className="border-t">
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">
              创建租户
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
```

**Claude Code 提示词**:
```
创建一个企业租户开通表单，使用 Drawer 组件，高度占屏幕 90%。

表单分为 4 个区块：
1. 企业基本信息：企业名称、企业编码、企业简称、行业类型、企业规模、国家/地区、时区、Logo 上传
2. 联系人信息：姓名、职位、邮箱、电话、备用邮箱
3. 套餐与配额：套餐类型（4 选 1 单选卡片）、计费模式（3 选 1 单选卡片）、Token 配额、预警阈值、QPS 限制、存储配额
4. 高级设置：服务有效期、MCP 开关、数据隔离级别、备注

使用 shadcn/ui 组件，OKLCH 配色，8px 圆角，24px 间距。每个区块有图标标题和分隔线。
```

---

##### 2. 企业详情页（二级页面）

**路由**: `/admin/tenants/:tenantId/detail`

**布局**: 左侧信息卡片（320px）+ 右侧 Tab 区域

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Mail, Phone, MapPin, Calendar, Edit } from "lucide-react"

export default function TenantDetailPage({ params }) {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href="/admin/tenants" className="hover:text-foreground">租户管理</a>
        <span>/</span>
        <span className="text-foreground">企业详情</span>
      </div>
      
      {/* 顶部信息栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src="/placeholder.jpg" />
            <AvatarFallback>企</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">示例科技有限公司</h1>
              <Badge variant="success">正常</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              TENANT_20260508_0001 · 互联网行业 · 201-500人
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Edit className="w-4 h-4 mr-2" />
          编辑信息
        </Button>
      </div>
      
      {/* 主体内容 */}
      <div className="flex gap-6">
        {/* 左侧信息卡片 */}
        <Card className="w-80 h-fit">
          <CardHeader>
            <CardTitle className="text-base">基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">联系邮箱</div>
                <div className="text-sm">contact@example.com</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">联系电话</div>
                <div className="text-sm">+86 138 0000 0000</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">所在地区</div>
                <div className="text-sm">中国 · 北京 · 海淀区</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">服务有效期</div>
                <div className="text-sm">2026-05-08 至 2027-05-08</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* 右侧 Tab 区域 */}
        <div className="flex-1">
          <Tabs defaultValue="quota" className="w-full">
            <TabsList>
              <TabsTrigger value="info">基本信息</TabsTrigger>
              <TabsTrigger value="quota">配额使用</TabsTrigger>
              <TabsTrigger value="billing">账单记录</TabsTrigger>
              <TabsTrigger value="logs">操作日志</TabsTrigger>
              <TabsTrigger value="settings">设置</TabsTrigger>
            </TabsList>
            
            <TabsContent value="quota" className="space-y-6 mt-6">
              {/* Token 使用情况 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Token 使用情况</CardTitle>
                    <Button variant="link" size="sm">查看详情</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold">75%</div>
                      <div className="text-sm text-muted-foreground mt-1">使用率</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold">750K</div>
                      <div className="text-sm text-muted-foreground mt-1">已用 Token</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold">250K</div>
                      <div className="text-sm text-muted-foreground mt-1">剩余 Token</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* 存储使用情况 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">存储使用情况</CardTitle>
                    <Button variant="link" size="sm">查看详情</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">已用 6.5GB / 总计 10GB</span>
                      <span className="text-sm font-medium">65%</span>
                    </div>
                    <Progress value={65} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
```

**Claude Code 提示词**:
```
创建一个企业租户详情页，左右布局：

左侧（宽度 320px）：
- 企业 Logo（Avatar 组件）
- 基本信息卡片：联系邮箱、联系电话、所在地区、服务有效期（每项带图标）

右侧（flex-1）：
- 5 个 Tab：基本信息、配额使用、账单记录、操作日志、设置
- 配额使用 Tab 包含：
  - Token 使用情况卡片（环形进度图 + 统计数据 + "查看详情"按钮）
  - 存储使用情况卡片（进度条 + 文件类型表格 + "查看详情"按钮）
  - 并发请求监控卡片（实时 QPS + 曲线图）

顶部：面包屑导航 + 企业名称 + 状态标签 + "编辑"按钮

使用 shadcn/ui，OKLCH 配色，8px 圆角，24px 间距。
```

---

##### 3. 配额管理页（二级页面）

**路由**: `/admin/tenants/:tenantId/quota`

**布局**: 3 个配额卡片横向排列

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Gauge, HardDrive, Zap } from "lucide-react"

export default function QuotaManagementPage({ params }) {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href="/admin/tenants">租户管理</a>
        <span>/</span>
        <a href={`/admin/tenants/${params.tenantId}/detail`}>示例科技</a>
        <span>/</span>
        <span className="text-foreground">配额管理</span>
      </div>
      
      <h1 className="text-2xl font-bold">配额管理</h1>
      
      <div className="grid grid-cols-3 gap-6">
        {/* Token 配额卡片 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Token 配额</CardTitle>
              </div>
              <Button size="sm" variant="outline">调整配额</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">已用</span>
                <span className="font-medium">750,000</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">总计</span>
                <span className="font-medium">1,000,000</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>
            <Button variant="link" size="sm" className="w-full">
              查看详情
            </Button>
          </CardContent>
        </Card>
        
        {/* 存储配额卡片 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">存储配额</CardTitle>
              </div>
              <Button size="sm" variant="outline">调整配额</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">已用</span>
                <span className="font-medium">6.5 GB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">总计</span>
                <span className="font-medium">10 GB</span>
              </div>
              <Progress value={65} className="h-2" />
            </div>
            <Button variant="link" size="sm" className="w-full">
              查看详情
            </Button>
          </CardContent>
        </Card>
        
        {/* 并发限制卡片 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">并发限制</CardTitle>
              </div>
              <Button size="sm" variant="outline">调整限制</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">当前限制</span>
                <span className="font-medium">100 QPS</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">峰值 QPS</span>
                <span className="font-medium">87 QPS</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Claude Code 提示词**:
```
创建一个配额管理页，包含 3 个配额卡片（Token/存储/并发），横向排列。

每个卡片包含：
- 标题（带图标）+ "调整配额"按钮
- 已用量/总量显示
- 进度条（Token 和存储）
- "查看详情"按钮

使用 shadcn/ui Card 组件，OKLCH 配色，8px 圆角。
```

---

##### 4. 账单管理页（二级页面）

**路由**: `/admin/tenants/:tenantId/billing`

**布局**: 统计卡片 + 账单列表表格

```tsx
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Download, Eye, CheckCircle } from "lucide-react"

export default function BillingManagementPage({ params }) {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href="/admin/tenants">租户管理</a>
        <span>/</span>
        <a href={`/admin/tenants/${params.tenantId}/detail`}>示例科技</a>
        <span>/</span>
        <span className="text-foreground">账单管理</span>
      </div>
      
      <h1 className="text-2xl font-bold">账单管理</h1>
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">¥12,580</div>
            <div className="text-sm text-muted-foreground mt-1">累计消费</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">¥3,200</div>
            <div className="text-sm text-muted-foreground mt-1">本月消费</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">¥1,500</div>
            <div className="text-sm text-muted-foreground mt-1">待支付</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-error">¥0</div>
            <div className="text-sm text-muted-foreground mt-1">逾期金额</div>
          </CardContent>
        </Card>
      </div>
      
      {/* 账单列表 */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>账单编号</TableHead>
              <TableHead>账单周期</TableHead>
              <TableHead>账单金额</TableHead>
              <TableHead>Token 消耗</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono text-sm">BILL_20260508_0001</TableCell>
              <TableCell>2026-04-01 至 2026-04-30</TableCell>
              <TableCell className="font-medium">¥3,200</TableCell>
              <TableCell>320,000</TableCell>
              <TableCell>
                <Badge variant="warning">未支付</Badge>
              </TableCell>
              <TableCell>2026-05-01 10:00</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Eye className="w-4 h-4 mr-2" />
                      查看详情
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className="w-4 h-4 mr-2" />
                      下载 PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      标记已支付
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
```

**Claude Code 提示词**:
```
创建一个账单管理页，包含：

顶部：4 个统计卡片（累计消费、本月消费、待支付、逾期金额）

主体：账单列表表格
- 列：账单编号、账单周期、账单金额、Token 消耗、状态、创建时间、操作
- 状态使用 Badge 组件（已支付/未支付/已逾期）
- 操作列使用 DropdownMenu：查看详情、下载 PDF、标记已支付

使用 shadcn/ui Table 组件，OKLCH 配色。
```

---

##### 5. 企业列表操作列增强

```tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { 
  MoreHorizontal, Eye, Edit, Gauge, Receipt, Settings, 
  Pause, Play, Trash 
} from "lucide-react"

export function TenantActionsMenu({ tenant }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem>
          <Eye className="w-4 h-4 mr-2" />
          查看详情
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Edit className="w-4 h-4 mr-2" />
          编辑信息
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Gauge className="w-4 h-4 mr-2" />
          配额管理
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Receipt className="w-4 h-4 mr-2" />
          账单管理
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="w-4 h-4 mr-2" />
          模型配置
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {tenant.status === 'active' ? (
          <DropdownMenuItem className="text-warning">
            <Pause className="w-4 h-4 mr-2" />
            暂停服务
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="text-success">
            <Play className="w-4 h-4 mr-2" />
            恢复服务
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-error">
          <Trash className="w-4 h-4 mr-2" />
          删除租户
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

### 租户内部管理页面组

> **版本**: v1.02 新增  
> **更新日期**: 2026-05-08

租户内部管理包含 6 个核心页面：

#### 1. 组织架构管理

**布局**: 左侧部门树（30%）+ 右侧部门详情（70%）

**关键组件**:
- 部门树（Tree 组件，支持拖拽）
- 部门信息卡片
- 部门统计卡片（Token 消耗、存储、Agent 数、成员数）
- 部门成员列表

**交互特性**:
- 拖拽调整部门层级
- 搜索过滤部门
- 展开/折叠子部门
- 点击部门查看详情

#### 2. 人员管理

**布局**: 统计卡片 + 筛选器 + 用户列表 + 详情抽屉

**关键组件**:
- 4列统计卡片（总用户数、在职员工、今日活跃、待审批）
- 搜索框 + 多条件筛选器（部门、角色、状态）
- 用户表格（头像、姓名、工号、部门、角色、状态、最后登录）
- 用户详情抽屉（基本信息、角色权限、资源配额、操作日志）

**批量操作**:
- 批量导入（Excel）
- 批量分配角色
- 批量导出

#### 3. 角色权限管理

**布局**: 角色卡片网格 + 权限矩阵

**关键组件**:
- 角色卡片（图标、名称、描述、用户数、数据权限）
- 权限矩阵表格（功能模块 × 操作权限）
- 数据权限选择器
- 角色创建/编辑对话框

**权限矩阵**:
- 行：功能模块（Dashboard、Agent 管理、Skill Hub 等）
- 列：操作权限（查看、创建、编辑、删除、审批、导出）
- 单元格：Checkbox 表示是否拥有该权限

#### 4. 访问控制

**布局**: Tab 切换（SSO、MFA、会话管理、登录策略）

**关键组件**:
- SSO 配置表单（IdP、协议、证书）
- MFA 策略开关
- 在线会话列表（用户、IP、设备、时长）
- 登录策略配置

#### 5. 资源配额管理

**布局**: 配额总览 + 使用趋势图 + 部门配额列表

**关键组件**:
- 4列配额卡片（Token、存储、Agent、用户）
- 使用率进度条
- 趋势图（AreaChart）
- 部门配额表格
- 告警设置

#### 6. 审计日志

**布局**: 筛选器 + 日志列表 + 详情展开

**关键组件**:
- 多条件筛选器（时间范围、事件类型、操作人、结果）
- 日志表格（时间、操作人、事件类型、操作对象、IP、结果）
- 日志详情展开
- 导出按钮（Excel、CSV、PDF）

---

## 🎯 Claude Code 提示词模板

### 模板 1: 监控面板

```
创建一个 AIPaddle 的监控面板页面，使用 Next.js + TypeScript + Tailwind CSS + shadcn/ui。

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
创建一个 AIPaddle 的 Agent 管理页面，使用 Next.js + TypeScript + Tailwind CSS + shadcn/ui。

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
创建一个 AIPaddle 的 Skill Hub 页面，使用 Next.js + TypeScript + Tailwind CSS + shadcn/ui。

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

使用本文档在 Claude Code 生成 UI 时，请确保：

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

*本文档基于 AIPaddle 项目的实际代码生成，确保 Claude Code 可以生成一致的 UI。*

---

## 📄 Workflow & Chatflow 模块 UI 规范（v1.04 新增）

> 完整内容详见：[ui-pages/workflow_chatflow.md](./ui-pages/workflow_chatflow.md)  
> 基于：Dify 开源代码深度分析（937 个 TSX 文件）

### 设计系统补充

#### 节点颜色规范

```css
/* Workflow 节点颜色 Token */
--node-start:      #2970FF;   /* 开始/回复节点 */
--node-llm:        #7C3AED;   /* LLM 节点 */
--node-agent:      #10B981;   /* Agent 节点 */
--node-code:       #F59E0B;   /* 代码/条件分支节点 */
--node-http:       #EF4444;   /* HTTP 请求节点 */
--node-knowledge:  #06B6D4;   /* 知识库检索节点 */
--node-iteration:  #3B82F6;   /* 迭代节点 */
--node-loop:       #8B5CF6;   /* 循环节点 */
--node-tool:       #64748B;   /* 工具节点 */
--node-trigger:    #F97316;   /* 触发器节点 */
--node-end:        #6B7280;   /* 结束节点 */
```

#### 画布规格

| 属性 | 值 |
|------|-----|
| 画布背景色 | `#F9FAFB` |
| 网格点颜色 | `#D1D5DB` |
| 网格间距 | 16px |
| 节点宽度 | 240px（固定） |
| 节点圆角 | 12px |
| 左侧边框条宽度 | 4px |
| 容器节点最小宽度 | 400px |

### 页面结构

```
WorkflowPage
├── WorkflowHeader（48px，三种状态：normal/restoring/view-history）
│   ├── 左：返回 + 标题（行内编辑）+ 未保存指示点
│   └── 右：在线用户头像 + 添加节点 + 运行▼ + 历史 + 发布▼
├── ReactFlow 画布（全屏，#F9FAFB + 点状网格）
│   ├── 节点层（30+ 种节点类型）
│   ├── 边层（自定义连线样式）
│   ├── 便签节点层（Note Node，非执行）
│   └── 对齐辅助线（Help Line）
├── WorkflowOperator（底部中央浮动工具栏）
│   ├── 撤销/重做
│   ├── 变量检查触发器
│   ├── 缩放控制（-/百分比/+/适应）
│   └── 小地图切换
├── 右侧面板（互斥显示）
│   ├── NodeConfigPanel（点击节点，380px）
│   ├── VersionHistoryPanel（版本历史，320px）
│   ├── EnvVariablePanel（环境变量，360px）
│   ├── GlobalVariablePanel（全局变量，360px）
│   ├── ChatVariablePanel（对话变量，Chatflow，360px）
│   └── CommentsPanel（评论面板，360px）
├── 运行/调试面板（右侧浮动）
│   ├── WorkflowRunPanel（Workflow，三Tab：结果/详情/追踪）
│   └── ChatflowPreviewPanel（Chatflow，对话预览）
└── VariableInspectPanel（底部可调高度，变量检查）
```

### 核心组件清单

| 组件 | 文件 | 说明 |
|------|------|------|
| `WorkflowPage` | 主页面 | 整体布局容器 |
| `WorkflowHeader` | header/ | 顶部 Header，三种状态 |
| `NodeCard` | nodes/_base/ | 节点卡片基础组件 |
| `NodeConfigPanel` | panel/ | 右侧节点配置面板 |
| `WorkflowOperator` | operator/ | 底部工具栏 |
| `BlockSelector` | block-selector/ | 节点添加面板 |
| `WorkflowRunPanel` | run/ | 运行结果面板（三 Tab） |
| `ChatflowPreviewPanel` | panel/debug-and-preview/ | Chatflow 对话预览 |
| `VersionHistoryPanel` | panel/version-history-panel/ | 版本历史 |
| `EnvVariablePanel` | panel/env-panel/ | 环境变量管理 |
| `GlobalVariablePanel` | panel/global-variable-panel/ | 全局变量查看 |
| `ChatVariablePanel` | panel/chat-variable-panel/ | 对话变量管理 |
| `CommentsPanel` | panel/comments-panel/ | 评论面板 |
| `NoteNode` | note-node/ | 便签节点 |
| `VariableInspectPanel` | variable-inspect/ | 变量检查面板 |

### 节点类型与颜色对照

| 节点 | 颜色 | 容器节点 | 仅 Chatflow |
|------|------|---------|------------|
| 开始（Start） | #2970FF | - | - |
| 直接回复（Answer） | #2970FF | - | ✓ |
| 结束（End） | #6B7280 | - | - |
| LLM | #7C3AED | - | - |
| Agent | #10B981 | - | - |
| 条件分支（If-Else） | #F59E0B | - | - |
| 迭代（Iteration） | #3B82F6 | ✓ | - |
| 循环（Loop） | #8B5CF6 | ✓ | - |
| 代码（Code） | #F59E0B | - | - |
| HTTP 请求 | #EF4444 | - | - |
| 知识库检索 | #06B6D4 | - | - |
| 工具（Tool） | #64748B | - | - |
| Webhook 触发 | #F97316 | - | - |
| 定时触发 | #F97316 | - | - |
| 便签（Note） | 主题色 | - | - |

### Claude Code 提示词索引

完整提示词见 [ui-pages/workflow_chatflow.md 第 10 节](./ui-pages/workflow_chatflow.md)：

| 编号 | 组件 | 提示词位置 |
|------|------|-----------|
| 10.1 | 整体画布页面 | §10.1 |
| 10.2 | 节点卡片全集（12 种） | §10.2 |
| 10.3 | 节点配置面板（LLM） | §10.3 |
| 10.4 | Block Selector | §10.4 |
| 10.5 | 运行结果面板（三 Tab） | §10.5 |
| 10.6 | Chatflow 对话预览面板 | §10.6 |
