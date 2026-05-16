在当前项目中，请生成"运营看板"页面。这是平台管理员查看整体 SaaS 运营数据的页面。

## 页面信息
- 页面标题：运营看板
- 副标题：平台整体运营数据概览
- 路径：点击侧边栏"平台管理 > 运营看板"

## 页面布局（垂直堆叠 space-y-6）

### Header
- 左侧：标题 + 副标题
- 右侧：时间范围选择器（Select：今日/本周/本月/本季度/自定义）+ 导出报告按钮(Download 图标)

### 核心指标卡片（grid grid-cols-5 gap-4）
5 张 Card（p-4），每张含：
- 指标名（text-xs text-muted-foreground uppercase tracking-wider）
- 数值（text-2xl font-bold mt-1）
- 趋势（text-xs，绿色向上或红色向下 + 百分比 + "vs 上月"）
- 底部迷你折线图（sparkline，高度 32px，无坐标轴）

5 张卡片：
1. 月活跃租户：4/5，+25%（Building2 图标）
2. 月活跃用户：2,847，+18.3%（Users 图标）
3. 月 Token 消耗：19.7M，+32.1%（Zap 图标）
4. 月收入：¥6,130，+15.6%（DollarSign 图标）
5. 平均响应时间：1.2s，-8.5%（Clock 图标，趋势向下为绿色=好）

### 收入趋势（Card，全宽）
- CardHeader：标题"收入趋势" + 切换按钮组（日/周/月）
- CardContent：AreaChart（Recharts），X 轴=时间，Y 轴=金额，蓝色渐变填充
- 显示近 12 个月数据

### 中间行（grid grid-cols-3 gap-4）

**左侧 Card - 租户健康度**：
- 标题"租户健康度"
- 环形图（3 段）：健康(绿,3) / 预警(黄,1) / 异常(红,1)
- 图例列表：每项含状态圆点 + 租户名 + 状态描述

**中间 Card - Token 消耗 Top 5**：
- 标题"Token 消耗排行"
- 水平柱状图（BarChart layout="vertical"）
- 5 个租户，按消耗量降序

**右侧 Card - 模型调用分布**：
- 标题"模型调用分布"
- PieChart（环形图）：GPT-4o / Claude-3.5 / DeepSeek / Qwen / 其他
- 图例含百分比

### 底部行（grid grid-cols-2 gap-4）

**左侧 Card - 近期告警**：
- 标题"近期告警" + 查看全部链接
- 告警列表（5 条），每条：
  - 严重度图标（红色AlertTriangle/黄色AlertCircle/蓝色Info）
  - 告警内容（text-sm）
  - 时间（text-xs text-muted-foreground）
  - 租户名 Badge

**右侧 Card - 系统资源**：
- 标题"系统资源使用"
- 3 个进度条组：
  - CPU 使用率：45%（绿色）
  - 内存使用率：72%（黄色）
  - 存储使用率：38%（绿色）
- 每个：标签 + 百分比 + Progress 组件（颜色根据阈值变化）

## Mock 数据
生成合理的运营数据，确保数字之间逻辑一致。
