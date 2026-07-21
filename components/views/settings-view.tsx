'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Shield,
  Sparkles,
  Database,
  Save,
  CheckCircle2,
} from 'lucide-react';

// 安全策略开关的键
type SecurityToggleKey = 'mfa' | 'ipWhitelist' | 'logMasking' | 'watermark';

interface SecurityToggleDef {
  key: SecurityToggleKey;
  label: string;
  desc: string;
}

const securityToggleDefs: SecurityToggleDef[] = [
  {
    key: 'mfa',
    label: '管理员敏感操作二次验证（MFA）',
    desc: '删除租户、调整配额、吊销 Key 时要求 TOTP 验证',
  },
  {
    key: 'ipWhitelist',
    label: '平台控制台 IP 白名单',
    desc: '仅白名单 IP 可访问平台运营后台',
  },
  {
    key: 'logMasking',
    label: '日志敏感信息脱敏',
    desc: '手机号、身份证、银行卡在日志与导出中自动打码',
  },
  {
    key: 'watermark',
    label: '页面水印',
    desc: '控制台叠加操作人工号水印，防截图泄露',
  },
];

// 组件内联 mock 默认值
const defaultForm = {
  platformName: 'AIPaddle · AI 业务赋能平台',
  domain: 'https://console.aipaddle.cn',
  timezone: 'UTC+8 (北京时间)',
  language: '简体中文',
  sessionTimeout: '8 小时',
  loginLock: '5 次失败锁定 15 分钟',
  defaultModel: 'GPT-4-Turbo',
  temperature: '0.7',
  callTimeout: '60',
  auditRetention: '1 年（默认）',
  chatRetention: '90 天',
  tenantDataRetention: '30 天可恢复',
};

const timezoneOptions = ['UTC+8 (北京时间)', 'UTC+9 (东京时间)'];
const languageOptions = ['简体中文', 'English'];
const sessionTimeoutOptions = ['8 小时', '30 分钟', '2 小时', '24 小时'];
const loginLockOptions = ['5 次失败锁定 15 分钟', '3 次失败锁定 30 分钟', '不锁定'];
const modelOptions = ['GPT-4-Turbo', 'Claude-3-Opus', 'Qwen-Max'];
const auditRetentionOptions = ['1 年（默认）', '3 年（企业版）', '7 年（企业版）'];
const chatRetentionOptions = ['90 天', '30 天', '180 天'];
const tenantDataRetentionOptions = ['30 天可恢复', '7 天可恢复'];

export function SettingsView() {
  const [form, setForm] = useState(defaultForm);
  const [toggles, setToggles] = useState<Record<SecurityToggleKey, boolean>>({
    mfa: true,
    ipWhitelist: false,
    logMasking: true,
    watermark: false,
  });
  const [saved, setSaved] = useState(false);

  const updateField = <K extends keyof typeof defaultForm>(
    key: K,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // 占位保存：仅本地提示，暂不接后端
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
  };

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">系统设置</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            平台级全局配置（对所有租户生效）
          </p>
        </div>
        <Button onClick={handleSave} className="gap-2">
          {saved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saved ? '已保存' : '保存设置'}
        </Button>
      </div>

      {/* 平台信息 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-primary" />
            平台信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="platformName" className="text-xs text-muted-foreground">
                平台名称
              </Label>
              <Input
                id="platformName"
                value={form.platformName}
                onChange={(e) => updateField('platformName', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="domain" className="text-xs text-muted-foreground">
                访问域名
              </Label>
              <Input
                id="domain"
                value={form.domain}
                onChange={(e) => updateField('domain', e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">默认时区</Label>
              <Select
                value={form.timezone}
                onValueChange={(v) => updateField('timezone', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezoneOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">默认语言</Label>
              <Select
                value={form.language}
                onValueChange={(v) => updateField('language', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 安全策略 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Shield className="h-4 w-4 text-primary" />
            安全策略
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {securityToggleDefs.map((t) => (
            <div
              key={t.key}
              className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
              </div>
              <Switch
                checked={toggles[t.key]}
                onCheckedChange={(checked) =>
                  setToggles((prev) => ({ ...prev, [t.key]: checked }))
                }
              />
            </div>
          ))}
          <Separator className="my-1" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">会话超时</Label>
              <Select
                value={form.sessionTimeout}
                onValueChange={(v) => updateField('sessionTimeout', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sessionTimeoutOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">登录失败锁定</Label>
              <Select
                value={form.loginLock}
                onValueChange={(v) => updateField('loginLock', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {loginLockOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 模型默认参数 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            模型默认参数
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">平台默认模型</Label>
              <Select
                value={form.defaultModel}
                onValueChange={(v) => updateField('defaultModel', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="temperature" className="text-xs text-muted-foreground">
                默认 Temperature
              </Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                value={form.temperature}
                onChange={(e) => updateField('temperature', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="callTimeout" className="text-xs text-muted-foreground">
                调用超时（秒）
              </Label>
              <Input
                id="callTimeout"
                type="number"
                value={form.callTimeout}
                onChange={(e) => updateField('callTimeout', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据保留与合规 */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Database className="h-4 w-4 text-primary" />
            数据保留与合规
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">审计日志保留</Label>
              <Select
                value={form.auditRetention}
                onValueChange={(v) => updateField('auditRetention', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {auditRetentionOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">对话日志保留</Label>
              <Select
                value={form.chatRetention}
                onValueChange={(v) => updateField('chatRetention', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chatRetentionOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">删除租户数据保留</Label>
              <Select
                value={form.tenantDataRetention}
                onValueChange={(v) => updateField('tenantDataRetention', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tenantDataRetentionOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            审计日志不可篡改、不可删除；导出操作本身亦会被审计。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
