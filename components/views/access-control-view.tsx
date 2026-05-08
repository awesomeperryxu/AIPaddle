'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  KeyRound,
  Shield,
  Smartphone,
  Clock,
  Globe,
  Lock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Monitor,
  LogOut,
  RefreshCw,
  Settings,
  Upload,
  Eye,
  EyeOff,
} from 'lucide-react';

const mockSessions = [
  {
    id: '1',
    user: '张三',
    ip: '192.168.1.100',
    device: 'Chrome / Windows',
    location: '上海',
    loginTime: '2026-05-08 14:30:00',
    duration: '2小时15分',
    status: 'active',
  },
  {
    id: '2',
    user: '李四',
    ip: '10.0.0.52',
    device: 'Safari / macOS',
    location: '北京',
    loginTime: '2026-05-08 12:15:00',
    duration: '4小时30分',
    status: 'active',
  },
  {
    id: '3',
    user: '王五',
    ip: '172.16.0.88',
    device: 'Firefox / Linux',
    location: '深圳',
    loginTime: '2026-05-08 10:45:00',
    duration: '6小时',
    status: 'active',
  },
  {
    id: '4',
    user: '赵六',
    ip: '192.168.2.200',
    device: 'Edge / Windows',
    location: '广州',
    loginTime: '2026-05-08 09:00:00',
    duration: '7小时45分',
    status: 'idle',
  },
  {
    id: '5',
    user: '钱七',
    ip: '10.1.1.33',
    device: 'Chrome / Android',
    location: '杭州',
    loginTime: '2026-05-08 08:30:00',
    duration: '8小时15分',
    status: 'active',
  },
];

const ssoProviders = [
  { id: 'azure', name: 'Azure AD', icon: '🔷', status: 'connected', protocol: 'OIDC' },
  { id: 'okta', name: 'Okta', icon: '🔐', status: 'disconnected', protocol: 'SAML 2.0' },
  { id: 'google', name: 'Google Workspace', icon: '🌐', status: 'disconnected', protocol: 'OIDC' },
  { id: 'wecom', name: '企业微信', icon: '💬', status: 'connected', protocol: 'OAuth 2.0' },
  { id: 'feishu', name: '飞书', icon: '🐦', status: 'disconnected', protocol: 'OAuth 2.0' },
  { id: 'dingtalk', name: '钉钉', icon: '📌', status: 'disconnected', protocol: 'OAuth 2.0' },
];

export function AccessControlView() {
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">访问控制</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            单点登录、多因素认证和会话管理
          </p>
        </div>
      </div>

      <Tabs defaultValue="sso" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sso" className="gap-2">
            <KeyRound className="h-4 w-4" />
            单点登录
          </TabsTrigger>
          <TabsTrigger value="mfa" className="gap-2">
            <Smartphone className="h-4 w-4" />
            多因素认证
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Monitor className="h-4 w-4" />
            会话管理
          </TabsTrigger>
          <TabsTrigger value="policy" className="gap-2">
            <Shield className="h-4 w-4" />
            登录策略
          </TabsTrigger>
        </TabsList>

        {/* SSO 配置 */}
        <TabsContent value="sso" className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {ssoProviders.map((provider) => (
              <Card key={provider.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl">
                        {provider.icon}
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{provider.name}</h3>
                        <p className="text-xs text-muted-foreground">{provider.protocol}</p>
                      </div>
                    </div>
                    <Badge
                      className={
                        provider.status === 'connected'
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {provider.status === 'connected' ? '已连接' : '未连接'}
                    </Badge>
                  </div>
                  <div className="mt-4">
                    {provider.status === 'connected' ? (
                      <Button variant="outline" size="sm" className="w-full">
                        <Settings className="h-4 w-4 mr-2" />
                        配置
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full">
                        连接
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* SSO 配置详情 */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Azure AD 配置</CardTitle>
              <CardDescription>配置 Azure Active Directory 单点登录</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client ID</Label>
                  <Input value="a1b2c3d4-e5f6-7890-abcd-ef1234567890" readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Client Secret</Label>
                  <div className="relative">
                    <Input
                      type={showSecret ? 'text' : 'password'}
                      value="your-client-secret-here"
                      readOnly
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tenant ID</Label>
                  <Input value="your-tenant-id" readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Redirect URI</Label>
                  <Input value="https://your-domain.com/auth/callback" readOnly />
                </div>
              </div>
              <div className="space-y-2">
                <Label>SAML 证书</Label>
                <div className="border border-dashed border-border rounded-lg p-4 text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    拖拽或点击上传 IdP 证书 (.pem, .cer)
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline">测试连接</Button>
                <Button>保存配置</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MFA 配置 */}
        <TabsContent value="mfa" className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">TOTP 验证器</h3>
                      <p className="text-xs text-muted-foreground">Google/Microsoft Authenticator</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
                <p className="text-sm text-muted-foreground">
                  使用基于时间的一次性密码进行二次验证
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">短信验证码</h3>
                      <p className="text-xs text-muted-foreground">SMS OTP</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
                <p className="text-sm text-muted-foreground">
                  通过手机短信发送一次性验证码
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-cyan-500" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">邮箱验证码</h3>
                      <p className="text-xs text-muted-foreground">Email OTP</p>
                    </div>
                  </div>
                  <Switch />
                </div>
                <p className="text-sm text-muted-foreground">
                  通过电子邮件发送一次性验证码
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">MFA 策略配置</CardTitle>
              <CardDescription>设置多因素认证的触发条件和范围</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-foreground">企业级强制 MFA</h4>
                    <p className="text-sm text-muted-foreground">所有用户必须启用 MFA</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-foreground">管理员强制 MFA</h4>
                    <p className="text-sm text-muted-foreground">所有管理员角色必须启用 MFA</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-foreground">新设备强制验证</h4>
                    <p className="text-sm text-muted-foreground">在新设备登录时要求 MFA 验证</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-foreground">敏感操作二次验证</h4>
                    <p className="text-sm text-muted-foreground">执行高危操作时要求再次验证</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 会话管理 */}
        <TabsContent value="sessions" className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Monitor className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{mockSessions.length}</p>
                    <p className="text-xs text-muted-foreground">在线会话</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">4h</p>
                    <p className="text-xs text-muted-foreground">平均会话时长</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">1</p>
                    <p className="text-xs text-muted-foreground">空闲会话</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">5</p>
                    <p className="text-xs text-muted-foreground">活跃地区</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">在线会话</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <RefreshCw className="h-4 w-4" />
                    刷新
                  </Button>
                  <Button variant="destructive" size="sm" className="gap-1.5">
                    <LogOut className="h-4 w-4" />
                    全部登出
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>用户</TableHead>
                    <TableHead>IP 地址</TableHead>
                    <TableHead>设备</TableHead>
                    <TableHead>位置</TableHead>
                    <TableHead>登录时间</TableHead>
                    <TableHead>会话时长</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.user}</TableCell>
                      <TableCell className="text-muted-foreground">{session.ip}</TableCell>
                      <TableCell className="text-muted-foreground">{session.device}</TableCell>
                      <TableCell className="text-muted-foreground">{session.location}</TableCell>
                      <TableCell className="text-muted-foreground">{session.loginTime}</TableCell>
                      <TableCell className="text-muted-foreground">{session.duration}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            session.status === 'active'
                              ? 'bg-green-500/10 text-green-500 border-green-500/20'
                              : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                          }
                        >
                          {session.status === 'active' ? '活跃' : '空闲'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive">
                          <LogOut className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 登录策略 */}
        <TabsContent value="policy" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">密码策略</CardTitle>
                <CardDescription>设置密码复杂度和有效期要求</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>最小密码长度</Label>
                  <Select defaultValue="8">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 位</SelectItem>
                      <SelectItem value="8">8 位</SelectItem>
                      <SelectItem value="10">10 位</SelectItem>
                      <SelectItem value="12">12 位</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>要求大写字母</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>要求小写字母</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>要求数字</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>要求特殊字符</Label>
                  <Switch />
                </div>
                <div className="space-y-2">
                  <Label>密码有效期</Label>
                  <Select defaultValue="90">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 天</SelectItem>
                      <SelectItem value="60">60 天</SelectItem>
                      <SelectItem value="90">90 天</SelectItem>
                      <SelectItem value="180">180 天</SelectItem>
                      <SelectItem value="never">永不过期</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">登录安全</CardTitle>
                <CardDescription>配置登录保护措施</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>登录失败锁定阈值</Label>
                  <Select defaultValue="5">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 次</SelectItem>
                      <SelectItem value="5">5 次</SelectItem>
                      <SelectItem value="10">10 次</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>锁定时长</Label>
                  <Select defaultValue="30">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 分钟</SelectItem>
                      <SelectItem value="30">30 分钟</SelectItem>
                      <SelectItem value="60">1 小时</SelectItem>
                      <SelectItem value="manual">手动解锁</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>会话超时时间</Label>
                  <Select defaultValue="60">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 分钟</SelectItem>
                      <SelectItem value="60">1 小时</SelectItem>
                      <SelectItem value="120">2 小时</SelectItem>
                      <SelectItem value="480">8 小时</SelectItem>
                      <SelectItem value="1440">24 小时</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>启用 IP 白名单</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label>记录登录审计日志</Label>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button>保存策略</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
