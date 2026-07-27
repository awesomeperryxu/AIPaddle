'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiFetch } from '@/lib/api/client'
import { PROVIDER_CATALOG, MODEL_SLOTS, providerLabel, providerMeta, type SlotKey } from '@/lib/ai/provider-catalog'
import type { ProviderMasked, ModelSettings } from '@/lib/data/model-providers'
import { Plus, Cpu, Loader2, Trash2, Pencil, Plug, Eye, EyeOff, CheckCircle2, XCircle, Clock } from 'lucide-react'

type Form = {
  provider: ProviderMasked['provider']
  credentialName: string
  baseUrl: string
  apiKey: string
  models: string   // 每行一个模型
  enabled: boolean
}
const emptyForm: Form = { provider: 'openai-compat', credentialName: '', baseUrl: '', apiKey: '', models: '', enabled: true }

type TestState = { loading: boolean; ok?: boolean; message?: string }
const SLOT_SEP = '::'

export function ModelProvidersView() {
  const [providers, setProviders] = useState<ProviderMasked[]>([])
  const [settings, setSettings] = useState<ModelSettings>({})
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)  // null=新增
  const [form, setForm] = useState<Form>(emptyForm)
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [tests, setTests] = useState<Record<string, TestState>>({})
  const [savingSettings, setSavingSettings] = useState(false)

  // 供应商 + 设置一起拉；事件后（增删改）复用它刷新。
  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      apiFetch<{ providers: ProviderMasked[] }>('/api/model-providers'),
      apiFetch<{ settings: ModelSettings }>('/api/model-providers/settings'),
    ])
    setProviders(p.providers)
    setSettings(s.settings ?? {})
  }, [])

  // 首屏加载：内联 promise 链（避免 react-hooks/set-state-in-effect 误报）。
  useEffect(() => {
    Promise.all([
      apiFetch<{ providers: ProviderMasked[] }>('/api/model-providers'),
      apiFetch<{ settings: ModelSettings }>('/api/model-providers/settings'),
    ])
      .then(([p, s]) => { setProviders(p.providers); setSettings(s.settings ?? {}) })
      .catch((e) => {
        // 403 → 非 Admin，整块隐藏（服务端才是权限真源）
        if (e instanceof Error && /无权限|forbidden|403/i.test(e.message)) setForbidden(true)
      })
      .finally(() => setLoading(false))
  }, [])

  // ── 供应商增删改 ────────────────────────────────────────────────
  const openCreate = () => { setEditId(null); setForm(emptyForm); setFormError(null); setShowKey(false); setDialogOpen(true) }
  const openEdit = (p: ProviderMasked) => {
    setEditId(p.id)
    setForm({
      provider: p.provider, credentialName: p.credentialName, baseUrl: p.baseUrl ?? '',
      apiKey: '', models: p.models.join('\n'), enabled: p.enabled,
    })
    setFormError(null); setShowKey(false); setDialogOpen(true)
  }

  const meta = providerMeta(form.provider)

  async function submit() {
    if (!form.credentialName.trim()) { setFormError('凭证名称不能为空'); return }
    if (!editId && !form.apiKey) { setFormError('API Key 不能为空'); return }
    if (meta?.needsBaseUrl && !form.baseUrl.trim()) { setFormError('该供应商需填写 Base URL'); return }
    setSubmitting(true); setFormError(null)
    const models = form.models.split('\n').map((m) => m.trim()).filter(Boolean)
    try {
      if (editId) {
        const body: Record<string, unknown> = {
          credentialName: form.credentialName.trim(), baseUrl: form.baseUrl.trim(), models, enabled: form.enabled,
        }
        if (form.apiKey) body.apiKey = form.apiKey  // 留空=不改 Key
        await apiFetch(`/api/model-providers/${editId}`, { method: 'PATCH', body: JSON.stringify(body) })
        toast.success('供应商已更新')
      } else {
        await apiFetch('/api/model-providers', {
          method: 'POST',
          body: JSON.stringify({
            provider: form.provider, credentialName: form.credentialName.trim(),
            baseUrl: form.baseUrl.trim() || null, apiKey: form.apiKey, models,
          }),
        })
        toast.success('供应商已添加')
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleEnabled(p: ProviderMasked, enabled: boolean) {
    setProviders((prev) => prev.map((x) => x.id === p.id ? { ...x, enabled } : x))  // 乐观更新
    try {
      await apiFetch(`/api/model-providers/${p.id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) })
    } catch (e) {
      setProviders((prev) => prev.map((x) => x.id === p.id ? { ...x, enabled: !enabled } : x))  // 回滚
      toast.error(e instanceof Error ? e.message : '启停失败')
    }
  }

  async function remove(p: ProviderMasked) {
    if (!confirm(`确认删除供应商「${p.credentialName}」？此操作为软删除。`)) return
    try {
      await apiFetch(`/api/model-providers/${p.id}`, { method: 'DELETE' })
      toast.success('已删除')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  async function testConn(p: ProviderMasked) {
    setTests((t) => ({ ...t, [p.id]: { loading: true } }))
    try {
      const { result } = await apiFetch<{ result: { ok: boolean; message: string; models?: string[]; deferred?: boolean } }>(
        `/api/model-providers/${p.id}/test`, { method: 'POST' },
      )
      setTests((t) => ({ ...t, [p.id]: { loading: false, ok: result.ok, message: result.message } }))
      if (result.ok) toast.success(`连通正常：${result.message}`)
      else toast[result.deferred ? 'info' : 'error'](result.message)
    } catch (e) {
      const message = e instanceof Error ? e.message : '测试失败'
      setTests((t) => ({ ...t, [p.id]: { loading: false, ok: false, message } }))
      toast.error(message)
    }
  }

  // ── 默认模型 5 槽 ───────────────────────────────────────────────
  const slotOptions = providers
    .filter((p) => p.enabled)
    .flatMap((p) => p.models.map((m) => ({ value: `${p.id}${SLOT_SEP}${m}`, label: `${providerLabel(p.provider)} · ${m}` })))

  function setSlot(key: SlotKey, value: string) {
    setSettings((s) => {
      const next = { ...s }
      if (!value) { delete next[key]; return next }
      const [providerId, model] = value.split(SLOT_SEP)
      next[key] = { providerId, model }
      return next
    })
  }
  const slotValue = (key: SlotKey) => {
    const slot = settings[key]
    return slot ? `${slot.providerId}${SLOT_SEP}${slot.model}` : ''
  }

  async function saveSettings() {
    setSavingSettings(true)
    try {
      await apiFetch('/api/model-providers/settings', { method: 'PUT', body: JSON.stringify({ settings }) })
      toast.success('默认模型已保存')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />加载模型供应商...
      </div>
    )
  }
  if (forbidden) return null  // 非 Admin 不显示本区块

  return (
    <div className="space-y-6" data-testid="model-providers-view">
      {/* 供应商列表 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <CardTitle className="text-base text-foreground">模型供应商</CardTitle>
            </div>
            <Button size="sm" className="gap-2" data-testid="add-provider" onClick={openCreate}>
              <Plus className="h-4 w-4" />添加供应商
            </Button>
          </div>
          <CardDescription>配置本租户的模型供应商与 API Key（加密存储，仅显示后 4 位）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {providers.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              还没有配置任何供应商，点击右上角「添加供应商」开始。
            </div>
          )}
          {providers.map((p) => {
            const t = tests[p.id]
            const deferred = providerMeta(p.provider)?.deferred
            return (
              <div key={p.id} data-testid="provider-row" data-provider-id={p.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Cpu className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground truncate">{p.credentialName}</span>
                    <Badge variant="outline" className="text-[10px]">{providerLabel(p.provider)}</Badge>
                    {!p.enabled && <Badge className="text-[10px] bg-muted text-muted-foreground">已禁用</Badge>}
                    {deferred && <Badge className="text-[10px] bg-warning/10 text-warning">适配待 4.7.5</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span className="font-mono">{p.keyMasked}</span>
                    {p.baseUrl && <span className="truncate">· {p.baseUrl}</span>}
                    <span>· {p.models.length} 个模型</span>
                  </div>
                  {t && !t.loading && (
                    <p className={`text-[11px] mt-1 flex items-center gap-1 ${t.ok ? 'text-green-600' : 'text-destructive'}`}>
                      {t.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{t.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch checked={p.enabled} onCheckedChange={(v) => toggleEnabled(p, v)} aria-label="启停" />
                  <Button size="sm" variant="ghost" className="gap-1.5" disabled={t?.loading}
                    data-testid="test-provider" onClick={() => testConn(p)}>
                    {t?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}测试
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)} aria-label="编辑"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p)} aria-label="删除"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* 默认系统模型 5 槽 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">默认系统模型</CardTitle>
          <CardDescription>各能力的默认模型；未配置的能力运行时回退平台默认</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {slotOptions.length === 0 && (
            <p className="text-xs text-muted-foreground">先添加供应商并录入模型，才能在此选择默认模型。</p>
          )}
          {MODEL_SLOTS.map((slot) => (
            <div key={slot.key} className="grid grid-cols-[140px_1fr] items-center gap-3">
              <Label className="text-sm text-foreground">{slot.label}</Label>
              <Select value={slotValue(slot.key)} onValueChange={(v) => setSlot(slot.key, v === '__none__' ? '' : v)}
                disabled={slotOptions.length === 0}>
                <SelectTrigger data-testid={`slot-${slot.key}`}><SelectValue placeholder="未设置（回退平台默认）" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未设置（回退平台默认）</SelectItem>
                  {slotOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <Button size="sm" disabled={savingSettings || slotOptions.length === 0} onClick={saveSettings} className="gap-2">
              {savingSettings && <Loader2 className="h-3.5 w-3.5 animate-spin" />}保存默认模型
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 新增/编辑供应商弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? '编辑供应商' : '添加供应商'}</DialogTitle>
            <DialogDescription>Key 将加密存储，保存后仅显示后 4 位。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>供应商类型</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v as Form['provider'] })}
                disabled={!!editId}>
                <SelectTrigger data-testid="provider-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDER_CATALOG.map((c) => (
                    <SelectItem key={c.type} value={c.type}>{c.label}{c.deferred ? '（适配待 4.7.5）' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {meta?.hint && <p className="text-[11px] text-muted-foreground mt-1">{meta.hint}</p>}
            </div>
            <div>
              <Label htmlFor="mp-name">凭证名称 <span className="text-destructive">*</span></Label>
              <Input id="mp-name" value={form.credentialName} placeholder="如：通义主账号"
                onChange={(e) => setForm({ ...form, credentialName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="mp-base">Base URL {meta?.needsBaseUrl && <span className="text-destructive">*</span>}</Label>
              <Input id="mp-base" value={form.baseUrl} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="mp-key">API Key {!editId && <span className="text-destructive">*</span>}</Label>
              <div className="relative">
                <Input id="mp-key" type={showKey ? 'text' : 'password'} value={form.apiKey}
                  placeholder={editId ? '留空则不修改' : 'sk-...'}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="pr-9" />
                <button type="button" onClick={() => setShowKey((v) => !v)} aria-label="显示/隐藏"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="mp-models">模型清单（每行一个）</Label>
              <Textarea id="mp-models" rows={3} value={form.models} placeholder={'qwen-plus\nqwen-max\ntext-embedding-v4'}
                onChange={(e) => setForm({ ...form, models: e.target.value })} />
            </div>
            {editId && (
              <div className="flex items-center gap-2">
                <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
                <Label>启用</Label>
              </div>
            )}
            {meta?.deferred && (
              <p className="text-[11px] text-warning flex items-center gap-1"><Clock className="h-3 w-3" />该供应商原生适配待 4.7.5，连通性测试暂不可用</p>
            )}
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button disabled={submitting} onClick={submit} className="gap-2" data-testid="submit-provider">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}{editId ? '保存' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
