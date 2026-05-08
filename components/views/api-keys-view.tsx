"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Shield
} from "lucide-react"

interface ApiKey {
  id: string
  name: string
  key: string
  prefix: string
  permissions: string[]
  rateLimit: number
  lastUsed: string
  createdAt: string
  status: "active" | "expired" | "revoked"
  expiresAt: string | null
}

const apiKeys: ApiKey[] = [
  {
    id: "key-1",
    name: "生产环境 API Key",
    key: "aip_sk_prod_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    prefix: "aip_sk_prod_",
    permissions: ["agents:read", "agents:execute", "knowledge:read"],
    rateLimit: 1000,
    lastUsed: "2024-06-15 14:32:18",
    createdAt: "2024-01-10",
    status: "active",
    expiresAt: "2025-01-10"
  },
  {
    id: "key-2",
    name: "测试环境 API Key",
    key: "aip_sk_test_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
    prefix: "aip_sk_test_",
    permissions: ["agents:read", "agents:execute", "agents:write", "knowledge:read", "knowledge:write"],
    rateLimit: 100,
    lastUsed: "2024-06-14 09:15:42",
    createdAt: "2024-03-20",
    status: "active",
    expiresAt: null
  },
  {
    id: "key-3",
    name: "旧版生产 Key",
    key: "aip_sk_old_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    prefix: "aip_sk_old_",
    permissions: ["agents:read"],
    rateLimit: 500,
    lastUsed: "2024-05-01 11:20:00",
    createdAt: "2023-06-15",
    status: "expired",
    expiresAt: "2024-06-15"
  }
]

const permissionOptions = [
  { value: "agents:read", label: "Agent 读取" },
  { value: "agents:write", label: "Agent 写入" },
  { value: "agents:execute", label: "Agent 执行" },
  { value: "knowledge:read", label: "知识库读取" },
  { value: "knowledge:write", label: "知识库写入" },
  { value: "workflow:read", label: "工作流读取" },
  { value: "workflow:execute", label: "工作流执行" },
  { value: "analytics:read", label: "统计数据读取" },
]

export function ApiKeysView() {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }))
  }

  const maskKey = (key: string) => {
    return key.substring(0, 16) + "•".repeat(24)
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
  }

  const getStatusBadge = (status: ApiKey["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">活跃</Badge>
      case "expired":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">已过期</Badge>
      case "revoked":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">已吊销</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">API 密钥管理</h1>
          <p className="text-muted-foreground mt-1">管理您的 API 访问密钥和权限</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              创建新密钥
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">创建 API 密钥</DialogTitle>
              <DialogDescription>创建一个新的 API 密钥用于访问 AIPaddle 服务</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-foreground">密钥名称</Label>
                <Input placeholder="例如: 生产环境 API Key" className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">环境类型</Label>
                <Select>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="选择环境" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="production">生产环境</SelectItem>
                    <SelectItem value="staging">预发布环境</SelectItem>
                    <SelectItem value="development">开发环境</SelectItem>
                    <SelectItem value="test">测试环境</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">权限范围</Label>
                <div className="grid grid-cols-2 gap-2">
                  {permissionOptions.map((perm) => (
                    <div key={perm.value} className="flex items-center gap-2">
                      <Switch id={perm.value} />
                      <Label htmlFor={perm.value} className="text-sm text-muted-foreground">{perm.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">速率限制 (请求/分钟)</Label>
                <Input type="number" placeholder="1000" defaultValue={1000} className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">过期时间</Label>
                <Select>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="选择过期时间" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="30d">30 天</SelectItem>
                    <SelectItem value="90d">90 天</SelectItem>
                    <SelectItem value="180d">180 天</SelectItem>
                    <SelectItem value="1y">1 年</SelectItem>
                    <SelectItem value="never">永不过期</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
              <Button className="bg-primary hover:bg-primary/90" onClick={() => setCreateDialogOpen(false)}>创建密钥</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Security Notice */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-500">安全提醒</p>
            <p className="text-sm text-muted-foreground mt-1">
              API 密钥具有完整的 API 访问权限。请妥善保管，不要在客户端代码中暴露密钥，也不要将其提交到版本控制系统中。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">活跃密钥</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">2</div>
            <p className="text-sm text-muted-foreground mt-1">当前正在使用</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日调用</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">12,847</div>
            <p className="text-sm text-muted-foreground mt-1">API 请求次数</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">成功率</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">99.8%</div>
            <p className="text-sm text-muted-foreground mt-1">请求成功率</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">安全评分</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">A+</div>
            <p className="text-sm text-muted-foreground mt-1">密钥安全等级</p>
          </CardContent>
        </Card>
      </div>

      {/* API Keys Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">API 密钥列表</CardTitle>
          <CardDescription>管理所有已创建的 API 密钥</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">名称</TableHead>
                <TableHead className="text-muted-foreground">密钥</TableHead>
                <TableHead className="text-muted-foreground">权限</TableHead>
                <TableHead className="text-muted-foreground">速率限制</TableHead>
                <TableHead className="text-muted-foreground">最后使用</TableHead>
                <TableHead className="text-muted-foreground">状态</TableHead>
                <TableHead className="text-muted-foreground text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((apiKey) => (
                <TableRow key={apiKey.id} className="border-border hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{apiKey.name}</p>
                      <p className="text-xs text-muted-foreground">创建于 {apiKey.createdAt}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                        {showKeys[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => toggleKeyVisibility(apiKey.id)}
                      >
                        {showKeys[apiKey.id] ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => copyKey(apiKey.key)}
                      >
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {apiKey.permissions.slice(0, 2).map((perm) => (
                        <Badge key={perm} variant="secondary" className="text-xs">
                          {perm.split(":")[0]}
                        </Badge>
                      ))}
                      {apiKey.permissions.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{apiKey.permissions.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {apiKey.rateLimit}/分钟
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {apiKey.lastUsed}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(apiKey.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
