# AIPaddle (AI 业务赋能平台) - Visily UX 设计文档

**文档版本**: 2.0  
**更新日期**: 2026-05-15  
**用途**: 提供给 Visily 生成高保真 UI 设计稿  
**设计风格**: 现代企业级 SaaS 后台，暗色主题为默认，shadcn/ui 风格  
**数据来源**: Dify 开源代码深度分析（547 个 TSX 文件）+ v0-ai-llmops-prototype 实际前端代码

---

## 一、设计系统（基于项目实际代码）

### 1.1 色彩体系（OKLCH 色彩空间）

**默认暗色模式**（项目默认启用 dark class）：
- 背景色：oklch(0.1 0.01 250) — 深蓝黑
- 卡片背景：oklch(0.14 0.015 250) — 深灰蓝
- 主色 Primary：oklch(0.65 0.2 250) — 亮蓝
- 强调色 Accent：oklch(0.55 0.18 180) — 青色
- 成功色 Success：oklch(0.55 0.18 145) — 绿色
- 警告色 Warning：oklch(0.65 0.18 80) — 黄色
- 危险色 Destructive：oklch(0.55 0.22 25) — 红色
- 文字主色：oklch(0.95 0.005 260) — 浅灰白
- 文字次要色：oklch(0.6 0.01 260) — 中灰
- 边框色：oklch(0.25 0.015 250) — 深灰
- 弱化背景 Muted：oklch(0.2 0.015 250)
- 侧边栏背景：oklch(0.12 0.015 250) — 更深的蓝黑
- 侧边栏强调：oklch(0.2 0.015 250)
- 侧边栏边框：oklch(0.25 0.015 250)

**浅色模式**：
- 背景色：oklch(0.98 0.002 260) — 浅灰白
- 卡片背景：oklch(1 0 0) — 纯白
- 主色 Primary：oklch(0.55 0.2 250) — 蓝色
- 侧边栏背景：oklch(0.16 0.02 250) — 深色（侧边栏始终深色）

**图表色板**：chart-1 蓝 / chart-2 青 / chart-3 黄 / chart-4 紫 / chart-5 橙

### 1.2 字体规范

- 字体族：**Geist**, Geist Mono（等宽）
- 页面标题：20px (text-xl), Semi-bold (font-semibold)
- 顶部栏标题：14px (text-sm), Medium (font-medium)
- 卡片标题：16px, Medium
- 正文：14px (text-sm), Regular
- 辅助文字：12px (text-xs), Regular
- 极小文字：10px (text-[10px])，用于角标和标签
- 数据大字：24px (text-2xl) 或 18px (text-lg), Semi-bold
- 侧边栏分组标题：11px (text-[11px]), uppercase, tracking-wider

### 1.3 间距与圆角

- 页面内边距：20px (p-5)
- 卡片内边距：20px (p-5) 或 12px (p-3)
- 卡片间距：16px (gap-4) 或 12px (gap-3)
- 组件间距：8px-12px
- 圆角 radius：8px (0.5rem) 为基准
  - radius-sm: 4px
  - radius-md: 6px
  - radius-lg: 8px（默认）
  - radius-xl: 12px
- 头像圆角：rounded-xl (12px)
- Logo 图标容器：rounded-lg (8px)

### 1.4 图标风格

Lucide React 图标库，线性风格：
- 侧边栏导航图标：16x16px (h-4 w-4)
- 卡片统计图标：20x20px (h-5 w-5)，放在 40x40px (w-10 h-10) 或 36x36px (w-9 h-9) 圆角容器中
- 按钮内图标：16x16px (h-4 w-4)
- 趋势小图标：12x12px (h-3 w-3)
- 状态圆点：6px (w-1.5 h-1.5 rounded-full)

---

## 二、全局布局（基于项目实际代码）

### 2.1 整体结构

整体容器：flex h-screen bg-background overflow-hidden
- 左侧边栏（w-60, 240px）：始终深色背景（bg-sidebar），右侧 1px 边框
- 右侧：flex-1 flex flex-col overflow-hidden
  - 顶部栏（h-12, 48px）：bg-card，底部 1px 边框
  - 内容区域：flex-1 overflow-auto p-5 bg-background

### 2.2 侧边栏（实际实现）

**Logo 区域（h-14, 56px，底部边框）**：
- 8x8px rounded-lg 主色背景容器 + Zap 图标（白色）
- 文字：标题 "AIPaddle"（text-sm font-semibold）+ 副标题 "AI 业务赋能平台"（text-[10px] 60%透明度）

**租户选择器（px-3 py-2.5，底部边框）**：
- 按钮：w-full, bg-sidebar-accent/50, rounded-md, px-2.5 py-2
- 内容：6x6 rounded 容器 + Building2 图标 + 租户名（text-xs font-medium）+ ChevronDown
- 下拉菜单：租户列表 + 租户设置入口

**导航区域（flex-1 overflow-y-auto py-2 px-2）**：
- 分组标题：text-[11px] font-medium uppercase tracking-wider，50%透明度
- 可折叠：ChevronRight 图标，展开时 rotate-90
- 导航项：px-2.5 py-2 rounded-md text-[13px]
- 选中态：bg-sidebar-primary text-sidebar-primary-foreground shadow-sm
- 悬浮态：bg-sidebar-accent text-sidebar-foreground
- 角标：rounded-full px-1.5 py-0.5 text-[10px]，bg-primary/10 text-primary

**导航分组**：
- 工作台：监控（LayoutDashboard）、个人助理（MessageSquare）
- Agent：Agent 管理（Bot, badge:6）、数字员工（Bot）
- Skill：Skill Hub（Boxes, badge:8）、我的 Skill（Zap）
- 知识库：知识库管理（FileText）、知识库问答（Database）
- 工作流：工作流管理（GitBranch）
- 安全与管理：安全管理（Shield, badge:3）、成员管理（Users）
- 平台管理：运营看板（BarChart3）、租户管理（Building2）、Key 管理（Key）、账单管理（CreditCard）

**用户区域（底部固定，p-3, border-t）**：
- Avatar h-8 w-8（bg-primary/20 text-primary 首字母）+ 姓名（text-sm）+ 角色（text-[11px] 60%透明度）+ ChevronDown
- 下拉菜单：主题切换（Sun/Moon）、系统设置、退出登录（text-destructive）

### 2.3 顶部栏（h-12, bg-card, px-5）

- 左侧：页面标题（text-sm font-medium text-foreground）
- 右侧：
  - 全局搜索：w-56 h-8 pl-8 bg-muted/30，Search 图标 h-3.5
  - 帮助按钮：ghost h-8 w-8，HelpCircle 图标，Tooltip
  - 通知按钮：ghost h-8 w-8，Bell 图标，红色角标（absolute -top-0.5 -right-0.5, h-4, bg-destructive, text-[10px]）

### 2.4 页面内容模式（实际实现）

**统计卡片模式**：
- Card bg-card border-border shadow-sm
- 大卡片（p-5）：左侧（指标名 text-sm text-muted-foreground + 数值 text-2xl font-semibold + 趋势 text-xs）+ 右侧（w-10 h-10 rounded-lg bg-{color}/10 + 图标 h-5 w-5）
- 小卡片（p-3）：左侧（w-9 h-9 rounded-lg bg-{color}/10 + 图标）+ 右侧（数值 text-lg + 标签 text-xs）

**列表项模式（Agent 等）**：
- Card cursor-pointer hover:shadow-md，选中时 ring-2 ring-primary
- 内容（p-4）：头像（w-11 h-11 rounded-xl bg-gradient-to-br）+ 名称+部门Badge+状态圆点 + 描述 line-clamp-1 + 指标行
- 操作：DropdownMenu（MoreHorizontal 触发）

**搜索+筛选模式**：
- 搜索框：relative, Search 图标 absolute left-3, Input pl-9 h-9 bg-card
- Tab 筛选：TabsList bg-muted/50 h-9, TabsTrigger text-xs px-3

**状态标签模式**：
- 圆点+文字：w-1.5 h-1.5 rounded-full bg-{color} + text-xs text-muted-foreground
- Badge 样式：bg-{color}/10 text-{color}（success/warning/destructive/muted）

---

## 三、页面设计（非 Workflow 模块，基于项目实际代码）

### 页面 1：监控面板

**路径**：/dashboard  
**布局**：垂直堆叠 space-y-6

- 区域 A - Header：左侧（标题"监控" text-xl font-semibold + 副标题 text-sm text-muted-foreground）+ 右侧（系统状态 Badge outline 带绿色脉冲圆点 + 时间范围按钮 "最近 7 天"）
- 区域 B - 主统计（grid grid-cols-4 gap-4）：4 张大卡片（p-5），每张含：
  - 左侧：指标名（text-sm text-muted-foreground）+ 数值（text-2xl font-semibold）+ 趋势（TrendingUp/Down h-3 w-3 + 百分比 text-xs + "vs 昨日"）
  - 右侧：w-10 h-10 rounded-lg bg-{color}/10 + 图标 h-5 w-5
  - 4 张分别为：今日调用量（Activity, primary）、Token 消耗（Zap, accent）、活跃 Agent（Bot, success）、待审核（Shield, warning）
- 区域 C - 图表（grid grid-cols-2 gap-4）：
  - 左侧：调用趋势 AreaChart（Recharts，渐变填充，CartesianGrid + XAxis + YAxis + Tooltip）
  - 右侧：Agent 分布 PieChart（环形图，4 色：primary/accent/chart-3/chart-4）

### 页面 2：Agent 管理

**路径**：/agents-admin  
**布局**：flex h-full gap-6，左侧列表 + 右侧详情

- 左侧列表区（flex-1，选中 Agent 时 max-w-2xl）：
  - Header：标题"Agent 管理" + 副标题 + 创建按钮（Button gap-2 shadow-sm + Plus 图标）
  - 统计卡片（grid grid-cols-4 gap-3 mb-5）：4 张小卡片（p-3），每张含 w-9 h-9 图标容器 + 数值 text-lg + 标签 text-xs
  - 搜索+Tab（flex gap-3 mb-4）：搜索框（pl-9 h-9）+ TabsList（bg-muted/50 h-9，全部/已发布/待审核/草稿）
  - Agent 列表（space-y-2，可滚动）：每项为 Card，hover:shadow-md，选中 ring-2 ring-primary
    - 内容（p-4 flex gap-3）：头像（w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20，emoji）+ 信息区
    - 信息区：名称（font-medium）+ 部门 Badge（outline text-[10px]）+ 状态圆点+文字（ml-auto）
    - 描述：text-sm text-muted-foreground line-clamp-1
    - 指标行：text-xs text-muted-foreground gap-4（模型名 + 调用数 + 成功率）
    - 操作：DropdownMenu（配置/复制/启动/暂停/删除）

- 右侧详情面板（选中 Agent 后显示，w-96）：
  - Agent 信息头 + 使用场景卡片（本地CC/企微/Web/API，每个带图标+颜色）
  - 关联 Skill 列表 + 关联知识库 + 性能指标

### 页面 3：数字员工

**路径**：/agents  
**布局**：左右分栏（对话界面）

### 页面 4：Skill Hub

**路径**：/skill-hub  
**布局**：flex h-full gap-6，左侧列表 + 右侧详情

- 类型配置色彩：MCP=蓝(Globe) / API=绿(Zap) / DB=橙(Database) / Workflow=紫(GitBranch) / Prompt=粉(MessageSquare)
- 风险等级：低=green-500/10 / 中=yellow-500/10 / 高=destructive/10
- Skill 卡片：类型图标容器 + 名称 + 描述 + 发布者 + 安装量 + 评分星级 + 风险标签

### 页面 5：知识库

**路径**：/knowledge-admin  
**布局**：垂直堆叠

### 页面 7：个人助理

**路径**：/assistant  
**布局**：左右分栏（对话界面）

### 页面 8：安全审核

**路径**：/security  
**布局**：垂直堆叠

### 页面 9：成员管理

**路径**：/members  
**布局**：垂直堆叠

### 页面 10：租户管理

**路径**：/tenants  
**布局**：垂直堆叠 space-y-6

- Header：标题"租户管理" text-2xl + 副标题 + 开通企业按钮
- 统计卡片（grid grid-cols-4 gap-4）
- 租户表格（Table 组件）：
  - 列：企业名称 + 管理员邮箱 + 套餐标签（trial=灰/basic=蓝/pro=primary/enterprise=绿）+ 状态（active=绿/suspended=红/overdue=黄）+ 成员数 + Agent 数 + Token 用量（Progress 进度条）+ 月账单 + 操作
  - 操作 DropdownMenu：查看详情(Eye) / 配置(Settings) / Key 管理(Key) / 暂停服务(Ban)
- Token 用量显示：数字 + "/" + 配额 + 百分比，Progress 组件

### 页面 11：租户内部管理

**路径**：/tenant/manage  
**布局**：左侧子导航 + 右侧内容

---

## 四、Workflow/Chatflow 编辑器页面（核心）

> 以下为基于 Dify 源码 547 个 TSX 文件全量提取的交互设计。
> 工作流模块分为两个层级：列表页（应用管理）和编辑器页（画布编辑）。

### 页面 6a：工作流列表页（应用管理入口）

**路径**：/workflows  
**布局**：垂直堆叠 space-y-6

**Header**：
- 左侧：标题"工作流管理" text-xl font-semibold + 副标题
- 右侧：创建应用按钮（Dialog 触发）

**应用类型筛选（Tab 或按钮组）**：
- 全部 / 工作流(GitBranch, 蓝) / Chatflow(MessageSquare, 绿) / Agent(Bot, 紫) / 文本生成(FileText, 橙)
- 每种类型有独立图标和颜色标识

**搜索栏**：Input pl-9 h-9 + Search 图标

**应用卡片列表（grid 或 list）**：
每张应用卡片包含：
- 左侧：类型图标容器（bg-{color}/10 + 图标 text-{color}）
- 中间：应用名称（font-medium）+ 描述（text-sm text-muted-foreground line-clamp-1）+ 标签（Badge outline text-xs）
- 右侧上：状态标签（草稿=muted / 已发布=green-500/10 / 已下线=destructive/10）
- 右侧下：最后编辑人 + 时间 + 执行次数 + 成功率
- 操作：DropdownMenu（编辑/复制/删除）
- 点击卡片 → 进入编辑器页面

**创建应用 Dialog（480px）**：
- 应用名称输入
- 应用类型选择（4 种类型卡片，带图标和描述）
- 描述输入（Textarea）
- 标签输入
- 创建按钮

**应用类型色彩配置（实际代码）**：
- workflow：蓝色 (GitBranch)
- chatflow：绿色 (MessageSquare)
- agent：紫色 (Bot)
- text-generation：橙色 (FileText)

### 页面 6b：Workflow/Chatflow 编辑器

### 页面 6：Workflow/Chatflow 编辑器主页面

**路径**：/workflow/:id  
**布局**：全屏画布，无主侧边栏导航

<!-- PLACEHOLDER_WORKFLOW_UX -->

#### 4.1 整体布局

全屏画布页面，分为 5 个区域：

**A - 顶部工具栏（56px 高，白色背景，底部 1px 边框）**：
- 左侧：返回箭头 | 工作流图标 + 名称（可编辑，点击进入编辑态）| 类型标签（Workflow/Chatflow）| 在线用户头像列表（最多显示 5 个，多余 +N）
- 右侧：环境变量按钮 | 全局变量按钮 | 会话变量按钮（仅 Chatflow）| 版本历史按钮 | 检查清单按钮（带警告数字角标）| 运行/预览按钮组 | 更多操作（三点菜单）

**B - 画布主体（占满剩余空间）**：
- 背景：浅灰色点状网格（点间距 20px，点大小 1px）
- 节点：圆角矩形卡片（宽度 240px），白色背景，1px 边框
- 连线：贝塞尔曲线，灰色，箭头指向目标
- 选中节点：蓝色边框 + 浅蓝色阴影
- 多选框选：蓝色虚线矩形

**C - 右侧配置面板（380px 宽，白色背景，左侧 1px 边框）**：
- 点击节点后从右侧滑出
- 顶部：节点图标 + 名称（可编辑）+ 关闭按钮
- 内容区：根据节点类型显示不同配置表单

**D - 底部操作栏（固定底部左侧，浮动圆角工具条）**：
- 白色背景，圆角 8px，阴影
- 按钮组：添加节点 | 指针模式 | 手型模式 | 评论模式 | 添加便签 | 自动整理 | 全屏切换 | 更多操作
- 右侧独立组：缩放百分比 + 放大/缩小 + 适应画布 + MiniMap 开关

**E - 浮动面板（按需显示）**：
- Block Selector（节点添加面板）
- 运行调试面板（底部抽屉）
- 变量检查面板（底部抽屉）
- 版本历史面板（右侧面板）
- 评论面板（右侧面板）

---

#### 4.2 节点卡片视觉规范

每个节点卡片（240px 宽）包含：
- 顶部色条（4px 高，颜色按类型区分）：
  - 触发器：绿色 #22C55E
  - AI 节点：蓝色 #4F6BED
  - 逻辑控制：橙色 #F59E0B
  - 数据处理：紫色 #8B5CF6
  - 集成：青色 #06B6D4
  - 输出：灰色 #6B7280
- 内容区（padding 12px）：左侧图标（24x24px）+ 节点标题（14px Medium）+ 节点类型小字（12px 灰色）
- 左侧：输入连接点（8px 圆点，灰色，悬浮变蓝）
- 右侧：输出连接点（8px 圆点，灰色，悬浮变蓝）
- 右上角：运行状态指示（8px 圆点：绿色=成功，红色=失败，蓝色脉冲动画=运行中，黄色=等待）
- 悬浮：阴影加深 + 显示操作按钮（运行、更多）

**容器节点（Iteration/Loop）**：
- 更大的矩形区域，内部可放置子节点
- 虚线边框，浅色背景填充
- 顶部标题栏 + 折叠/展开按钮

---

#### 4.3 节点配置面板（右侧 380px）

**通用结构**：
- 顶部固定：节点图标 + 标题输入框 + 描述输入框 + 关闭按钮（X）
- 中间可滚动：配置表单（根据节点类型不同）
- 底部固定：错误处理配置 + 重试配置

**LLM 节点配置面板**：
- 模型选择器：Provider 下拉 + Model 下拉 + 参数设置按钮
- Prompt 编辑区：角色 Tab（System/User/Assistant）+ 富文本编辑器（支持变量插入 {{variable}}）
- Jinja2 切换开关
- Memory 配置折叠区：启用开关 + 窗口大小 + 角色前缀 + 查询模板
- Context 配置：启用开关 + 变量选择器
- Vision 配置：启用开关 + 分辨率选择（low/high/auto）
- 结构化输出：启用开关 + JSON Schema 编辑器（树形结构，支持添加字段/类型/描述）
- 推理格式：Radio（tagged / separated）
- 输出变量列表（只读展示）

**Agent 节点配置面板**：
- 策略选择器：Provider 下拉 + Strategy 下拉
- 参数表单：动态渲染（根据策略定义）
- Memory 配置：启用开关 + 历史消息窗口
- 输出 Schema 编辑器
- 插件版本选择器

**HTTP 节点配置面板**：
- 方法选择器（GET/POST/PUT/DELETE/PATCH/HEAD）+ URL 输入框（支持变量）
- Tab 切换：Params / Headers / Body / Authorization / Settings
- Params Tab：Key-Value 编辑器（可添加行，支持变量）
- Headers Tab：同 Params
- Body Tab：类型选择（none/form-data/x-www-form-urlencoded/raw-text/json/binary）+ 对应编辑器
- Authorization Tab：类型选择（None/API Key）+ 配置表单
- Settings Tab：超时配置（connect/read/write 三个数字输入）+ SSL 验证开关
- CURL 导入按钮：打开弹窗，粘贴 CURL 命令自动解析

**If-Else 节点配置面板**：
- 条件列表（可添加多个 Case）
- 每个 Case：逻辑运算符切换（AND/OR）+ 条件行列表
- 每个条件行：变量选择器 + 比较运算符下拉 + 值输入
- ELSE 分支（默认存在）
- 添加 ELIF 按钮

**Iteration 节点配置面板**：
- 输入变量选择器（数组类型）
- 并行模式开关 + 并发数滑块（1-10）
- 错误处理选择：terminated / continue-on-error / remove-abnormal-output
- 输出扁平化开关
- 输出变量选择器

**Knowledge Retrieval 节点配置面板**：
- 查询变量选择器
- 知识库列表（可添加多个）+ 添加知识库按钮
- 检索模式选择：单路检索 / 多路检索
- 多路检索配置：Top-K 滑块 + Score 阈值 + Reranking 模型选择 + 权重配置
- 元数据过滤：模式选择（disabled/automatic/manual）+ 条件编辑器

**Human-Input 节点配置面板**：
- 投递方式选择（WebApp/Email/Slack/Teams/Discord）
- Email 配置区：收件人（成员选择/外部邮箱）+ 主题 + 正文模板
- 操作按钮编辑器：按钮列表（名称+样式+值），可添加/删除/排序
- 表单输入项编辑器：字段列表（名称+类型+必填+默认值）
- 超时设置：数字输入 + 单位选择（小时/天）

---

#### 4.4 运行调试面板（底部抽屉，高度 40% 屏幕）

**触发方式**：点击运行按钮后自动展开

**顶部栏**：
- 左侧：运行状态标签（Running=蓝色动画/Succeeded=绿色/Failed=红色/Stopped=灰色）+ 耗时
- 右侧：折叠/展开按钮 + 关闭按钮

**Tab 切换**：RESULT / DETAIL / TRACING

**RESULT Tab**：
- 输出变量列表：变量名 + 类型标签 + 值（文本/JSON 格式化展示）
- 大数据告警提示（数据过大时）

**DETAIL Tab**：
- 执行信息卡片：总耗时、Token 消耗（input/output）、执行状态、触发方式
- 节点执行列表：每个节点一行（图标+名称+状态+耗时）

**TRACING Tab**：
- 节点执行时间线（甘特图样式）：每个节点一条横条，长度表示耗时
- 点击节点展开详情：输入/输出变量值、错误信息
- 特殊日志展开：
  - Agent 日志：思考过程 + 工具调用记录
  - 迭代日志：每次迭代的输入/输出
  - 循环日志：每次循环的变量值变化
  - 重试日志：每次重试的错误和结果

---

#### 4.5 Chatflow 调试与预览面板（右侧，宽度 400px，可拖拽调整）

**触发方式**：Chatflow 模式下点击"预览"按钮

**顶部栏**：
- 标题"调试预览" + 重启对话按钮 + 会话变量按钮 + 关闭按钮

**对话区域**：
- 消息气泡列表（用户=右对齐蓝色，AI=左对齐灰色）
- 流式输出动画（打字机效果）
- 引用来源折叠展示

**底部输入区**：
- 多行输入框 + 发送按钮
- 文件上传按钮（如果启用）

**会话变量弹窗**：
- 变量列表（名称+类型+当前值）
- 可编辑变量值用于调试

---

#### 4.6 变量检查面板（底部抽屉，可拖拽调整高度）

**触发方式**：运行时自动显示，或点击底部工具栏的变量检查按钮

**布局**：左右分栏
- 左侧（200px）：变量分组列表（按节点分组），每个变量显示名称+类型标签
- 右侧：选中变量的值内容
  - 顶部：变量路径 + 视图切换（Code/Preview）
  - Code 视图：JSON 格式化展示
  - Preview 视图：Markdown 渲染 / Chunks 列表
  - 大数据告警（超过阈值时显示警告）
  - 监听状态指示（实时更新动画）

---

#### 4.7 环境变量面板（右侧面板，宽度 360px）

**触发方式**：点击 Header 的环境变量按钮

**布局**：
- 顶部：标题"环境变量" + 添加变量按钮 + 关闭按钮
- 变量列表：每行显示名称 + 类型标签（string=蓝/number=绿/secret=红）+ 值（secret 显示 ****）+ 编辑/删除按钮

**变量编辑弹窗（Dialog 400px）**：
- 变量名输入框
- 类型选择（string/number/secret）
- 值输入框（secret 类型为密码输入）
- 描述输入框
- 保存/取消按钮

---

#### 4.8 会话变量面板（右侧面板，宽度 360px，仅 Chatflow）

**触发方式**：点击 Header 的会话变量按钮

**布局**：
- 顶部：标题"会话变量" + 添加变量按钮 + 关闭按钮
- 变量列表：名称 + 类型标签 + 默认值 + 编辑/删除按钮
- 类型：Number/String/Boolean/Object/Array[String]/Array[Number]/Array[Boolean]/Array[Object]

---

#### 4.9 全局变量面板（右侧面板，宽度 360px）

**触发方式**：点击 Header 的全局变量按钮

**布局**：同环境变量面板结构
- 变量类型：string/number/integer

---

#### 4.10 版本历史面板（右侧面板，宽度 360px）

**触发方式**：点击 Header 的版本历史按钮，或快捷键 ⌘⇧H

**布局**：
- 顶部：标题"版本历史" + 筛选器（全部/已发布/草稿）+ 关闭按钮
- 版本列表：每项显示版本号 + 时间 + 操作人 + 状态标签（Published=绿/Draft=灰）
- 每项操作菜单（三点）：恢复此版本、删除、查看详情
- 恢复确认弹窗：警告文字 + 确认/取消按钮
- 空状态：无历史版本提示

**Header 切换为 ViewHistory 模式**：
- 显示"正在查看历史版本"提示条
- 画布变为只读
- 操作按钮：恢复此版本 / 返回编辑

---

#### 4.11 Block Selector（节点选择器，浮动面板）

**触发方式**：点击底部工具栏"添加节点"按钮，或从连接点拖出，或画布右键"添加节点"

**布局（宽度 320px，最大高度 480px，白色背景，圆角 12px，阴影）**：
- 顶部：搜索框（带搜索图标）
- Tab 切换：Start（触发器）/ Blocks（节点）/ Tools（工具）/ Sources（数据源）

**Blocks Tab**：
- 分类标题（灰色小字）：问题理解 / 逻辑控制 / 数据转换 / 工具
- 每个节点项：左侧彩色图标 + 名称 + 右侧简短描述
- 悬浮高亮

**Tools Tab**：
- 工具类型筛选：All / BuiltIn / Custom / Workflow / MCP
- 精选工具区域
- 工具列表：图标 + 名称 + 来源标签
- 底部：插件市场入口链接

**Sources Tab**：
- 数据源列表
- RAG 工具推荐区域

---

#### 4.12 右键菜单

**画布右键菜单（空白区域）**：
- 添加节点 → 打开 Block Selector
- 粘贴节点
- 分隔线
- 运行工作流 / 调试预览（Chatflow）
- 分隔线
- 添加便签
- 添加评论
- 分隔线
- 导出 DSL
- 导入 DSL

**节点右键菜单**：
- 运行此步骤（带快捷键提示）
- 更换节点类型 → 子菜单（可选节点类型列表）
- 分隔线
- 复制（⌘C）
- 复制副本（⌘D）
- 删除（Delete）
- 分隔线
- 打开关联应用（如果有）
- 帮助文档

**连线右键菜单**：
- 删除连线

**多选右键菜单**：
- 对齐：上对齐 / 垂直居中 / 下对齐 / 左对齐 / 水平居中 / 右对齐
- 分布：水平均分 / 垂直均分

---

#### 4.13 评论系统

**评论模式**（底部工具栏切换到评论模式后）：
- 光标变为评论图标样式
- 点击画布任意位置放置评论

**评论图标（画布上）**：
- 小圆形图标（24px），带用户头像
- 悬浮显示评论预览（气泡，最多 2 行文字）
- 点击展开完整评论线程

**评论线程（浮动面板，宽度 320px）**：
- 顶部：评论者头像 + 姓名 + 时间 + 解决按钮 + 关闭按钮
- 评论内容（支持 @提及，高亮显示）
- 回复列表
- 底部：回复输入框（支持 @提及自动补全）+ 发送按钮
- 每条评论/回复：悬浮显示编辑/删除按钮

**评论面板（右侧面板，宽度 320px）**：
- 所有评论的列表视图
- 筛选：全部 / 未解决 / 已解决
- 每项：评论者 + 内容预览 + 时间 + 回复数
- 点击跳转到画布上对应位置

---

#### 4.14 便签节点

**视觉**：
- 矩形区域，无连接点
- 背景色根据主题：blue/cyan/green/yellow/pink/violet（半透明）
- 可拖拽调整大小（右下角拖拽手柄）
- 双击进入编辑模式

**编辑模式**：
- 顶部工具栏：字体大小下拉 | 颜色选择器 | 加粗/斜体/下划线 | 链接插入 | 主题色切换
- 富文本编辑区域（基于 Lexical）
- 点击外部退出编辑

---

#### 4.15 DSL 导入/导出弹窗

**导出确认弹窗（Dialog 480px）**：
- 标题"导出工作流"
- 警告提示：包含 Secret 类型环境变量
- Checkbox：是否导出密钥值
- 导出/取消按钮

**导入弹窗（Dialog 480px）**：
- 标题"导入工作流"
- 文件上传区域（拖拽或点击选择 .yml/.yaml 文件）
- 验证状态显示（成功/失败+错误信息）
- 备份当前版本 Checkbox
- 插件依赖检测结果（如有缺失插件，显示列表+安装按钮）
- 确认导入/取消按钮

**同步数据弹窗**：
- 居中加载动画 + "正在同步数据..." 文字
- 不可关闭，自动消失

---

#### 4.16 检查清单弹窗

**触发方式**：点击 Header 的检查清单按钮（带警告数字角标）

**布局（Popover，宽度 360px）**：
- 标题"检查清单" + 问题总数
- 分组列表：
  - 插件缺失项（红色图标）：插件名称 + 安装按钮
  - 节点配置问题（黄色图标）：节点名称 + 问题描述 + 点击跳转
- 全部通过时：绿色勾 + "所有检查通过"

---

#### 4.17 测试运行菜单

**触发方式**：点击运行按钮旁的下拉箭头，或快捷键 ⌥R

**布局（DropdownMenu）**：
- 触发类型选择：
  - 用户输入（默认）
  - 定时触发
  - Webhook 触发
  - 插件触发
  - 全部触发器
- 分隔线
- 运行按钮

**运行中状态**：
- 运行按钮变为红色"停止"按钮
- Header 显示"运行中..."标题 + 耗时计时器

---

#### 4.18 协作功能 UI

**在线用户头像列表（Header 左侧）**：
- 最多显示 5 个圆形头像（24px），重叠排列
- 超过 5 个显示 "+N" 数字
- 每个头像带颜色边框（用户标识色）
- 点击用户头像：画布平移到该用户光标位置

**用户光标（画布上）**：
- 彩色箭头光标 + 用户名标签（小字，圆角背景）
- 实时跟随其他用户鼠标移动
- 可通过底部工具栏缩放菜单中的开关隐藏

**节点面板占用提示**：
- 当其他用户正在编辑某节点时，该节点显示用户头像 + "正在编辑"提示
- 配置面板顶部显示"[用户名] 正在编辑此节点"横幅

---

#### 4.19 操作工具栏详细布局

**位置**：画布底部左侧，距底部 16px，距左侧 16px

**主工具条（白色背景，圆角 8px，阴影，高度 40px）**：
- 按钮组 1：添加节点（+图标）| 指针模式（箭头图标，选中态蓝色）| 手型模式（手图标）| 评论模式（评论图标）
- 分隔线
- 按钮组 2：添加便签 | 自动整理 | 全屏切换
- 分隔线
- 更多操作（三点菜单）→ 导出图片子菜单

**缩放工具条（独立，在主工具条右侧）**：
- 缩小按钮 | 缩放百分比（点击展开预设级别：25%/50%/75%/100%/200%）| 放大按钮 | 适应画布按钮
- 下方切换项：MiniMap 开关 | 光标显示开关 | 评论显示开关

---

#### 4.20 工作流预览模式（只读）

**触发方式**：从外部页面查看已发布的工作流

**与编辑模式的区别**：
- Header 显示"预览模式"标签，无编辑按钮
- 画布只读，不可拖拽/添加/删除节点
- 无右侧配置面板
- 底部工具栏仅保留缩放控件
- 节点显示错误处理状态标记（如果有配置）

---

#### 4.21 Chatflow 功能面板（Features）

**触发方式**：Chatflow 模式下，Header 中的"功能"按钮

**布局（右侧面板，宽度 360px）**：
- 功能开关列表：
  - 开场白：开关 + 文本编辑器 + 建议问题列表编辑
  - 回答后建议问题：开关
  - 文字转语音：开关 + 语音模型选择
  - 语音转文字：开关
  - 引用来源：开关
  - 文件上传：开关 + 文件类型/大小限制配置
  - 敏感词审查：开关 + 审查规则配置

---

## 五、通用组件规范

### 5.1 按钮

| 类型 | 视觉描述 |
|------|---------|
| 主按钮 | 蓝色实心背景，白色文字，圆角 8px，高度 36px，悬浮加深 |
| 次要按钮 | 白色背景，灰色边框，深色文字，悬浮浅灰背景 |
| 危险按钮 | 红色实心背景，白色文字 |
| 幽灵按钮 | 无背景无边框，悬浮浅灰背景 |
| 图标按钮 | 正方形 36x36px，仅图标，悬浮浅灰背景 |

### 5.2 表单控件

| 控件 | 视觉描述 |
|------|---------|
| 文本输入框 | 高度 36px，圆角 6px，1px 灰色边框，聚焦蓝色边框 |
| 下拉选择 | 同输入框样式，右侧 ChevronDown 图标 |
| 开关 Switch | 宽度 40px，高度 20px，开启蓝色，关闭灰色 |
| 复选框 | 16x16px，圆角 4px，选中蓝色背景+白色勾 |
| 滑块 | 蓝色轨道，白色圆形手柄，显示当前值 |
| 代码编辑器 | 深色背景，等宽字体，语法高亮，行号 |

### 5.3 数据展示

| 组件 | 视觉描述 |
|------|---------|
| 表格 | 白色背景，表头灰色背景，行高 48px，悬浮行浅灰，1px 行分隔线 |
| 卡片 | 白色背景，1px 边框，圆角 8px，浅阴影，内边距 20px |
| 标签 Badge | 圆角 9999px，高度 22px，内边距 4px 8px，12px 字体 |
| 进度条 | 高度 8px，圆角 4px，灰色轨道，彩色填充 |

### 5.4 反馈组件

| 组件 | 视觉描述 |
|------|---------|
| Dialog 弹窗 | 居中，白色背景，圆角 12px，阴影，半透明黑色遮罩 |
| Drawer 抽屉 | 从右侧滑出，宽度 480-720px，白色背景 |
| Toast 提示 | 右上角弹出，圆角 8px，阴影，3 秒自动消失 |
| Popover | 锚定触发元素，白色背景，圆角 8px，阴影 |
| 空状态 | 居中灰色插图 + 描述文字 + 操作按钮 |
| 骨架屏 | 灰色矩形闪烁动画，模拟内容布局 |

---

## 六、状态与交互说明

### 6.1 加载状态
- 页面首次加载：骨架屏
- 按钮加载：Spinner + "处理中..."，按钮禁用
- 面板加载：居中 Spinner

### 6.2 空状态
- 列表为空：灰色插图 + "暂无数据" + 创建按钮
- 搜索无结果：搜索图标 + "未找到匹配结果" + 清除筛选

### 6.3 错误状态
- 表单验证：红色边框 + 红色错误提示文字
- 操作失败：红色 Toast
- 节点配置错误：节点卡片右上角红色警告图标

### 6.4 运行状态（Workflow 专属）
- NotStart：灰色圆点
- Waiting：黄色圆点
- Running：蓝色脉冲动画圆点
- Succeeded：绿色圆点 + 绿色边框
- Failed：红色圆点 + 红色边框
- Exception：橙色三角警告
- Retry：黄色循环箭头
- Stopped：灰色方块
- Paused：黄色暂停图标
- Listening：蓝色耳机图标（等待外部输入）

---

**文档结束**

*本文档基于 Dify 开源代码 547 个 TSX 文件全量分析，覆盖 Workflow/Chatflow 模块的全部 18 个功能类别、33 种节点类型、11 个面板、4 种右键菜单、21 个快捷键。与 PRD v2.0 完全同步。*
