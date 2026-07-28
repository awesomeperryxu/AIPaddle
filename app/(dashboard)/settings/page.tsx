'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiFetch } from '@/lib/api/client'
import { ModelProvidersView } from '@/components/views/model-providers-view'
import { ChangePasswordCard } from '@/components/views/change-password-card'
import { Building2, Users, Bot, BookOpen, Zap, HardDrive, Loader2, Save, Info } from 'lucide-react'
import type { TenantInfo } from '@/lib/data/tenant'

export default function SettingsPage() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 编辑表单
  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  useEffect(() => {
    apiFetch<{ tenant: TenantInfo }>('/api/tenant')
      .then(data => {
        setTenant(data.tenant)
        setName(data.tenant.name)
        setShortName(data.tenant.shortName ?? '')
        setContactName(data.tenant.contactName ?? '')
        setContactEmail(data.tenant.contactEmail ?? '')
      })
      .catch(err => {
        if (err?.status === 403) setForbidden(true)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!tenant || !name.trim()) return
    setSaving(true)
    try {
      const data = await apiFetch<{ tenant: TenantInfo }>('/api/tenant', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), shortName, contactName, contactEmail }),
      })
      setTenant(data.tenant)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // 失败静默
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />加载中...
      </div>
    )
  }

  if (forbidden || !tenant) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">无访问权限</h2>
          <p className="text-sm text-muted-foreground">仅 Admin 和 Auditor 可查看组织设置</p>
        </div>
      </div>
    )
  }

  const storageGB = (tenant.storageQuota / 1024 / 1024 / 1024).toFixed(0)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">组织设置</h1>
        <p className="text-sm text-muted-foreground mt-0.5">管理组织基本信息与配额</p>
      </div>

      {/* 用量概览 */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{tenant.usage.members}</p>
                <p className="text-xs text-muted-foreground">成员</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{tenant.usage.agents}</p>
                <p className="text-xs text-muted-foreground">Agent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{tenant.usage.knowledgeBases}</p>
                <p className="text-xs text-muted-foreground">知识库</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 平台内置模型仅供演示提示（ADR-017：正式使用请配置本租户自己的模型供应商） */}
      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          平台内置模型仅供演示 / 测试，正式使用请在「模型供应商」中配置本租户自己的模型供应商与 API Key。
        </p>
      </div>

      {/* 配额 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">配额</CardTitle>
          <CardDescription>加入日期：{tenant.createdAt}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Token 配额</p>
              <p className="text-sm font-medium text-foreground">
                {(tenant.tokenQuota / 1_000_000).toFixed(0)} M
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-blue-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">存储配额</p>
              <p className="text-sm font-medium text-foreground">{storageGB} GB</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">QPS 限制</p>
              <p className="text-sm font-medium text-foreground">{tenant.qpsLimit} req/s</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 基础信息编辑 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base text-foreground">组织信息</CardTitle>
          </div>
          <CardDescription>仅 Admin 可修改</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-foreground">组织名称 <span className="text-destructive">*</span></label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-background border-border"
                placeholder="组织名称"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-foreground">简称</label>
              <Input
                value={shortName}
                onChange={e => setShortName(e.target.value)}
                className="bg-background border-border"
                placeholder="可选"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-foreground">联系人</label>
              <Input
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                className="bg-background border-border"
                placeholder="联系人姓名"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-foreground">联系邮箱</label>
              <Input
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                className="bg-background border-border"
                placeholder="contact@example.com"
                type="email"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="gap-2"
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />}
              {saved ? '已保存' : '保存'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 模型供应商（ADR-016 4.7.4）——仅 Admin 可见，非 Admin 自动隐藏 */}
      <ModelProvidersView />

      {/* 4.8.18c：修改密码。全角色可见——账号是管理员建的、密码也是管理员定的，
          人人都该能自己改掉 */}
      <ChangePasswordCard />
    </div>
  )
}
