在当前项目中，请生成"租户管理"页面。

## 页面信息
- 页面标题：租户管理
- 副标题：管理平台企业租户
- 布局：垂直堆叠 space-y-6

## 页面内容

### Header
- 左侧：标题"租户管理"（text-2xl font-semibold）+ 副标题
- 右侧：开通企业按钮（Plus 图标 + "开通企业"）

### 统计卡片（grid grid-cols-4 gap-4）
4 张 Card（p-5），每张含图标容器 + 数值 + 标签：
1. 总租户数（Building2, primary）：5
2. 活跃租户（Users, success）：4
3. 总成员数（Users, accent）：2,917
4. 月收入（DollarSign, warning）：¥6,130

### 搜索栏
- Input pl-9 h-9，placeholder="搜索企业名称或管理员邮箱..."

### 租户列表（Table 组件）

TableHeader 列：
- 企业名称
- 管理员邮箱
- 套餐
- 状态
- 成员数
- Agent 数
- Token 用量
- 月账单
- 操作

TableBody 每行：
- 企业名称：font-medium
- 管理员邮箱：text-muted-foreground
- 套餐 Badge：trial(bg-muted text-muted-foreground "试用版") / basic(bg-blue-500/10 text-blue-500 "基础版") / pro(bg-primary/10 text-primary "专业版") / enterprise(bg-green-500/10 text-green-500 "企业版")
- 状态 Badge：active(bg-green-500/10 text-green-500 "正常") / suspended(bg-destructive/10 text-destructive "已停用") / overdue(bg-yellow-500/10 text-yellow-500 "欠费")
- 成员数：数字
- Agent 数：数字
- Token 用量：数字显示（如 "8.45M / 10M"）+ Progress 组件（h-2, 百分比填充）
- 月账单：¥金额
- 操作：DropdownMenu（MoreHorizontal 触发）
  - 查看详情（Eye 图标）
  - 配置（Settings 图标）
  - Key 管理（Key 图标）
  - 分隔线
  - 暂停服务（Ban 图标, text-destructive）

## Mock 数据
5 个租户：
1. 示范科技有限公司（enterprise, active, 1245人, 6 Agent, 8.45M/10M, ¥2,890）
2. 创新金融集团（pro, active, 856人, 4 Agent, 5.23M/8M, ¥1,560）
3. 未来科技公司（basic, active, 234人, 2 Agent, 1.89M/3M, ¥450）
4. 智慧零售有限公司（pro, overdue, 567人, 3 Agent, 4.12M/5M, ¥1,230）
5. 测试企业（trial, active, 15人, 1 Agent, 0.045M/0.1M, ¥0）

## 样式要求
- Table 使用 shadcn/ui 的 Table 组件
- Progress 组件高度 h-2，颜色根据使用率变化（<70% 绿色，70-90% 黄色，>90% 红色）
- 行悬浮 hover:bg-muted/50
