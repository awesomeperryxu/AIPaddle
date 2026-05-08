# 租户管理页面增强 UI 设计文档

**文档类型**: UI 设计文档  
**创建日期**: 2026-05-08  
**目标版本**: v1.03  
**所属模块**: 2.9 租户管理（平台运营方视角）

---

## 一、设计系统规范

### 1.1 颜色系统（OKLCH）

```css
/* 主色调 */
--primary: oklch(0.55 0.25 262);
--primary-foreground: oklch(0.98 0 0);

/* 状态色 */
--success: oklch(0.65 0.20 145);
--warning: oklch(0.75 0.18 85);
--error: oklch(0.60 0.22 25);

/* 中性色 */
--background: oklch(0.98 0 0);
--foreground: oklch(0.20 0 0);
--muted: oklch(0.95 0 0);
--border: oklch(0.90 0 0);
```

### 1.2 间距系统

- 基础单位：8px
- 组件间距：24px
- 卡片内边距：24px
- 表单字段间距：16px

### 1.3 圆角

- 按钮/输入框：8px
- 卡片：12px
- 弹窗：16px

---

## 二、页面设计

### 2.1 开通企业抽屉（Drawer）

#### 2.1.1 布局结构

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
                  <Label htmlFor="shortName">企业简称</Label>
                  <Input id="shortName" placeholder="用于界面显示" />
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
                      <SelectItem value="healthcare">医疗</SelectItem>
                      <SelectItem value="manufacturing">制造</SelectItem>
                      <SelectItem value="retail">零售</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
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
                      <SelectItem value="501-1000">501-1000人</SelectItem>
                      <SelectItem value="1000+">1000人以上</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="location">国家/地区 *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cn">中国</SelectItem>
                      <SelectItem value="us">美国</SelectItem>
                      <SelectItem value="jp">日本</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timezone">时区设置 *</Label>
                  <Select defaultValue="utc+8">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utc+8">UTC+8 (北京时间)</SelectItem>
                      <SelectItem value="utc+9">UTC+9 (东京时间)</SelectItem>
                      <SelectItem value="utc-5">UTC-5 (纽约时间)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="logo">企业 Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <Button type="button" variant="outline" size="sm">
                        上传图片
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        支持 JPG、PNG 格式，最大 2MB，建议尺寸 200x200
                      </p>
                    </div>
                  </div>
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
                  <Label htmlFor="contactPosition">联系人职位</Label>
                  <Input id="contactPosition" placeholder="如：技术负责人" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">联系邮箱 *</Label>
                  <Input id="contactEmail" type="email" placeholder="用于接收通知" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">联系电话 *</Label>
                  <Input id="contactPhone" placeholder="+86 138xxxx" />
                </div>
                
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="backupEmail">备用邮箱</Label>
                  <Input id="backupEmail" type="email" placeholder="用于重要通知抄送" />
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
                
                <div className="space-y-2 col-span-2">
                  <Label>计费模式 *</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['按量付费', '包年', '包月'].map((mode) => (
                      <label key={mode} className="relative flex cursor-pointer">
                        <input type="radio" name="billing" className="peer sr-only" />
                        <div className="w-full rounded-lg border-2 border-border p-3 text-center peer-checked:border-primary peer-checked:bg-primary/5">
                          <div className="font-medium">{mode}</div>
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
                
                <div className="space-y-2">
                  <Label htmlFor="warningThreshold">配额预警阈值 *</Label>
                  <Input id="warningThreshold" type="number" defaultValue="80" />
                  <p className="text-xs text-muted-foreground">单位：%，达到后发送邮件</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="qpsLimit">并发请求限制 *</Label>
                  <Input id="qpsLimit" type="number" defaultValue="100" />
                  <p className="text-xs text-muted-foreground">单位：QPS，范围 10-1000</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="storageQuota">存储空间配额 *</Label>
                  <Input id="storageQuota" type="number" defaultValue="10" />
                  <p className="text-xs text-muted-foreground">单位：GB</p>
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
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="serviceDate">服务有效期 *</Label>
                  <Input id="serviceDate" type="text" placeholder="选择日期范围" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="mcpEnabled">是否启用 MCP</Label>
                  <div className="flex items-center gap-2">
                    <Switch id="mcpEnabled" />
                    <span className="text-sm text-muted-foreground">
                      开启后租户可申请自定义 MCP
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="isolation">数据隔离级别 *</Label>
                  <Select defaultValue="logical">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="logical">逻辑隔离</SelectItem>
                      <SelectItem value="physical">物理隔离</SelectItem>
                    </SelectContent>
                  </Select>
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

#### 2.1.2 v0.dev 提示词

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

### 2.2 企业详情页（二级页面）

#### 2.2.1 布局结构

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Building2, Mail, Phone, MapPin, Calendar, 
  Edit, TrendingUp, Receipt, FileText, Settings 
} from "lucide-react"

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
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: '65%' }} />
                    </div>
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

由于内容较长，我将使用 Bash 工具继续追加剩余的页面设计。

---

### 2.3 配额管理页（二级页面）

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

---

### 2.4 账单管理页（二级页面）

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

---

### 2.5 企业列表操作列增强

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

## 三、v0.dev 提示词汇总

### 3.1 企业详情页

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

### 3.2 配额管理页

```
创建一个配额管理页，包含 3 个配额卡片（Token/存储/并发），横向排列。

每个卡片包含：
- 标题（带图标）+ "调整配额"按钮
- 已用量/总量显示
- 进度条（Token 和存储）
- "查看详情"按钮

使用 shadcn/ui Card 组件，OKLCH 配色，8px 圆角。
```

### 3.3 账单管理页

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

## 四、响应式设计说明

### 4.1 断点定义

- Desktop: ≥ 1280px（默认）
- Tablet: 768px - 1279px
- Mobile: < 768px

### 4.2 响应式调整

**开通企业抽屉**:
- Desktop: 宽度 800px
- Tablet: 宽度 90vw
- Mobile: 全屏

**企业详情页**:
- Desktop: 左右布局（320px + flex-1）
- Tablet/Mobile: 上下布局，左侧卡片宽度 100%

**配额管理页**:
- Desktop: 3 列
- Tablet: 2 列
- Mobile: 1 列

**账单管理页**:
- Desktop: 4 列统计卡片
- Tablet: 2 列
- Mobile: 1 列，表格横向滚动

---

## 五、交互细节

### 5.1 加载状态

- 列表加载：使用 Skeleton 组件
- 图表加载：显示 Loading 动画
- 按钮提交：显示 Spinner + 禁用状态

### 5.2 错误处理

- 表单验证错误：字段下方显示红色错误文本
- API 错误：使用 Toast 组件显示错误信息
- 网络错误：显示重试按钮

### 5.3 成功反馈

- 创建成功：Toast 提示 + 自动跳转
- 更新成功：Toast 提示 + 数据刷新
- 删除成功：Toast 提示 + 列表刷新

### 5.4 确认弹窗

- 暂停服务：AlertDialog 二次确认
- 删除租户：AlertDialog + 输入企业名称确认
- 批量操作：AlertDialog 显示影响范围

---

## 六、无障碍设计

- 所有表单字段使用 Label 组件关联
- 按钮使用语义化图标 + 文本
- 表格使用正确的 ARIA 属性
- 键盘导航支持（Tab/Enter/Esc）
- 颜色对比度符合 WCAG AA 标准

---

## 七、性能优化

- 列表使用虚拟滚动（react-window）
- 图表使用懒加载（React.lazy）
- 图片使用 Next.js Image 组件
- API 请求使用 SWR 缓存
- 表单使用 React Hook Form 优化渲染
