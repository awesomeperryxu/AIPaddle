'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Plus, Key, CheckCircle2, Ban, Loader2, Copy, Puzzle, Building2 } from 'lucide-react'

type ApiKeyScope = 'agent' | 'readonly' | 'full'
type ApiKeyMasked = {
  id: string; name: string; keyPrefix: string; scope: ApiKeyScope
  status: 'active' | 'revoked'; lastUsedAt: string | null; createdAt: string
  // Key-1：区分归属——extensionId 为空 = 租户通用 Key，有值 = 绑定某扩展
  extensionId: string | null; extensionName: string | null
}

const SCOPE_LABEL: Record<ApiKeyScope, string> = {
  agent: 'Agent 调用', readonly: '只读（用量/账单）', full: '全部权限',
}
const statusConfig = {
  active: { label: '生效中', className: 'bg-green-500/10 text-green-500' },
  revoked: { label: '已吊销', className: 'bg-destructive/10 text-destructive' },
} as const

type KeysResponse = { keys: ApiKeyMasked[]; orgName: string | null }

export function KeysView() {
  const [keys, setKeys] = useState<ApiKeyMasked[]>([])
  const [orgName, setOrgName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newScope, setNewScope] = useState<ApiKeyScope>('agent')
  const [creating, setCreating] = useState(false)
  const [issued, setIssued] = useState<string | null>(null) // 签发后一次性明文

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<KeysResponse>('/api/keys')
      setKeys(data.keys); setOrgName(data.orgName)
    } catch (e) {
      if (e instanceof Error && /无权限|forbidden|403/i.test(e.message)) setForbidden(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    apiFetch<KeysResponse>('/api/keys')
      .then((d) => { setKeys(d.keys); setOrgName(d.orgName) })
      .catch((e) => { if (e instanceof Error && /无权限|forbidden|403/i.test(e.message)) setForbidden(true) })
      .finally(() => setLoading(false))
  }, [])

  const nTotal = keys.length
  const nActive = keys.filter((k) => k.status === 'active').length
  const nRevoked = keys.length - nActive
  const nBound = keys.filter((k) => k.extensionId).length

  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success('已复制到剪贴板') }
    catch { toast.error('复制失败，请手动选择复制') }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const { key } = await apiFetch<{ key: string; apiKey: ApiKeyMasked }>('/api/keys', {
        method: 'POST', body: JSON.stringify({ name: newName.trim(), scope: newScope }),
      })
      setCreateOpen(false)
      setNewName(''); setNewScope('agent')
      setIssued(key)        // 打开「一次性明文」弹窗
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('确认吊销该 Key？吊销后立即失效，不可恢复。')) return
    try {
      await apiFetch(`/api/keys/${id}`, { method: 'DELETE' })
      toast.success('已吊销')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '吊销失败')
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground py-10"><Loader2 className="h-4 w-4 animate-spin" />加载中...</div>
  }
  if (forbidden) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">无访问权限</h2>
          <p className="text-sm text-muted-foreground">仅 Admin 可管理对外 API Key</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="keys-view">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Key 管理</h1>
          <p className="text-muted-foreground">签发与管理对外 API 密钥（明文仅签发时显示一次）</p>
          {/* Key-1：明确标注归属租户——本页只列本租户 Key，多租户切换时不至于张冠李戴 */}
          {orgName && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              当前租户：<span className="text-foreground">{orgName}</span>
              <span className="text-muted-foreground/70">· 仅显示本租户 Key</span>
            </p>
          )}
        </div>
        <Button className="gap-2" data-testid="create-key" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />创建 Key
        </Button>
      </div>

      {/* 真实统计 */}
      <div className="grid grid-cols-4 gap-4">
        <Stat icon={<Key className="h-5 w-5 text-primary" />} bg="bg-primary/10" n={nTotal} label="全部 Key" />
        <Stat icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} bg="bg-green-500/10" n={nActive} label="生效中" />
        <Stat icon={<Ban className="h-5 w-5 text-destructive" />} bg="bg-destructive/10" n={nRevoked} label="已吊销" />
        <Stat icon={<Puzzle className="h-5 w-5 text-accent" />} bg="bg-accent/10" n={nBound} label="绑定扩展" />
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">名称 / Key</TableHead>
                <TableHead className="text-muted-foreground">类型 / 所属</TableHead>
                <TableHead className="text-muted-foreground">权限范围</TableHead>
                <TableHead className="text-muted-foreground">最近使用</TableHead>
                <TableHead className="text-muted-foreground">创建时间</TableHead>
                <TableHead className="text-muted-foreground">状态</TableHead>
                <TableHead className="text-muted-foreground text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">还没有 API Key，点击右上角创建</TableCell></TableRow>
              )}
              {keys.map((k) => (
                <TableRow key={k.id} className="border-border" data-testid="key-row">
                  <TableCell>
                    <p className="font-medium text-foreground">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{k.keyPrefix}</p>
                  </TableCell>
                  <TableCell>
                    {k.extensionId ? (
                      <div className="flex items-center gap-1.5" title={`绑定扩展：${k.extensionName ?? ''}`}>
                        <Puzzle className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span className="text-sm text-foreground truncate max-w-[12rem]">{k.extensionName}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">租户通用</span>
                    )}
                  </TableCell>
                  <TableCell><Badge className="bg-muted text-foreground">{SCOPE_LABEL[k.scope]}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{k.lastUsedAt ?? '尚未使用'}</TableCell>
                  <TableCell className="text-muted-foreground">{k.createdAt}</TableCell>
                  <TableCell><Badge className={statusConfig[k.status].className}>{statusConfig[k.status].label}</Badge></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {k.status === 'active' ? (
                      <Button variant="outline" size="sm"
                        className="h-7 text-destructive border-destructive/35 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRevoke(k.id)}>吊销</Button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 创建 Key */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建 API Key</DialogTitle>
            <DialogDescription>签发后明文只显示一次，请立即复制保存。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="key-name">名称</Label>
              <Input id="key-name" value={newName} placeholder="如：CRM 集成" onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <Label>权限范围</Label>
              <Select value={newScope} onValueChange={(v) => setNewScope(v as ApiKeyScope)}>
                <SelectTrigger data-testid="key-scope"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCOPE_LABEL) as ApiKeyScope[]).map((s) => (
                    <SelectItem key={s} value={s}>{SCOPE_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button disabled={creating || !newName.trim()} onClick={handleCreate} className="gap-2" data-testid="submit-key">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}签发
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 一次性明文展示 */}
      <Dialog open={!!issued} onOpenChange={(o) => { if (!o) setIssued(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Key 已签发</DialogTitle>
            <DialogDescription className="text-destructive">此明文仅显示这一次，关闭后无法再次查看，请立即复制保存。</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <code className="flex-1 text-sm font-mono break-all" data-testid="issued-key">{issued}</code>
            <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => issued && copyText(issued)}>
              <Copy className="h-3.5 w-3.5" />复制
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setIssued(null)}>我已保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ icon, bg, n, label }: { icon: React.ReactNode; bg: string; n: number; label: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>{icon}</div>
          <div>
            <p className="text-lg font-semibold text-foreground">{n}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
