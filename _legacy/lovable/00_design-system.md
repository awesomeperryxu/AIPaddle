你是一个前端开发专家。请基于以下设计系统规范，创建一个企业级 AI 管理平台的基础框架。

## 项目信息
- 产品名：AIPaddle（AI 业务赋能平台）
- 技术栈：React + TypeScript + Tailwind CSS + shadcn/ui + Lucide React 图标
- 默认主题：暗色模式

## 色彩系统（OKLCH）

在 globals.css 中定义以下 CSS 变量：

暗色模式（默认）：
- --background: oklch(0.1 0.01 250) — 深蓝黑背景
- --foreground: oklch(0.95 0.005 260) — 浅灰白文字
- --card: oklch(0.14 0.015 250) — 深灰蓝卡片
- --primary: oklch(0.65 0.2 250) — 亮蓝主色
- --accent: oklch(0.55 0.18 180) — 青色强调
- --muted: oklch(0.2 0.015 250) — 弱化背景
- --muted-foreground: oklch(0.6 0.01 260) — 弱化文字
- --border: oklch(0.25 0.015 250) — 深灰边框
- --destructive: oklch(0.55 0.22 25) — 红色
- --success: oklch(0.55 0.18 145) — 绿色
- --warning: oklch(0.65 0.18 80) — 黄色
- --sidebar: oklch(0.12 0.015 250) — 侧边栏更深
- --sidebar-accent: oklch(0.2 0.015 250)
- --sidebar-border: oklch(0.25 0.015 250)
- --sidebar-primary: oklch(0.65 0.2 250)
- --radius: 0.5rem

## 字体
- 主字体：Geist Sans
- 等宽字体：Geist Mono

## 全局布局

创建一个 flex h-screen 的布局：
- 左侧边栏（w-60, 240px）：始终深色背景 bg-sidebar
- 右侧内容区（flex-1）：顶部栏 h-12 + 可滚动内容区 p-5

## 侧边栏结构

从上到下：
1. Logo 区域（h-14）：8x8 rounded-lg 主色背景 + Zap 图标 + "AIPaddle" + "AI 业务赋能平台"
2. 租户选择器：下拉按钮，Building2 图标 + 租户名 + ChevronDown
3. 导航区域（可滚动）：7 个可折叠分组
   - 工作台：监控(LayoutDashboard)、个人助理(MessageSquare)
   - Agent：Agent 管理(Bot)、数字员工(Bot)
   - Skill：Skill Hub(Boxes)、我的 Skill(Zap)
   - 知识库：知识库管理(FileText)、知识库问答(Database)
   - 工作流：工作流管理(GitBranch)
   - 安全与管理：安全管理(Shield)、成员管理(Users)
   - 平台管理：运营看板(BarChart3)、租户管理(Building2)、Key管理(Key)、账单管理(CreditCard)
4. 用户区域（底部固定）：头像 + 姓名"陈雪" + 角色"企业管理员" + 下拉菜单

导航项样式：
- 分组标题：text-[11px] uppercase tracking-wider，可折叠（ChevronRight 旋转）
- 导航项：px-2.5 py-2 rounded-md text-[13px]
- 选中态：bg-sidebar-primary text-white shadow-sm
- 悬浮态：bg-sidebar-accent
- 角标：rounded-full text-[10px] bg-primary/10 text-primary

## 顶部栏

h-12 bg-card border-b px-5：
- 左侧：当前页面标题（text-sm font-medium）
- 右侧：搜索框(w-56 h-8) + 帮助按钮(HelpCircle) + 通知按钮(Bell + 红色数字角标)

## 要求

1. 先只生成这个基础框架（侧边栏 + 顶部栏 + 空内容区）
2. 侧边栏导航项可点击切换，高亮当前选中项
3. 分组可折叠展开
4. 不需要生成具体页面内容，内容区显示"选中的页面名称"即可
