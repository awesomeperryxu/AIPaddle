'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { apiFetch } from '@/lib/api/client'
import { Key, CheckCircle2, Ban, Building2, Puzzle, ShieldAlert, Search } from 'lucide-react'

export type PlatformApiKey = {
  id: string; name: string; keyPrefix: string; scope: string
  status: 'active' | 'revoked'; lastUsedAt: string | null; createdAt: string
  expiresAt: string | null
  orgId: string; orgName: string; orgStatus: string
  extensionId: string | null; extensionName: string | null
}

const SCOPE_LABEL: Record<string, string> = {
  agent: 'Agent 调用', readonly: '只读（用量/账单）', full: '全部权限',
}

export function PlatformKeysView({ initialKeys }: { initialKeys: PlatformApiKey[] }) {
  const [keys, setKeys] = useState(initialKeys)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const nActive = keys.filter((k) => k.status === 'active').length
  const nOrgs = new Set(keys.map((k) => k.orgId)).size
  const nBound = keys.filter((k) => k.extensionId).length

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return keys
    return keys.filter((k) =>
      [k.orgName, k.name, k.keyPrefix, k.extensionName ?? ''].some((v) => v.toLowerCase().includes(s)),
    )
  }, [keys, q])

  async function handleRevoke(k: PlatformApiKey) {
    if (!window.confirm(
      `确认吊销「${k.orgName}」的 Key「${k.name}」？\n\n吊销后该租户的接入方立即调用失败，且不可恢复。`,
    )) return
    setBusy(k.id)
    try {
      await apiFetch(`/api/platform/keys/${k.id}`, { method: 'DELETE' })
      setKeys((prev) => prev.map((x) => (x.id === k.id ? { ...x, status: 'revoked' as const } : x)))
      toast.success('已吊销')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '吊销失败')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6" data-testid="platform-keys-view">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Key 管理</h1>
          <p className="text-muted-foreground">全平台跨租户清点、审计与吊销对外 API 密钥</p>
        </div>
        <Badge variant="outline" className="shrink-0 gap-1.5 text-xs">
          <ShieldAlert className="h-3.5 w-3.5" />平台超管视角
        </Badge>
      </div>

      {/* 口径说明：不写清楚，运营会以为这页能帮客户找回密钥 */}
      <div className="flex items-start gap-2.5 rounded-lg border border-warning/20 bg-warning/5 p-3">
        <ShieldAlert className="h-4 w-4 text-warning mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground font-medium">此处看不到密钥明文，平台超管也不行</span>
          ——库内只存 sha256 哈希与前 15 位前缀，明文仅在签发那一刻返回过一次。
          客户遗失密钥只能<span className="text-foreground">重新签发</span>，无法找回。本页用于清点、审计与吊销。
          <br />
          {/* 不放签发按钮：跨租户代签的归属与责任不清，且租户侧本就有自助入口 */}
          签发新 Key 请由该租户管理员在自己的「Key 管理」或「扩展管理 → 密钥」中操作。
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat icon={<Key className="h-5 w-5 text-primary" />} bg="bg-primary/10" n={keys.length} label="全平台 Key" />
        <Stat icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} bg="bg-green-500/10" n={nActive} label="生效中" />
        <Stat icon={<Building2 className="h-5 w-5 text-accent" />} bg="bg-accent/10" n={nOrgs} label="涉及租户" />
        <Stat icon={<Puzzle className="h-5 w-5 text-chart-3" />} bg="bg-chart-3/10" n={nBound} label="绑定扩展" />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="搜索租户 / Key 名称 / 前缀 / 扩展"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">租户</TableHead>
                <TableHead className="text-muted-foreground">名称 / Key</TableHead>
                <TableHead className="text-muted-foreground">类型 / 所属</TableHead>
                <TableHead className="text-muted-foreground">权限范围</TableHead>
                <TableHead className="text-muted-foreground">最近使用</TableHead>
                <TableHead className="text-muted-foreground">状态</TableHead>
                <TableHead className="text-muted-foreground text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {keys.length === 0 ? '全平台尚无任何 API Key' : '没有匹配的 Key'}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((k) => (
                <TableRow key={k.id} className="border-border" data-testid="platform-key-row">
                  <TableCell>
                    <p className="text-sm text-foreground">{k.orgName}</p>
                    {k.orgStatus === 'suspended' && (
                      <span className="text-xs text-destructive">租户已停用 · Key 实际不可用</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{k.keyPrefix}</p>
                  </TableCell>
                  <TableCell>
                    {k.extensionId ? (
                      <div className="flex items-center gap-1.5">
                        <Puzzle className="h-3.5 w-3.5 text-accent shrink-0" />
                        <span className="text-sm text-foreground truncate max-w-[12rem]">{k.extensionName}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">租户通用</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-muted text-foreground">{SCOPE_LABEL[k.scope] ?? k.scope}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{k.lastUsedAt ?? '尚未使用'}</TableCell>
                  <TableCell>
                    <Badge className={k.status === 'active'
                      ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}>
                      {k.status === 'active' ? '生效中' : '已吊销'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {k.status === 'active' ? (
                      <Button variant="outline" size="sm" disabled={busy === k.id}
                        className="h-7 text-destructive border-destructive/35 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRevoke(k)}>
                        <Ban className="h-3.5 w-3.5 mr-1" />吊销
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
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
