"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  Bell, 
  Shield, 
  Globe,
  Palette,
  Mail,
  Building2,
  Upload,
  Save
} from "lucide-react"

export function SettingsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">系统设置</h1>
        <p className="text-muted-foreground mt-1">管理您的账户和系统偏好设置</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            个人资料
          </TabsTrigger>
          <TabsTrigger value="organization" className="gap-2">
            <Building2 className="h-4 w-4" />
            组织设置
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            通知设置
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            安全设置
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            外观设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">个人资料</CardTitle>
              <CardDescription>管理您的个人信息和头像</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src="/placeholder.svg" />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">张</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    上传头像
                  </Button>
                  <p className="text-xs text-muted-foreground">支持 JPG、PNG 格式，最大 2MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">姓名</Label>
                  <Input defaultValue="张三" className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">职位</Label>
                  <Input defaultValue="高级 AI 工程师" className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">邮箱</Label>
                  <Input defaultValue="zhangsan@example.com" type="email" className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">手机号</Label>
                  <Input defaultValue="+86 138****8888" className="bg-background border-border" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">个人简介</Label>
                <Textarea 
                  placeholder="介绍一下自己..." 
                  defaultValue="专注于企业级 AI 应用开发，拥有 5 年大模型和 NLP 经验。"
                  className="bg-background border-border min-h-[100px]" 
                />
              </div>

              <div className="flex justify-end">
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  <Save className="h-4 w-4" />
                  保存更改
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">组织信息</CardTitle>
              <CardDescription>管理您的组织基本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">组织名称</Label>
                  <Input defaultValue="示例科技有限公司" className="bg-background border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">组织 ID</Label>
                  <div className="flex gap-2">
                    <Input defaultValue="org_xxxxxxxx" disabled className="bg-muted border-border" />
                    <Badge variant="secondary">免费复制</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">行业</Label>
                  <Select defaultValue="tech">
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="tech">科技/互联网</SelectItem>
                      <SelectItem value="finance">金融/银行</SelectItem>
                      <SelectItem value="healthcare">医疗/健康</SelectItem>
                      <SelectItem value="education">教育/培训</SelectItem>
                      <SelectItem value="retail">零售/电商</SelectItem>
                      <SelectItem value="manufacturing">制造/工业</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">公司规模</Label>
                  <Select defaultValue="medium">
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="small">1-50 人</SelectItem>
                      <SelectItem value="medium">51-200 人</SelectItem>
                      <SelectItem value="large">201-1000 人</SelectItem>
                      <SelectItem value="enterprise">1000+ 人</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  <Save className="h-4 w-4" />
                  保存更改
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">默认模型设置</CardTitle>
              <CardDescription>设置组织内的默认 AI 模型配置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">默认对话模型</Label>
                  <Select defaultValue="gpt4">
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="gpt4">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt35">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="claude3">Claude 3 Opus</SelectItem>
                      <SelectItem value="qwen">通义千问 Max</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">默认向量模型</Label>
                  <Select defaultValue="ada">
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="ada">text-embedding-ada-002</SelectItem>
                      <SelectItem value="3small">text-embedding-3-small</SelectItem>
                      <SelectItem value="3large">text-embedding-3-large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">通知偏好</CardTitle>
              <CardDescription>管理您接收通知的方式和类型</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-foreground">邮件通知</Label>
                    <p className="text-sm text-muted-foreground">接收重要更新和账单通知</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-foreground">安全警报</Label>
                    <p className="text-sm text-muted-foreground">异常登录和安全事件通知</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-foreground">使用量警报</Label>
                    <p className="text-sm text-muted-foreground">当使用量接近限制时通知</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-foreground">产品更新</Label>
                    <p className="text-sm text-muted-foreground">新功能和产品更新通知</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-foreground">营销邮件</Label>
                    <p className="text-sm text-muted-foreground">促销活动和优惠信息</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">通知频率</CardTitle>
              <CardDescription>设置接收通知的频率</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">摘要邮件</Label>
                <Select defaultValue="weekly">
                  <SelectTrigger className="bg-background border-border max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="daily">每日</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                    <SelectItem value="monthly">每月</SelectItem>
                    <SelectItem value="never">从不</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">密码设置</CardTitle>
              <CardDescription>更新您的登录密码</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-md">
                <Label className="text-foreground">当前密码</Label>
                <Input type="password" className="bg-background border-border" />
              </div>
              <div className="space-y-2 max-w-md">
                <Label className="text-foreground">新密码</Label>
                <Input type="password" className="bg-background border-border" />
              </div>
              <div className="space-y-2 max-w-md">
                <Label className="text-foreground">确认新密码</Label>
                <Input type="password" className="bg-background border-border" />
              </div>
              <Button className="bg-primary hover:bg-primary/90">更新密码</Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">双因素认证</CardTitle>
              <CardDescription>为您的账户添加额外的安全保护</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground">启用双因素认证</Label>
                  <p className="text-sm text-muted-foreground">使用手机验证码进行二次验证</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">登录记录</CardTitle>
              <CardDescription>查看最近的账户登录活动</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { device: "Chrome on macOS", location: "上海, 中国", time: "刚刚", current: true },
                  { device: "Safari on iPhone", location: "上海, 中国", time: "2 小时前", current: false },
                  { device: "Chrome on Windows", location: "北京, 中国", time: "昨天 14:32", current: false },
                ].map((session, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{session.device}</p>
                        {session.current && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
                            当前设备
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{session.location} · {session.time}</p>
                    </div>
                    {!session.current && (
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                        登出
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">主题设置</CardTitle>
              <CardDescription>自定义界面外观</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-foreground">颜色主题</Label>
                <div className="grid grid-cols-3 gap-4 max-w-md">
                  <div className="relative">
                    <input type="radio" name="theme" id="light" className="peer sr-only" />
                    <label 
                      htmlFor="light" 
                      className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border cursor-pointer hover:bg-muted/50 peer-checked:border-primary peer-checked:bg-primary/5"
                    >
                      <div className="w-8 h-8 rounded-full bg-white border border-border" />
                      <span className="text-sm text-foreground">浅色</span>
                    </label>
                  </div>
                  <div className="relative">
                    <input type="radio" name="theme" id="dark" className="peer sr-only" defaultChecked />
                    <label 
                      htmlFor="dark" 
                      className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border cursor-pointer hover:bg-muted/50 peer-checked:border-primary peer-checked:bg-primary/5"
                    >
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border border-border" />
                      <span className="text-sm text-foreground">深色</span>
                    </label>
                  </div>
                  <div className="relative">
                    <input type="radio" name="theme" id="system" className="peer sr-only" />
                    <label 
                      htmlFor="system" 
                      className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border cursor-pointer hover:bg-muted/50 peer-checked:border-primary peer-checked:bg-primary/5"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-white to-zinc-900 border border-border" />
                      <span className="text-sm text-foreground">跟随系统</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">语言</Label>
                <Select defaultValue="zh-CN">
                  <SelectTrigger className="bg-background border-border max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="zh-CN">简体中文</SelectItem>
                    <SelectItem value="zh-TW">繁體中文</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="ja-JP">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">时区</Label>
                <Select defaultValue="asia-shanghai">
                  <SelectTrigger className="bg-background border-border max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="asia-shanghai">亚洲/上海 (GMT+8)</SelectItem>
                    <SelectItem value="asia-tokyo">亚洲/东京 (GMT+9)</SelectItem>
                    <SelectItem value="america-los-angeles">美国/洛杉矶 (GMT-7)</SelectItem>
                    <SelectItem value="europe-london">欧洲/伦敦 (GMT+1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">界面密度</CardTitle>
              <CardDescription>调整界面元素的紧凑程度</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <input type="radio" name="density" id="compact" className="accent-primary" />
                  <Label htmlFor="compact" className="text-foreground cursor-pointer">紧凑</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="radio" name="density" id="default" className="accent-primary" defaultChecked />
                  <Label htmlFor="default" className="text-foreground cursor-pointer">默认</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="radio" name="density" id="comfortable" className="accent-primary" />
                  <Label htmlFor="comfortable" className="text-foreground cursor-pointer">舒适</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
