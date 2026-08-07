'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { apiFetch } from '@/lib/api/client'
import { Plus, Globe, Key, Copy, Ban, Loader2, ShieldAlert } from 'lucide-react'

// V12-8.10：扩展能力管理页（PRD §6「扩展能力 → 扩展管理 / 凭证与调用日志」）。
//
// 这个页面管的是「把哪个内部资产、以什么治理条件、开放给谁」。
// 对外真正被调用的入口是 /api/ext/v1/*，不在本页。

type ExtStatus = 'draft' | 'pending' | 'published' | 'offline'
type Extension = {
  id: string; name: string; description: string
  targetType: 'agent' | 'workflow'; targetId: string; targetVersion: string | null
  allowedOrigins: string[]; rateLimitPerMin: number
  status: ExtStatus; hasServiceUser: boolean; createdAt: string
}
type ExtKey = {
  id: string; name: string; keyPrefix: string; scopes: string[]
  status: 'active' | 'revoked'; lastUsedAt: string | null; expiresAt: string | null; createdAt: string
}
type AgentLite = { id: string; name: string; status: string }

const STATUS_META: Record<ExtStatus, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'bg-muted text-muted-foreground' },
  pending: { label: '待审核', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40' },
  published: { label: '已发布', cls: 'bg-green-50 text-green-700 dark:bg-green-950/40' },
  offline: { label: '已下线', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800' },
}

// 当前状态下可执行的流转动作（与服务端 EXT_TRANSITIONS 一致；服务端才是权威）
const ACTIONS: Record<ExtStatus, { action: string; label: string }[]> = {
  draft: [{ action: 'submit', label: '提交审核' }],
  pending: [{ action: 'approve', label: '审核通过' }, { action: 'reject', label: '驳回' }],
  published: [{ action: 'offline', label: '下线' }],
  offline: [{ action: 'online', label: '重新上线' }],
}

export function ExtensionsView() {
  const [items, setItems] = useState<Extension[]>([])
  const [agents, setAgents] = useState<AgentLite[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  // 新建
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', targetId: '', origins: '', rate: '60' })

  // Key 管理
  const [keyPanel, setKeyPanel] = useState<Extension | null>(null)
  const [keys, setKeys] = useState<ExtKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [issued, setIssued] = useState<string | null>(null)

  // 🔴 BUG-101：编辑白名单/限流（此前只能在创建时填，创建后没有入口修改）
  const [editPanel, setEditPanel] = useState<Extension | null>(null)
  const [editOrigins, setEditOrigins] = useState('')
  const [editRate, setEditRate] = useState('60')

  // 刷新用（由用户操作触发，不在 effect 内同步调用）
  const reload = useCallback(async () => {
    try {
      const res = await apiFetch<{ extensions: Extension[] }>('/api/extensions')
      setItems(res?.extensions ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载失败')
    }
  }, [])

  // 首屏加载写在 effect 里用 .then 链，**不抽成 useCallback 再 await**——
  // 后者会让 setState 落在 effect 的同步执行路径上，被 React 编译器判为
  // 可能触发级联渲染（react-hooks/set-state-in-effect）。同类页面 keys-view 同款写法。
  useEffect(() => {
    apiFetch<{ extensions: Extension[] }>('/api/extensions')
      .then((d) => setItems(d?.extensions ?? []))
      .catch((e) => {
        if (e instanceof Error && /无权限|forbidden|403/i.test(e.message)) setForbidden(true)
        else toast.error(e instanceof Error ? e.message : '加载失败')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // 加载全部 Agent（列表需显示名称；编辑下拉只展示已发布的，但需认识已绑定的非发布态 Agent）
    apiFetch<{ agents: AgentLite[] }>('/api/agents')
      .then((r) => setAgents(r?.agents ?? []))
      .catch(() => { /* 目标列表拉不到不阻塞主流程，新建时会提示 */ })
  }, [])

  async function handleCreate() {
    const origins = form.origins.split('\n').map((s) => s.trim()).filter(Boolean)
    setBusy('create')
    try {
      await apiFetch('/api/extensions', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name, description: form.description,
          targetType: 'agent', targetId: form.targetId,
          allowedOrigins: origins,
          rateLimitPerMin: Number(form.rate) || 60,
        }),
      })
      toast.success('扩展能力已创建')
      setCreateOpen(false)
      setForm({ name: '', description: '', targetId: '', origins: '', rate: '60' })
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建失败')
    } finally { setBusy(null) }
  }

  const [editTargetId, setEditTargetId] = useState('')
  const [editMode, setEditMode] = useState(false)

  function openEdit(ext: Extension) {
    setEditPanel(ext)
    setEditOrigins(ext.allowedOrigins.join('\n'))
    setEditRate(String(ext.rateLimitPerMin))
    setEditTargetId(ext.targetId)
    setEditMode(false) // 默认只读
  }

  async function handleEdit() {
    if (!editPanel) return
    setBusy('edit')
    try {
      const origins = editOrigins.split('\n').map(s => s.trim()).filter(Boolean)
      await apiFetch(`/api/extensions/${editPanel.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          allowedOrigins: origins,
          rateLimitPerMin: Number(editRate) || 60,
          targetId: editTargetId || undefined,
        }),
      })
      toast.success('已更新（修改已记录日志）')
      setEditMode(false)
      setEditPanel(null)
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失败')
    } finally { setBusy(null) }
  }

  async function handleTransition(ext: Extension, action: string) {
    setBusy(ext.id)
    try {
      await apiFetch(`/api/extensions/${ext.id}/transition`, {
        method: 'POST', body: JSON.stringify({ action }),
      })
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    } finally { setBusy(null) }
  }

  async function openKeys(ext: Extension) {
    setKeyPanel(ext); setIssued(null); setKeys([])
    try {
      const r = await apiFetch<{ keys: ExtKey[] }>(`/api/extensions/${ext.id}/keys`)
      setKeys(r?.keys ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载密钥失败')
    }
  }

  async function handleIssueKey() {
    if (!keyPanel || !newKeyName.trim()) return
    setBusy('key')
    try {
      const r = await apiFetch<{ key: ExtKey; plaintext: string }>(
        `/api/extensions/${keyPanel.id}/keys`,
        { method: 'POST', body: JSON.stringify({ name: newKeyName.trim(), scopes: ['chat'] }) },
      )
      // 🔴 明文只在这一次响应里，关掉就再也拿不到
      setIssued(r?.plaintext ?? null)
      setNewKeyName('')
      await openKeysRefresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '签发失败')
    } finally { setBusy(null) }
  }

  async function openKeysRefresh() {
    if (!keyPanel) return
    const r = await apiFetch<{ keys: ExtKey[] }>(`/api/extensions/${keyPanel.id}/keys`)
    setKeys(r?.keys ?? [])
  }

  async function handleRevoke(keyId: string) {
    if (!keyPanel) return
    if (!window.confirm('撤销后该密钥立即失效，接入方将无法调用。确定撤销？')) return
    setBusy(keyId)
    try {
      await apiFetch(`/api/extensions/${keyPanel.id}/keys/${keyId}`, { method: 'DELETE' })
      toast.success('已撤销')
      await openKeysRefresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '撤销失败')
    } finally { setBusy(null) }
  }

  if (forbidden) {
    return (
      <div className="p-8">
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ShieldAlert className="h-8 w-8 mx-auto mb-3 opacity-50" />
          无权限查看扩展能力。该功能仅对管理员开放。
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium">扩展能力</h1>
          <p className="text-sm text-muted-foreground mt-1">
            把已发布的 Agent 开放为对外 API，供其他应用调用。调用方须持密钥且来源在白名单内。
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-extension">
          <Plus className="h-4 w-4 mr-2" />新建扩展
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              还没有扩展能力。点击「新建扩展」把一个已发布的 Agent 开放给外部应用。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>调用目标</TableHead>
                  <TableHead>来源白名单</TableHead>
                  <TableHead>限流</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((ext) => {
                  const st = STATUS_META[ext.status]
                  return (
                    <TableRow key={ext.id}>
                      <TableCell>
                        <div className="font-medium">{ext.name}</div>
                        {ext.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">{ext.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {agents.find((a) => a.id === ext.targetId)?.name ?? `未知 (${ext.targetId.slice(0, 8)}…)`}
                      </TableCell>
                      <TableCell>
                        {ext.allowedOrigins.length === 0 ? (
                          // 空白名单 = 拒绝所有跨域，必须显式提示，否则用户以为"没限制"
                          <Badge variant="outline" className="text-amber-700 border-amber-300">
                            未配置（拒绝所有跨域）
                          </Badge>
                        ) : (
                          <div className="text-xs space-y-0.5">
                            {ext.allowedOrigins.slice(0, 2).map((o) => (
                              <div key={o} className="flex items-center gap-1 text-muted-foreground">
                                <Globe className="h-3 w-3" />{o}
                              </div>
                            ))}
                            {ext.allowedOrigins.length > 2 && (
                              <div className="text-muted-foreground">+{ext.allowedOrigins.length - 2}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ext.rateLimitPerMin > 0 ? `${ext.rateLimitPerMin}/分钟` : '不限'}
                      </TableCell>
                      <TableCell>
                        <Badge className={st.cls}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(ext)}>
                          <Globe className="h-4 w-4 mr-1" />设置
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openKeys(ext)}>
                          <Key className="h-4 w-4 mr-1" />密钥
                        </Button>
                        {ACTIONS[ext.status].map((a) => (
                          <Button
                            key={a.action} variant="outline" size="sm"
                            disabled={busy === ext.id}
                            onClick={() => handleTransition(ext, a.action)}
                          >
                            {a.label}
                          </Button>
                        ))}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── 新建 ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建扩展能力</DialogTitle>
            <DialogDescription>
              把一个已发布的 Agent 开放为对外 API。创建后为草稿态，需提交审核并发布才能被调用。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ext-name">名称</Label>
              <Input id="ext-name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如：官网在线咨询" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-desc">说明</Label>
              <Input id="ext-desc" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-target">调用目标（仅已发布 Agent）</Label>
              <Select value={form.targetId} onValueChange={(v) => setForm({ ...form, targetId: v })}>
                <SelectTrigger id="ext-target">
                  <SelectValue placeholder={agents.filter(a => a.status === 'published').length ? '选择 Agent' : '暂无已发布的 Agent'} />
                </SelectTrigger>
                <SelectContent>
                  {agents.filter(a => a.status === 'published').map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-origins">来源白名单（每行一个）</Label>
              <Textarea id="ext-origins" rows={3} value={form.origins}
                onChange={(e) => setForm({ ...form, origins: e.target.value })}
                placeholder={'https://example.com\nhttps://www.example.com'} />
              <p className="text-xs text-muted-foreground">
                只填协议+域名（+端口），<strong>不要带路径</strong>——浏览器发出的 Origin 头本身不含路径，
                写了永远匹配不上。留空表示拒绝所有跨域来源。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-rate">限流（次/分钟）</Label>
              <Input id="ext-rate" type="number" value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={busy === 'create' || !form.name || !form.targetId}>
              {busy === 'create' ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 密钥管理 ── */}
      <Dialog open={!!keyPanel} onOpenChange={(o) => { if (!o) { setKeyPanel(null); setIssued(null) } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>密钥管理 · {keyPanel?.name}</DialogTitle>
            <DialogDescription>
              调用方需在请求头带 <code className="text-xs">Authorization: Bearer &lt;密钥&gt;</code>。
            </DialogDescription>
          </DialogHeader>

          {issued && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                请立即保存 —— 关闭后无法再次查看
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs break-all bg-background rounded px-2 py-1.5">{issued}</code>
                <Button size="sm" variant="outline"
                  onClick={() => { void navigator.clipboard.writeText(issued); toast.success('已复制') }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="密钥用途，如：官网生产环境" />
            <Button onClick={handleIssueKey} disabled={busy === 'key' || !newKeyName.trim()}>
              {busy === 'key' ? '签发中...' : '签发密钥'}
            </Button>
          </div>

          {/* Key-1：空列表也要渲染表格 + 空态。此前 keys.length > 0 才渲染，
              没签过 Key 时整块消失，与「加载失败」长得一模一样，用户无法自证。 */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>前缀</TableHead>
                <TableHead>最近使用</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {keys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                      该扩展尚未签发密钥 —— 在上方填写用途后点「签发密钥」
                    </TableCell>
                  </TableRow>
                )}
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="text-sm">{k.name}</TableCell>
                    <TableCell><code className="text-xs">{k.keyPrefix}</code></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{k.lastUsedAt ?? '未使用'}</TableCell>
                    <TableCell>
                      <Badge variant={k.status === 'active' ? 'default' : 'outline'}>
                        {k.status === 'active' ? '生效中' : '已撤销'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {k.status === 'active' && (
                        <Button variant="ghost" size="sm" disabled={busy === k.id}
                          onClick={() => handleRevoke(k.id)}>
                          <Ban className="h-4 w-4 mr-1" />撤销
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* 扩展能力设置面板（灰色只读 + 修改按钮切换编辑） */}
      <Dialog open={!!editPanel} onOpenChange={(o) => { if (!o) { setEditPanel(null); setEditMode(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editPanel?.name} · 设置</DialogTitle>
            <DialogDescription>查看和修改扩展能力配置。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 调用目标 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">调用目标</Label>
                {!editMode && <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setEditMode(true)}>修改</Button>}
              </div>
              {editMode ? (
                <Select value={editTargetId} onValueChange={setEditTargetId}>
                  <SelectTrigger><SelectValue placeholder="选择 Agent" /></SelectTrigger>
                  <SelectContent>
                    {agents
                      .filter(a => a.status === 'published' || a.id === editTargetId)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}{a.status !== 'published' ? ` (${a.status})` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-foreground bg-muted/50 rounded-md px-3 py-2">{agents.find((a) => a.id === editTargetId)?.name ?? editTargetId.slice(0, 12)}</p>
              )}
            </div>

            {/* 来源白名单 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">来源白名单</Label>
                {!editMode && <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setEditMode(true)}>修改</Button>}
              </div>
              {editMode ? (
                <>
                  <Textarea rows={4} value={editOrigins} onChange={(e) => setEditOrigins(e.target.value)}
                    placeholder={'https://www.example.com\n留空 = 仅允许服务端调用'} />
                  <p className="text-[11px] text-muted-foreground">
                    只填 协议+域名（如 https://example.com），不接受通配符。留空 = 仅允许服务端调用。
                  </p>
                </>
              ) : (
                <div className="text-sm bg-muted/50 rounded-md px-3 py-2 space-y-0.5">
                  {editOrigins ? editOrigins.split('\n').filter(Boolean).map((o, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-foreground"><Globe className="h-3 w-3 text-muted-foreground shrink-0" />{o}</div>
                  )) : <span className="text-amber-600 text-xs">未配置（拒绝所有跨域请求）</span>}
                </div>
              )}
            </div>

            {/* 限流 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">限流（次/分钟）</Label>
                {!editMode && <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setEditMode(true)}>修改</Button>}
              </div>
              {editMode ? (
                <Input type="number" value={editRate} onChange={(e) => setEditRate(e.target.value)} />
              ) : (
                <p className="text-sm text-foreground bg-muted/50 rounded-md px-3 py-2">{editRate} 次/分钟</p>
              )}
            </div>
          </div>
          <DialogFooter>
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)}>取消修改</Button>
                <Button onClick={handleEdit} disabled={busy === 'edit'}>
                  {busy === 'edit' ? '保存中...' : '保存'}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setEditPanel(null)}>关闭</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
