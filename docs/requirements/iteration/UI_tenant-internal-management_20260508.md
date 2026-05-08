# LLMOps SaaS 平台 - 租户内部管理 UI 设计规范

## 文档信息

**模块名称**: 租户内部管理 UI 设计  
**文档版本**: 1.0  
**创建日期**: 2026-05-08  
**用途**: 用于 v0.dev 生成租户内部管理相关页面  
**关联 PRD**: PRD_tenant-internal-management_20260508.md

---

## 📋 设计原则

### 核心原则

1. **清晰的层级结构** - 组织架构和权限关系一目了然
2. **高效的批量操作** - 支持批量导入、分配、编辑
3. **完善的权限控制** - 不同角色看到不同的操作权限
4. **友好的错误提示** - 操作失败时给出明确的解决方案
5. **完整的操作日志** - 所有敏感操作可追溯

### 设计风格

- 延续平台整体设计风格（OKLCH 色彩、shadcn/ui 组件）
- 强调数据可视化（部门树、权限矩阵、配额图表）
- 注重交互反馈（加载状态、成功/失败提示）

---

## 🎨 页面设计规范

### 1. 组织架构管理页面

#### 1.1 页面布局

**布局结构**: 左侧部门树（30%）+ 右侧详情区（70%）

```tsx
<div className="flex h-[calc(100vh-4rem)] gap-4">
  {/* 左侧：部门树 */}
  <Card className="w-[30%] flex flex-col">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-base">组织架构</CardTitle>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          新建部门
        </Button>
      </div>
    </CardHeader>
    <CardContent className="flex-1 overflow-auto">
      {/* 部门树组件 */}
      <DepartmentTree />
    </CardContent>
  </Card>

  {/* 右侧：部门详情 */}
  <div className="flex-1 space-y-4">
    {/* 部门信息卡片 */}
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle>研发部</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                DEV-001 · 上级：技术中心
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">编辑</Button>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">部门负责人</p>
            <p className="text-sm font-medium mt-1">张三</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">部门人数</p>
            <p className="text-sm font-medium mt-1">45 人</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">成本中心</p>
            <p className="text-sm font-medium mt-1">CC-2024-001</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">部门状态</p>
            <Badge variant="success" className="mt-1">正常</Badge>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* 部门统计 */}
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Token 消耗
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">1.2M</div>
          <p className="text-xs text-muted-foreground mt-1">
            本月 · 配额 2M
          </p>
          <Progress value={60} className="mt-2" />
        </CardContent>
      </Card>
      {/* 其他统计卡片 */}
    </div>

    {/* 部门成员 */}
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">部门成员</CardTitle>
          <Button variant="outline" size="sm">查看全部</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          {/* 成员列表 */}
        </Table>
      </CardContent>
    </Card>
  </div>
</div>
```

#### 1.2 部门树组件

**组件特性**:
- 支持拖拽调整层级
- 支持搜索过滤
- 显示部门人数
- 高亮当前选中部门

```tsx
<div className="space-y-2">
  {/* 搜索框 */}
  <div className="relative">
    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="搜索部门..."
      className="pl-8 h-9"
    />
  </div>

  {/* 部门树 */}
  <div className="space-y-1">
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer">
      <ChevronDown className="w-4 h-4" />
      <Building2 className="w-4 h-4" />
      <span className="text-sm flex-1">技术中心</span>
      <span className="text-xs text-muted-foreground">120</span>
    </div>
    
    <div className="ml-4 space-y-1">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-accent">
        <ChevronDown className="w-4 h-4" />
        <Folder className="w-4 h-4" />
        <span className="text-sm flex-1">研发部</span>
        <span className="text-xs text-muted-foreground">45</span>
      </div>
      
      <div className="ml-4 space-y-1">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer">
          <ChevronRight className="w-4 h-4" />
          <Folder className="w-4 h-4" />
          <span className="text-sm flex-1">前端组</span>
          <span className="text-xs text-muted-foreground">15</span>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

### 2. 人员管理页面

#### 2.1 页面布局

**布局结构**: 统计卡片 + 筛选器 + 用户列表 + 详情抽屉

```tsx
<div className="space-y-6">
  {/* 页面标题 */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-xl font-semibold text-foreground">人员管理</h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        企业用户创建、编辑和权限管理
      </p>
    </div>
    <div className="flex items-center gap-2">
      <Button variant="outline" className="gap-2">
        <Upload className="w-4 h-4" />
        批量导入
      </Button>
      <Button className="gap-2">
        <UserPlus className="w-4 h-4" />
        创建用户
      </Button>
    </div>
  </div>

  {/* 统计卡片 - 4列 */}
  <div className="grid grid-cols-4 gap-4">
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          总用户数
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">328</div>
        <p className="text-xs text-muted-foreground mt-1">
          <span className="text-green-600">+12</span> 本月新增
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          在职员工
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">305</div>
        <p className="text-xs text-muted-foreground mt-1">
          试用期 23 人
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          今日活跃
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">156</div>
        <p className="text-xs text-muted-foreground mt-1">
          活跃率 51%
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          待审批
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-orange-600">5</div>
        <p className="text-xs text-muted-foreground mt-1">
          权限变更申请
        </p>
      </CardContent>
    </Card>
  </div>

  {/* 筛选和搜索 */}
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索姓名、工号、邮箱..."
            className="pl-9"
          />
        </div>
        
        <Select defaultValue="all-dept">
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-dept">全部部门</SelectItem>
            <SelectItem value="dev">研发部</SelectItem>
            <SelectItem value="product">产品部</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="all-role">
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-role">全部角色</SelectItem>
            <SelectItem value="admin">管理员</SelectItem>
            <SelectItem value="dev">开发者</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="all-status">
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-status">全部状态</SelectItem>
            <SelectItem value="active">正常</SelectItem>
            <SelectItem value="trial">试用</SelectItem>
            <SelectItem value="frozen">冻结</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon">
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
      </div>
    </CardContent>
  </Card>

  {/* 用户列表 */}
  <Card>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox />
          </TableHead>
          <TableHead>用户信息</TableHead>
          <TableHead>部门</TableHead>
          <TableHead>角色</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>最后登录</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>
            <Checkbox />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src="/avatars/01.png" />
                <AvatarFallback>张三</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">张三</div>
                <div className="text-xs text-muted-foreground">
                  E001 · zhang@company.com
                </div>
              </div>
            </div>
          </TableCell>
          <TableCell>
            <div className="text-sm">研发部</div>
            <div className="text-xs text-muted-foreground">前端组</div>
          </TableCell>
          <TableCell>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-xs">开发者</Badge>
              <Badge variant="outline" className="text-xs">部门管理员</Badge>
            </div>
          </TableCell>
          <TableCell>
            <Badge variant="success">正常</Badge>
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            2 小时前
          </TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm">详情</Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    
    {/* 分页 */}
    <div className="flex items-center justify-between px-6 py-4 border-t">
      <div className="text-sm text-muted-foreground">
        共 328 条记录，显示第 1-20 条
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled>
          上一页
        </Button>
        <Button variant="outline" size="sm">
          下一页
        </Button>
      </div>
    </div>
  </Card>
</div>
```

#### 2.2 用户详情抽屉

**抽屉布局**: 右侧滑出，宽度 600px

```tsx
<Sheet>
  <SheetContent className="w-[600px] sm:max-w-[600px]">
    <SheetHeader>
      <div className="flex items-center gap-3">
        <Avatar className="w-12 h-12">
          <AvatarImage src="/avatars/01.png" />
          <AvatarFallback>张三</AvatarFallback>
        </Avatar>
        <div>
          <SheetTitle>张三</SheetTitle>
          <p className="text-sm text-muted-foreground">
            E001 · 高级前端工程师
          </p>
        </div>
      </div>
    </SheetHeader>

    <div className="mt-6 space-y-6">
      {/* Tab 切换 */}
      <Tabs defaultValue="info">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="info">基本信息</TabsTrigger>
          <TabsTrigger value="roles">角色权限</TabsTrigger>
          <TabsTrigger value="quota">资源配额</TabsTrigger>
          <TabsTrigger value="logs">操作日志</TabsTrigger>
        </TabsList>

        {/* 基本信息 */}
        <TabsContent value="info" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">工号</Label>
              <p className="text-sm font-medium mt-1">E001</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">姓名</Label>
              <p className="text-sm font-medium mt-1">张三</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">邮箱</Label>
              <p className="text-sm font-medium mt-1">zhang@company.com</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">手机号</Label>
              <p className="text-sm font-medium mt-1">138****8000</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">所属部门</Label>
              <p className="text-sm font-medium mt-1">研发部 / 前端组</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">直属上级</Label>
              <p className="text-sm font-medium mt-1">李四</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">入职日期</Label>
              <p className="text-sm font-medium mt-1">2023-06-15</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">用户状态</Label>
              <Badge variant="success" className="mt-1">正常</Badge>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">多因素认证 (MFA)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                已启用 · TOTP
              </p>
            </div>
            <Badge variant="success">已启用</Badge>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">最后登录</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                2026-05-08 14:30:25 · 来自 192.168.1.100
              </p>
            </div>
          </div>
        </TabsContent>

        {/* 角色权限 */}
        <TabsContent value="roles" className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">开发者</p>
                  <p className="text-xs text-muted-foreground">
                    可创建和管理 Agent、Skill
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm">移除</Button>
            </div>
          </div>

          <Button variant="outline" className="w-full gap-2">
            <Plus className="w-4 h-4" />
            添加角色
          </Button>
        </TabsContent>
      </Tabs>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 pt-4 border-t">
        <Button variant="outline" className="flex-1">编辑信息</Button>
        <Button variant="outline" className="flex-1">重置密码</Button>
        <Button variant="outline" className="flex-1 text-destructive">
          冻结账号
        </Button>
      </div>
    </div>
  </SheetContent>
</Sheet>
```

---

### 3. 角色权限管理页面

#### 3.1 页面布局

**布局结构**: 角色列表 + 权限矩阵

```tsx
<div className="space-y-6">
  {/* 页面标题 */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-xl font-semibold text-foreground">角色权限</h1>
      <p className="text-sm text-muted-foreground mt-0.5">
        管理企业角色和权限配置
      </p>
    </div>
    <Button className="gap-2">
      <Plus className="w-4 h-4" />
      创建角色
    </Button>
  </div>

  {/* Tab 切换 */}
  <Tabs defaultValue="system">
    <TabsList>
      <TabsTrigger value="system">系统角色 (9)</TabsTrigger>
      <TabsTrigger value="custom">自定义角色 (5)</TabsTrigger>
    </TabsList>

    <TabsContent value="system" className="space-y-4 mt-6">
      {/* 角色卡片网格 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 企业超级管理员 */}
        <Card className="relative">
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="text-xs">系统</Badge>
          </div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Crown className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-base">企业超级管理员</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  全部权限
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">用户数</span>
                <span className="font-medium">2 人</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">数据权限</span>
                <Badge variant="outline" className="text-xs">全部数据</Badge>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  查看详情
                </Button>
                <Button variant="ghost" size="sm">
                  <Users className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI 管理员 */}
        <Card>
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="text-xs">系统</Badge>
          </div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Bot className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">AI 管理员</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Agent、Skill 管理
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">用户数</span>
                <span className="font-medium">8 人</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">数据权限</span>
                <Badge variant="outline" className="text-xs">全部数据</Badge>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  查看详情
                </Button>
                <Button variant="ghost" size="sm">
                  <Users className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 开发者 */}
        <Card>
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="text-xs">系统</Badge>
          </div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Code className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-base">开发者</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  创建 Agent/Skill
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">用户数</span>
                <span className="font-medium">45 人</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">数据权限</span>
                <Badge variant="outline" className="text-xs">本部门</Badge>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  查看详情
                </Button>
                <Button variant="ghost" size="sm">
                  <Users className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>

    <TabsContent value="custom" className="space-y-4 mt-6">
      {/* 自定义角色列表 */}
    </TabsContent>
  </Tabs>

  {/* 权限矩阵 */}
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="text-base">权限矩阵</CardTitle>
        <Select defaultValue="developer">
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">企业超级管理员</SelectItem>
            <SelectItem value="ai-admin">AI 管理员</SelectItem>
            <SelectItem value="developer">开发者</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-48">功能模块</TableHead>
            <TableHead className="text-center w-24">查看</TableHead>
            <TableHead className="text-center w-24">创建</TableHead>
            <TableHead className="text-center w-24">编辑</TableHead>
            <TableHead className="text-center w-24">删除</TableHead>
            <TableHead className="text-center w-24">审批</TableHead>
            <TableHead className="text-center w-24">导出</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">Dashboard</TableCell>
            <TableCell className="text-center">
              <Checkbox checked disabled />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox disabled />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox disabled />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox disabled />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox disabled />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox checked disabled />
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell className="font-medium">Agent 管理</TableCell>
            <TableCell className="text-center">
              <Checkbox checked disabled />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox checked disabled />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox checked disabled />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox checked disabled />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox disabled />
            </TableCell>
            <TableCell className="text-center">
              <Checkbox checked disabled />
            </TableCell>
          </TableRow>

          {/* 更多行... */}
        </TableBody>
      </Table>

      <div className="mt-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">数据权限范围</p>
            <p className="text-muted-foreground mt-1">
              开发者角色的数据权限为"本部门"，只能查看和操作本部门创建的资源。
            </p>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</div>
```

---

### 4. 访问控制页面

#### 4.1 页面布局

**布局结构**: Tab 切换（SSO、MFA、会话管理、登录策略）

```tsx
<div className="space-y-6">
  {/* 页面标题 */}
  <div>
    <h1 className="text-xl font-semibold text-foreground">访问控制</h1>
    <p className="text-sm text-muted-foreground mt-0.5">
      配置企业登录安全策略
    </p>
  </div>

  <Tabs defaultValue="sso">
    <TabsList>
      <TabsTrigger value="sso">单点登录 (SSO)</TabsTrigger>
      <TabsTrigger value="mfa">多因素认证</TabsTrigger>
      <TabsTrigger value="session">会话管理</TabsTrigger>
      <TabsTrigger value="policy">登录策略</TabsTrigger>
    </TabsList>

    {/* SSO 配置 */}
    <TabsContent value="sso" className="space-y-4 mt-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">SSO 配置</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                配置企业单点登录
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">启用 SSO</span>
              <Switch />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>身份提供商 (IdP)</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择 IdP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="azure">Azure AD</SelectItem>
                  <SelectItem value="okta">Okta</SelectItem>
                  <SelectItem value="google">Google Workspace</SelectItem>
                  <SelectItem value="wechat">企业微信</SelectItem>
                  <SelectItem value="feishu">飞书</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>协议类型</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择协议" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="saml">SAML 2.0</SelectItem>
                  <SelectItem value="oauth">OAuth 2.0</SelectItem>
                  <SelectItem value="oidc">OIDC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>IdP 登录 URL</Label>
            <Input placeholder="https://login.microsoftonline.com/..." />
          </div>

          <div className="space-y-2">
            <Label>Entity ID</Label>
            <Input placeholder="https://your-company.com/saml" />
          </div>

          <div className="space-y-2">
            <Label>X.509 证书</Label>
            <Textarea
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              rows={6}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button>保存配置</Button>
            <Button variant="outline">测试连接</Button>
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    {/* MFA 配置 */}
    <TabsContent value="mfa" className="space-y-4 mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">多因素认证策略</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">企业级强制 MFA</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                所有用户必须启用多因素认证
              </p>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">管理员强制 MFA</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                所有管理员角色必须启用 MFA
              </p>
            </div>
            <Switch checked />
          </div>

          <Separator />

          <div>
            <Label className="text-base">支持的 MFA 方式</Label>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">短信验证码</p>
                    <p className="text-xs text-muted-foreground">
                      发送验证码到手机
                    </p>
                  </div>
                </div>
                <Switch checked />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">邮箱验证码</p>
                    <p className="text-xs text-muted-foreground">
                      发送验证码到邮箱
                    </p>
                  </div>
                </div>
                <Switch checked />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">TOTP (推荐)</p>
                    <p className="text-xs text-muted-foreground">
                      Google Authenticator、Microsoft Authenticator
                    </p>
                  </div>
                </div>
                <Switch checked />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    {/* 会话管理 */}
    <TabsContent value="session" className="space-y-4 mt-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">在线会话 (156)</CardTitle>
            <Button variant="outline" size="sm">
              批量登出
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>登录时间</TableHead>
                <TableHead>IP 地址</TableHead>
                <TableHead>设备</TableHead>
                <TableHead>会话时长</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-xs">张三</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">张三</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">14:30:25</TableCell>
                <TableCell className="text-sm font-mono">
                  192.168.1.100
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Monitor className="w-4 h-4" />
                    <span>Chrome · macOS</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">2 小时 15 分</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="text-destructive">
                    强制登出
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">会话策略</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>会话超时</Label>
              <Select defaultValue="2h">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30m">30 分钟</SelectItem>
                  <SelectItem value="1h">1 小时</SelectItem>
                  <SelectItem value="2h">2 小时</SelectItem>
                  <SelectItem value="4h">4 小时</SelectItem>
                  <SelectItem value="24h">24 小时</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>最大并发会话</Label>
              <Select defaultValue="3">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 个</SelectItem>
                  <SelectItem value="3">3 个</SelectItem>
                  <SelectItem value="5">5 个</SelectItem>
                  <SelectItem value="10">10 个</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
</div>
```

---

### 5. 资源配额管理页面

#### 5.1 页面布局

```tsx
<div className="space-y-6">
  {/* 页面标题 */}
  <div>
    <h1 className="text-xl font-semibold text-foreground">资源配额</h1>
    <p className="text-sm text-muted-foreground mt-0.5">
      管理企业和部门的资源配额
    </p>
  </div>

  {/* 企业总配额 */}
  <div className="grid grid-cols-4 gap-4">
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Token 配额
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">1.8M</span>
            <span className="text-sm text-muted-foreground">/ 2M</span>
          </div>
          <Progress value={90} className="h-2" />
          <p className="text-xs text-orange-600">
            ⚠️ 使用率 90%，即将耗尽
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          存储空间
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">45GB</span>
            <span className="text-sm text-muted-foreground">/ 100GB</span>
          </div>
          <Progress value={45} className="h-2" />
          <p className="text-xs text-muted-foreground">
            剩余 55GB
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Agent 数量
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">78</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <Progress value={78} className="h-2" />
          <p className="text-xs text-muted-foreground">
            剩余 22 个
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          用户数量
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">328</span>
            <span className="text-sm text-muted-foreground">/ 500</span>
          </div>
          <Progress value={65} className="h-2" />
          <p className="text-xs text-muted-foreground">
            剩余 172 个
          </p>
        </div>
      </CardContent>
    </Card>
  </div>

  {/* 使用趋势 */}
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Token 使用趋势</CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorToken" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="token"
            stroke="hsl(var(--primary))"
            fillOpacity={1}
            fill="url(#colorToken)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>

  {/* 部门配额列表 */}
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="text-base">部门配额分配</CardTitle>
        <Button variant="outline" size="sm">调整配额</Button>
      </div>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>部门</TableHead>
            <TableHead>Token 配额</TableHead>
            <TableHead>使用率</TableHead>
            <TableHead>存储空间</TableHead>
            <TableHead>Agent 数量</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">研发部</TableCell>
            <TableCell>
              <div className="space-y-1">
                <div className="text-sm">800K / 1M</div>
                <Progress value={80} className="h-1.5" />
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="warning">80%</Badge>
            </TableCell>
            <TableCell className="text-sm">20GB / 40GB</TableCell>
            <TableCell className="text-sm">35 / 50</TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm">调整</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>

  {/* 配额告警设置 */}
  <Card>
    <CardHeader>
      <CardTitle className="text-base">告警设置</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <p className="text-sm font-medium">80% 阈值告警</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            邮件通知部门管理员
          </p>
        </div>
        <Switch checked />
      </div>

      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <p className="text-sm font-medium">90% 阈值告警</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            邮件+站内信通知管理员
          </p>
        </div>
        <Switch checked />
      </div>

      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <p className="text-sm font-medium">100% 自动限流</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            配额耗尽后自动限制调用
          </p>
        </div>
        <Switch checked />
      </div>
    </CardContent>
  </Card>
</div>
```

---

### 6. 审计日志页面

#### 6.1 页面布局

```tsx
<div className="space-y-6">
  {/* 页面标题 */}
  <div>
    <h1 className="text-xl font-semibold text-foreground">审计日志</h1>
    <p className="text-sm text-muted-foreground mt-0.5">
      查看和导出操作审计日志
    </p>
  </div>

  {/* 筛选器 */}
  <Card>
    <CardContent className="pt-6">
      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">时间范围</Label>
          <Select defaultValue="7d">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">最近 1 天</SelectItem>
              <SelectItem value="7d">最近 7 天</SelectItem>
              <SelectItem value="30d">最近 30 天</SelectItem>
              <SelectItem value="custom">自定义</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">事件类型</Label>
          <Select defaultValue="all">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="login">用户登录</SelectItem>
              <SelectItem value="user">用户管理</SelectItem>
              <SelectItem value="role">角色权限</SelectItem>
              <SelectItem value="dept">部门管理</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">操作人</Label>
          <Input placeholder="搜索用户..." />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">操作结果</Label>
          <Select defaultValue="all">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="success">成功</SelectItem>
              <SelectItem value="failure">失败</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <Button>查询</Button>
        <Button variant="outline">重置</Button>
        <div className="flex-1" />
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          导出日志
        </Button>
      </div>
    </CardContent>
  </Card>

  {/* 日志列表 */}
  <Card>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-40">时间</TableHead>
          <TableHead>操作人</TableHead>
          <TableHead>事件类型</TableHead>
          <TableHead>操作对象</TableHead>
          <TableHead>IP 地址</TableHead>
          <TableHead>结果</TableHead>
          <TableHead className="text-right">详情</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="text-sm font-mono">
            2026-05-08 14:30:25
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-xs">张三</AvatarFallback>
              </Avatar>
              <span className="text-sm">张三</span>
            </div>
          </TableCell>
          <TableCell>
            <Badge variant="outline">用户创建</Badge>
          </TableCell>
          <TableCell className="text-sm">
            用户：李四 (E002)
          </TableCell>
          <TableCell className="text-sm font-mono">
            192.168.1.100
          </TableCell>
          <TableCell>
            <Badge variant="success">成功</Badge>
          </TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </TableCell>
        </TableRow>

        <TableRow>
          <TableCell className="text-sm font-mono">
            2026-05-08 14:25:10
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-xs">王五</AvatarFallback>
              </Avatar>
              <span className="text-sm">王五</span>
            </div>
          </TableCell>
          <TableCell>
            <Badge variant="outline">角色分配</Badge>
          </TableCell>
          <TableCell className="text-sm">
            用户：张三 → 角色：AI管理员
          </TableCell>
          <TableCell className="text-sm font-mono">
            192.168.1.105
          </TableCell>
          <TableCell>
            <Badge variant="success">成功</Badge>
          </TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    {/* 分页 */}
    <div className="flex items-center justify-between px-6 py-4 border-t">
      <div className="text-sm text-muted-foreground">
        共 1,234 条记录，显示第 1-20 条
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled>
          上一页
        </Button>
        <Button variant="outline" size="sm">
          下一页
        </Button>
      </div>
    </div>
  </Card>
</div>
```

---

## 📊 v0.dev 提示词模板

### 模板：组织架构管理页面

```
创建一个 LLMOps 平台的组织架构管理页面，使用 Next.js + TypeScript + Tailwind CSS + shadcn/ui。

布局要求：
- 左侧：部门树（30% 宽度）
  - 搜索框
  - 可折叠的树形结构
  - 显示部门图标和人数
  - 支持拖拽调整层级
  - 高亮当前选中部门

- 右侧：部门详情（70% 宽度）
  - 部门信息卡片（名称、编码、负责人、状态）
  - 4列统计卡片（Token消耗、存储、Agent数、成员数）
  - 部门成员表格

设计规范：
- 使用 OKLCH 色彩空间
- 圆角：8px (rounded-lg)
- 间距：24px (gap-6)
- 卡片阴影：shadow-sm
- 主色调：hsl(var(--primary))

组件：
- Card, CardHeader, CardTitle, CardContent
- Button, Input, Badge, Progress
- Table, Avatar, Select
- Tree (自定义组件)
- Icons: Building2, Folder, ChevronDown, Plus, Search

请生成完整的 TypeScript 代码。
```

---

## ✅ 设计检查清单

- [ ] 所有页面使用统一的设计系统
- [ ] 响应式布局（支持 1920px、1440px、1280px）
- [ ] 加载状态和骨架屏
- [ ] 错误状态和空状态
- [ ] 成功/失败提示（Toast）
- [ ] 确认对话框（危险操作）
- [ ] 表单验证和错误提示
- [ ] 无障碍支持（ARIA 标签）
- [ ] 键盘导航支持
- [ ] 暗色模式支持

---

**文档结束**







