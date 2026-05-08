"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  CreditCard, 
  Download, 
  Receipt,
  TrendingUp,
  Zap,
  Package,
  ChevronRight,
  CheckCircle2
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

const costTrendData = [
  { month: "1月", cost: 12450, budget: 15000 },
  { month: "2月", cost: 13200, budget: 15000 },
  { month: "3月", cost: 14100, budget: 15000 },
  { month: "4月", cost: 11800, budget: 15000 },
  { month: "5月", cost: 15600, budget: 18000 },
  { month: "6月", cost: 14200, budget: 18000 },
]

const modelUsageData = [
  { model: "GPT-4", cost: 8520, tokens: 2840000 },
  { model: "Claude-3", cost: 4280, tokens: 1426000 },
  { model: "Gemini Pro", cost: 1200, tokens: 800000 },
  { model: "Qwen-Max", cost: 200, tokens: 400000 },
]

const invoiceHistory = [
  { id: "INV-2024-006", date: "2024-06-01", amount: 14200, status: "paid", period: "2024年6月" },
  { id: "INV-2024-005", date: "2024-05-01", amount: 15600, status: "paid", period: "2024年5月" },
  { id: "INV-2024-004", date: "2024-04-01", amount: 11800, status: "paid", period: "2024年4月" },
  { id: "INV-2024-003", date: "2024-03-01", amount: 14100, status: "paid", period: "2024年3月" },
  { id: "INV-2024-002", date: "2024-02-01", amount: 13200, status: "paid", period: "2024年2月" },
]

const plans = [
  {
    name: "基础版",
    price: "¥999",
    period: "/月",
    description: "适合小型团队入门使用",
    features: ["5 个 Agent", "100K Token/月", "基础知识库", "邮件支持"],
    current: false
  },
  {
    name: "专业版",
    price: "¥2,999",
    period: "/月",
    description: "适合中型企业深度应用",
    features: ["无限 Agent", "1M Token/月", "高级知识库", "优先支持", "API 访问", "自定义模型"],
    current: true
  },
  {
    name: "企业版",
    price: "定制",
    period: "",
    description: "适合大型企业定制需求",
    features: ["一切专业版功能", "无限 Token", "私有部署", "专属客户经理", "SLA 保障", "定制开发"],
    current: false
  }
]

export function BillingView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">账单管理</h1>
          <p className="text-muted-foreground mt-1">管理您的订阅计划和查看使用账单</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            导出账单
          </Button>
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <CreditCard className="h-4 w-4" />
            管理支付方式
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">费用概览</TabsTrigger>
          <TabsTrigger value="invoices">账单历史</TabsTrigger>
          <TabsTrigger value="plans">订阅计划</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">本月费用</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">¥14,200</div>
                <div className="flex items-center gap-1 text-sm text-emerald-500 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>较上月 -8.9%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Token 消耗</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">5.47M</div>
                <Progress value={54.7} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">已使用 54.7% 配额</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">API 调用</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">128.5K</div>
                <p className="text-sm text-muted-foreground mt-1">本月累计调用次数</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">当前计划</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">专业版</div>
                <p className="text-sm text-muted-foreground mt-1">下次续费: 2024-07-15</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">费用趋势</CardTitle>
                <CardDescription>过去 6 个月的费用与预算对比</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={costTrendData}>
                      <defs>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))"
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="cost" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorCost)" 
                        name="实际费用"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="budget" 
                        stroke="hsl(var(--muted-foreground))" 
                        strokeDasharray="5 5"
                        fill="none"
                        name="预算"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">模型费用分布</CardTitle>
                <CardDescription>各模型的费用占比</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modelUsageData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis dataKey="model" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))"
                        }} 
                        formatter={(value: number) => [`¥${value}`, "费用"]}
                      />
                      <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">账单历史</CardTitle>
              <CardDescription>查看和下载历史账单</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableHead className="text-muted-foreground">账单编号</TableHead>
                    <TableHead className="text-muted-foreground">账单周期</TableHead>
                    <TableHead className="text-muted-foreground">开票日期</TableHead>
                    <TableHead className="text-muted-foreground">金额</TableHead>
                    <TableHead className="text-muted-foreground">状态</TableHead>
                    <TableHead className="text-muted-foreground text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceHistory.map((invoice) => (
                    <TableRow key={invoice.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{invoice.id}</TableCell>
                      <TableCell className="text-muted-foreground">{invoice.period}</TableCell>
                      <TableCell className="text-muted-foreground">{invoice.date}</TableCell>
                      <TableCell className="text-foreground">¥{invoice.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          已支付
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                          <Download className="h-4 w-4" />
                          下载
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card 
                key={plan.name} 
                className={`bg-card border-border relative ${plan.current ? "ring-2 ring-primary" : ""}`}
              >
                {plan.current && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">当前计划</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl text-foreground">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="space-y-3 text-left mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    variant={plan.current ? "outline" : "default"} 
                    className="w-full gap-2"
                    disabled={plan.current}
                  >
                    {plan.current ? "当前计划" : "升级计划"}
                    {!plan.current && <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
