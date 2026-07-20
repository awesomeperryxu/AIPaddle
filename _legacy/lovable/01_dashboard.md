在当前项目中，请生成"监控"页面的完整内容。

## 页面信息
- 页面标题：监控
- 副标题：企业 AI 使用情况实时监控
- 路径：点击侧边栏"监控"导航项时显示

## 页面布局（垂直堆叠，space-y-6）

### Header 区域
- 左侧：标题"监控"（text-xl font-semibold）+ 副标题（text-sm text-muted-foreground）
- 右侧：系统状态 Badge（outline 样式，内含绿色脉冲圆点 animate-pulse + "系统正常"）+ 时间范围按钮（outline, "最近 7 天", Clock 图标）

### 主统计卡片（grid grid-cols-4 gap-4）
4 张 Card（bg-card border-border shadow-sm），每张 p-5：
- 左侧：指标名（text-sm text-muted-foreground）+ 数值（text-2xl font-semibold mt-1）+ 趋势行（TrendingUp h-3 w-3 text-green-500 + 百分比 + "vs 昨日"）
- 右侧：w-10 h-10 rounded-lg bg-{color}/10 + 图标 h-5 w-5

4 张卡片数据：
1. 今日调用量：12,458，+12.5%，Activity 图标，bg-primary/10
2. Token 消耗：2.34M，+8.3%，Zap 图标，bg-accent/10
3. 活跃 Agent：6，+2，Bot 图标，bg-success/10
4. 待审核：3，AlertTriangle 图标，bg-warning/10

### 图表区域（grid grid-cols-2 gap-4）
使用 Recharts 库：
- 左侧 Card：标题"调用趋势" + AreaChart（7 天数据，蓝色渐变填充，带 CartesianGrid + XAxis + YAxis + Tooltip）
- 右侧 Card：标题"Agent 分布" + PieChart（环形图，4 段：智能客服 45%、HR助手 25%、财务助手 18%、其他 12%，使用 primary/accent/chart-3/chart-4 四色）

### 底部区域（grid grid-cols-2 gap-4）
- 左侧 Card：标题"部门使用排行" + BarChart（5 个部门的调用量柱状图）
- 右侧 Card：标题"最近活动" + 列表（8 条，每条：时间 + 操作人 + 操作内容，text-sm）

## 样式要求
- 所有 Card 使用 bg-card border-border shadow-sm
- 图表高度 300px（ResponsiveContainer height={300}）
- 趋势向上用 text-green-500，向下用 text-red-500
