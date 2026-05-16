在当前项目中，请生成"账单管理"页面。这是平台管理员查看和管理所有租户账单的页面。

## 页面信息
- 页面标题：账单管理
- 副标题：管理平台收入和租户账单
- 路径：点击侧边栏"平台管理 > 账单管理"

## 页面布局（垂直堆叠 space-y-6）

### Header
- 左侧：标题 + 副标题
- 右侧：导出账单按钮(Download 图标 + "导出") + 生成月度报告按钮(FileText 图标)

### 统计卡片（grid grid-cols-4 gap-4）
4 张 Card（p-5），每张含图标容器 + 数值 + 标签 + 趋势：
1. 本月收入（DollarSign, primary）：¥6,130，+15.6%
2. 待收款（Clock, warning）：¥1,230
3. 已逾期（AlertTriangle, destructive）：¥1,230（1 笔）
4. 累计收入（TrendingUp, success）：¥45,890

### 收入趋势图（Card，全宽）
- CardHeader：标题"月度收入趋势" + 年份切换（2025/2026）
- CardContent：BarChart（Recharts），X 轴=月份，Y 轴=金额，蓝色柱状
- 显示近 12 个月数据

### 筛选栏（flex gap-3）
- 租户筛选 Select（全部租户 / 各租户名）
- 状态筛选 Select（全部 / 已支付 / 未支付 / 已逾期 / 已作废）
- 时间范围 Select（本月 / 上月 / 近3月 / 近6月 / 自定义）
- 搜索框（Input pl-9 h-9，搜索账单编号）

### 账单列表（Table 组件）

TableHeader 列：
- 账单编号
- 租户名称
- 账单周期
- Token 消耗
- 账单金额
- 状态
- 创建时间
- 支付时间
- 操作

TableBody 每行：
- 账单编号：font-mono text-xs（如 "INV-2026-05-001"）
- 租户名称：font-medium
- 账单周期：text-sm（如 "2026-04-01 ~ 2026-04-30"）
- Token 消耗：数字 + "M"（如 "8.45M"）
- 账单金额：font-semibold（如 "¥2,890"）
- 状态 Badge：
  - paid: bg-green-500/10 text-green-500 "已支付"
  - unpaid: bg-yellow-500/10 text-yellow-500 "未支付"
  - overdue: bg-destructive/10 text-destructive "已逾期"
  - void: bg-muted text-muted-foreground "已作废"
- 创建时间：日期
- 支付时间：日期或 "—"
- 操作 DropdownMenu：
  - 查看详情（Eye）
  - 下载 PDF（Download）
  - 标记已支付（CheckCircle，仅 unpaid/overdue 显示）
  - 发送催款通知（Send，仅 overdue 显示）
  - 分隔线
  - 作废（XCircle, text-destructive，仅 unpaid 显示）

### 账单详情 Dialog（DialogContent 宽度 600px）
- 标题"账单详情" + 账单编号
- 基本信息区：租户名 / 账单周期 / 状态 / 创建时间 / 支付时间
- 消费明细 Table：
  - 列：项目 / 模型 / 调用次数 / Token 消耗 / 单价 / 小计
  - 底部合计行：font-semibold
- 底部操作：下载 PDF + 标记已支付（如适用）

## Mock 数据
生成 10 条账单记录，覆盖不同租户和状态。
