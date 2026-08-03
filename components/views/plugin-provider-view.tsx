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
import { apiFetch } from '@/lib/api/client'
import {
  Plus, Loader2, ShieldAlert, ExternalLink, Wrench, Star, ChevronRight,
} from 'lucide-react'

// V12-4.1/4.2/4.3/4.4：Plugin 的三个 Provider 页共用本组件，靠 providerType 区分。
//
// 为什么不写三个组件：三页的骨架完全一致（列表 / 新建 / 状态流转 / 看 Tool），
// 差异只在文案与 Binding 配置的形状。复制三份会让「改一处忘两处」成为常态——
// 这类分裂在本项目已发生过（Skill 类型枚举读写混用即是一例）。

type ProviderType = 'mcp' | 'api' | 'db'
type PluginStatus = 'draft' | 'pending' | 'published' | 'offline'

type Plugin = {
  id: string; name: string; description: string
  providerType: ProviderType
  repo: string | null; license: string | null; docsUrl: string | null; stars: number | null
  status: PluginStatus; origin: 'user' | 'platform'; mandatory: boolean; createdAt: string
}
type Tool = {
  id: string; pluginId: string; name: string; displayName: string
  bindingType: string; riskLevel: 'low' | 'medium' | 'high'; status: PluginStatus
}

const META: Record<ProviderType, { title: string; desc: string; nameHint: string }> = {
  mcp: {
    title: 'MCP',
    desc: '接入 MCP Server，把它提供的工具变成平台内可调用的 Tool。',
    nameHint: '如：GitHub、Playwright、Slack',
  },
  api: {
    title: 'API',
    desc: '接入 HTTP API，按 operation 拆分为原子 Tool。',
    nameHint: '如：企业微信机器人、内部 CRM',
  },
  db: {
    title: 'DB',
    desc: '接入数据库，以查询模板的形式暴露为 Tool。仅只读账号、仅 select。',
    nameHint: '如：订单库只读、报表库',
  },
}

const STATUS_META: Record<PluginStatus, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'bg-muted text-muted-foreground' },
  pending: { label: '待审核', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40' },
  published: { label: '已发布', cls: 'bg-green-50 text-green-700 dark:bg-green-950/40' },
  offline: { label: '已下线', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800' },
}

// 与服务端 PLUGIN_TRANSITIONS 一致；服务端才是权威，这里只决定按钮怎么渲染
const ACTIONS: Record<PluginStatus, { action: string; label: string }[]> = {
  draft: [{ action: 'submit', label: '提交审核' }],
  pending: [{ action: 'approve', label: '审核通过' }, { action: 'reject', label: '驳回' }],
  published: [{ action: 'offline', label: '下线' }],
  offline: [{ action: 'online', label: '重新上线' }],
}

const RISK_META: Record<string, { label: string; cls: string }> = {
  low: { label: '低', cls: 'text-muted-foreground' },
  medium: { label: '中', cls: 'text-amber-600' },
  high: { label: '高', cls: 'text-red-600 font-medium' },
}

export function PluginProviderView({ providerType }: { providerType: ProviderType }) {
  const meta = META[providerType]
  const [items, setItems] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', repo: '', docsUrl: '' })

  // Tool 面板
  const [toolPanel, setToolPanel] = useState<Plugin | null>(null)
  const [tools, setTools] = useState<Tool[]>([])

  // 首屏加载写在 effect 里用 .then 链，不抽成 useCallback 再 await——
  // 后者会让 setState 落在 effect 的同步路径上，被 React 编译器判为可能触发级联渲染
  useEffect(() => {
    apiFetch<{ plugins: Plugin[] }>(`/api/plugins?providerType=${providerType}`)
      .then((d) => setItems(d?.plugins ?? []))
      .catch((e) => {
        if (e instanceof Error && /无权限|forbidden|403/i.test(e.message)) setForbidden(true)
        else toast.error(e instanceof Error ? e.message : '加载失败')
      })
      .finally(() => setLoading(false))
  }, [providerType])

  const reload = useCallback(async () => {
    try {
      const d = await apiFetch<{ plugins: Plugin[] }>(`/api/plugins?providerType=${providerType}`)
      setItems(d?.plugins ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载失败')
    }
  }, [providerType])

  async function handleCreate() {
    setBusy('create')
    try {
      await apiFetch('/api/plugins', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name, description: form.description,
          providerType,
          repo: form.repo || null, docsUrl: form.docsUrl || null,
        }),
      })
      toast.success('已创建，处于草稿态')
      setCreateOpen(false)
      setForm({ name: '', description: '', repo: '', docsUrl: '' })
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建失败')
    } finally { setBusy(null) }
  }

  async function handleTransition(p: Plugin, action: string) {
    setBusy(p.id)
    try {
      await apiFetch(`/api/plugins/${p.id}/transition`, {
        method: 'POST', body: JSON.stringify({ action }),
      })
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    } finally { setBusy(null) }
  }

  // Tool 白名单：停用即阻断新调用。服务端在下线时会检查依赖它的已发布 Skill，
  // 有依赖时回 409 + 受影响清单，这里把清单摊给用户再让其确认（V12-3.6）
  async function toggleTool(t: Tool, action: string) {
    setBusy(t.id)
    try {
      await apiFetch(`/api/tools/${t.id}/transition`, {
        method: 'POST', body: JSON.stringify({ action }),
      })
      if (toolPanel) await openTools(toolPanel)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '操作失败'
      // 服务端返回「有 N 个已发布 Skill 依赖」时，让用户确认后再带 confirm 重试
      if (/依赖/.test(msg) && window.confirm(`${msg}\n\n确定继续停用？`)) {
        try {
          await apiFetch(`/api/tools/${t.id}/transition`, {
            method: 'POST', body: JSON.stringify({ action, confirm: true }),
          })
          if (toolPanel) await openTools(toolPanel)
        } catch (e2) {
          toast.error(e2 instanceof Error ? e2.message : '操作失败')
        }
      } else {
        toast.error(msg)
      }
    } finally { setBusy(null) }
  }

  async function openTools(p: Plugin) {
    setToolPanel(p); setTools([])
    try {
      const d = await apiFetch<{ tools: Tool[] }>(`/api/tools?pluginId=${p.id}`)
      setTools(d?.tools ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载 Tool 失败')
    }
  }

  if (forbidden) {
    return (
      <div className="p-8">
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ShieldAlert className="h-8 w-8 mx-auto mb-3 opacity-50" />
          无权限查看 Plugin。
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium">Plugin · {meta.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{meta.desc}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid={`create-plugin-${providerType}`}>
          <Plus className="h-4 w-4 mr-2" />新建 {meta.title} Plugin
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              还没有 {meta.title} Plugin。点击右上角新建。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => {
                  const st = STATUS_META[p.status]
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.name}</span>
                          {p.origin === 'platform' && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">平台</Badge>
                          )}
                          {typeof p.stars === 'number' && p.stars > 0 && (
                            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                              <Star className="h-3 w-3" />{(p.stars / 1000).toFixed(1)}k
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.repo ? (
                          <span className="flex items-center gap-1">
                            {p.repo}
                            {p.docsUrl && (
                              <a href={p.docsUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell><Badge className={st.cls}>{st.label}</Badge></TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => openTools(p)}>
                          <Wrench className="h-4 w-4 mr-1" />Tool
                        </Button>
                        {ACTIONS[p.status].map((a) => (
                          <Button key={a.action} variant="outline" size="sm"
                            disabled={busy === p.id} onClick={() => handleTransition(p, a.action)}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建 {meta.title} Plugin</DialogTitle>
            <DialogDescription>
              创建后为草稿态，需提交审核并发布后，其下的 Tool 才能被 Skill 或 Agent 依赖。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="p-name">名称</Label>
              <Input id="p-name" value={form.name} placeholder={meta.nameHint}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc">说明</Label>
              <Input id="p-desc" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {providerType === 'mcp' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="p-repo">上游仓库</Label>
                  <Input id="p-repo" value={form.repo} placeholder="microsoft/playwright-mcp"
                    onChange={(e) => setForm({ ...form, repo: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-docs">文档地址</Label>
                  <Input id="p-docs" value={form.docsUrl} placeholder="https://github.com/..."
                    onChange={(e) => setForm({ ...form, docsUrl: e.target.value })} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={busy === 'create' || !form.name.trim()}>
              {busy === 'create' ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Tool 列表 ── */}
      <Dialog open={!!toolPanel} onOpenChange={(o) => { if (!o) setToolPanel(null) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{toolPanel?.name} · 提供的 Tool</DialogTitle>
            <DialogDescription>
              一个 Plugin 可提供多个 Tool。只有<strong>已发布</strong>的 Tool 才能被 Skill 依赖与调用。
            </DialogDescription>
          </DialogHeader>
          {tools.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">该 Plugin 下暂无 Tool。</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead>Binding</TableHead>
                    <TableHead>风险</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">白名单</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tools.map((t) => {
                    const risk = RISK_META[t.riskLevel] ?? RISK_META.low
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm font-mono">{t.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.bindingType}</TableCell>
                        <TableCell className={`text-xs ${risk.cls}`}>
                          {risk.label}
                          {/* 高风险 Tool 调用需人工确认（PRD §14）——这是运行时流程，不是权限 */}
                          {t.riskLevel === 'high' && <span className="ml-1 text-[10px]">需人工确认</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_META[t.status].cls}>{STATUS_META[t.status].label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {/* Tool 白名单（V12-4.2）：用发布状态表达「是否允许被调用」，
                              不另造一个 enabled 字段——两套开关必然出现「已发布但被禁用」
                              这种没人说得清的状态 */}
                          {t.status === 'published' ? (
                            <Button variant="ghost" size="sm" disabled={busy === t.id}
                              onClick={() => toggleTool(t, 'offline')}>停用</Button>
                          ) : t.status === 'offline' ? (
                            <Button variant="ghost" size="sm" disabled={busy === t.id}
                              onClick={() => toggleTool(t, 'online')}>启用</Button>
                          ) : (
                            <Button variant="ghost" size="sm" disabled={busy === t.id}
                              onClick={() => toggleTool(t, 'submit')}>提交审核</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
