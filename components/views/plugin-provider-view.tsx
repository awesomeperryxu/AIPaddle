'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { apiFetch } from '@/lib/api/client'
import { getAvatarBg, STATUS_PILL } from '@/lib/ui/entity-visuals'
import { OpenApiImportDialog, DbToolDialog } from '@/components/views/plugin-binding-dialogs'
import {
  Plus, Loader2, ShieldAlert, ExternalLink, Wrench, Star, FileJson, PlugZap,
  Search, MoreHorizontal, Play, Pause, XCircle,
} from 'lucide-react'

// V12-4.1/4.2/4.3/4.4：Plugin 的三个 Provider 页共用本组件，靠 providerType 区分。
//
// 为什么不写三个组件：三页的骨架完全一致（列表 / 新建 / 状态流转 / 看 Tool），
// 差异只在文案与 Binding 配置的形状。复制三份会让「改一处忘两处」成为常态——
// 这类分裂在本项目已发生过（Skill 类型枚举读写混用即是一例）。

type ProviderType = 'mcp' | 'api' | 'db' | 'smtp'
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
  smtp: {
    title: 'SMTP',
    desc: '接入邮件服务器，以模板的形式暴露发信 Tool。连接参数与密码全部存凭证，不进 Binding 配置。',
    nameHint: '如：腾讯企业邮、阿里云邮推送',
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

// 流转动作图标：与 Agent 管理页的三点菜单同一套（下线=暂停、驳回=叉、其余=播放）
function actionIcon(action: string) {
  if (action === 'offline') return <Pause className="h-4 w-4 mr-2" />
  if (action === 'reject') return <XCircle className="h-4 w-4 mr-2" />
  return <Play className="h-4 w-4 mr-2" />
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

  // 搜索 + 状态筛选（与 Agent 管理页同一套交互）
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  // Tool 面板
  const [toolPanel, setToolPanel] = useState<Plugin | null>(null)
  const [importOpen, setImportOpen] = useState(false)   // V12-4.3 OpenAPI 导入
  const [dbToolOpen, setDbToolOpen] = useState(false)   // V12-4.4 DB 查询 Tool
  // V12-4.5 连通性测试结果，按 Tool id 存
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({})
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

  /**
   * V12-4.5：对该 Tool 的最新版本发起一次真实调用。
   * 版本在服务端取不到时如实提示，不假装"没版本=测通了"。
   */
  async function runTest(t: Tool) {
    setTesting(t.id)
    try {
      const vs = await apiFetch<{ versions: { id: string }[] }>(`/api/tools/${t.id}/versions`)
      const versionId = vs?.versions?.[0]?.id
      if (!versionId) {
        setTestResults((s) => ({ ...s, [t.id]: { ok: false, message: '该 Tool 尚无版本，无连接配置可测' } }))
        return
      }
      const r = await apiFetch<{ result: { ok: boolean; message: string; elapsedMs: number } }>(
        `/api/tools/${t.id}/test`, { method: 'POST', body: JSON.stringify({ versionId }) })
      if (r?.result) {
        setTestResults((s) => ({
          ...s, [t.id]: { ok: r.result.ok, message: `${r.result.message}（${r.result.elapsedMs}ms）` },
        }))
        if (r.result.ok) toast.success(r.result.message)
        else toast.error(r.result.message)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '测试失败'
      setTestResults((s) => ({ ...s, [t.id]: { ok: false, message: msg } }))
      toast.error(msg)
    } finally {
      setTesting(null)
    }
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

  const filtered = items.filter((p) => {
    const kw = searchTerm.toLowerCase()
    const matchesSearch =
      p.name.toLowerCase().includes(kw) ||
      (p.description ?? '').toLowerCase().includes(kw) ||
      (p.repo ?? '').toLowerCase().includes(kw)
    if (activeTab !== 'all') return matchesSearch && p.status === activeTab
    return matchesSearch
  })

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Plugin · {meta.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{meta.desc}</p>
        </div>
        <Button className="gap-1.5 shadow-sm" onClick={() => setCreateOpen(true)}
          data-testid={`create-plugin-${providerType}`}>
          <Plus className="h-4 w-4" />新建 {meta.title} Plugin
        </Button>
      </div>

      {/* ── Search + Status Tabs ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`搜索 ${meta.title} Plugin 名称或说明...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3">全部</TabsTrigger>
            <TabsTrigger value="published" className="text-xs px-3">已发布</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs px-3">待审核</TabsTrigger>
            <TabsTrigger value="draft" className="text-xs px-3">草稿</TabsTrigger>
            <TabsTrigger value="offline" className="text-xs px-3">已下线</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Plugin 卡片网格 ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16">
            {items.length === 0 ? `还没有 ${meta.title} Plugin。点击右上角新建。` : '没有符合条件的 Plugin'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p) => {
              const sc = STATUS_PILL[p.status] ?? STATUS_PILL.draft
              const actions = ACTIONS[p.status] ?? []
              return (
                <div
                  key={p.id}
                  className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer flex flex-col"
                  onClick={() => openTools(p)}
                  data-testid="plugin-card"
                  data-plugin-name={p.name}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0 ${getAvatarBg(p.name)}`}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.pillClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dotClass}`} />{sc.label}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onSelect={() => openTools(p)}>
                            <Wrench className="h-4 w-4 mr-2" />查看 Tool
                          </DropdownMenuItem>
                          {actions.map((a) => (
                            <DropdownMenuItem key={a.action} disabled={busy === p.id}
                              onSelect={(e) => { e.preventDefault(); void handleTransition(p, a.action) }}>
                              {actionIcon(a.action)}
                              {busy === p.id ? '处理中...' : a.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <h3 className="font-semibold text-foreground leading-snug mb-1 line-clamp-1">{p.name}</h3>
                  {p.origin === 'platform' && (
                    <span className="text-xs text-primary/80 font-medium mb-1.5">平台内置</span>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-2 flex-1 mb-3">{p.description || '暂无描述'}</p>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                    {p.repo
                      ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground truncate">{p.repo}</span>
                      : <span />}
                    <span className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                      {typeof p.stars === 'number' && p.stars > 0 && (
                        <span className="flex items-center gap-0.5"><Star className="h-3 w-3" />{(p.stars / 1000).toFixed(1)}k</span>
                      )}
                      {p.docsUrl && (
                        <a href={p.docsUrl} target="_blank" rel="noreferrer"
                          onClick={(e) => e.stopPropagation()} className="hover:text-foreground">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
          {/* Binding 配置入口按 Provider 类型分流（V12-4.3 / V12-4.4）。
              MCP 的 Tool 由 Server 声明后同步，不在此手工建 */}
          {toolPanel && providerType === 'api' && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <FileJson className="mr-1 h-4 w-4" />导入 OpenAPI
              </Button>
            </div>
          )}
          {toolPanel && providerType === 'db' && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setDbToolOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />新建查询 Tool
              </Button>
            </div>
          )}

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
                    <TableHead>连通性</TableHead>
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
                        {/* V12-4.5：真实调用测试。结果就地显示，失败原因原文带出——
                            "测试失败"四个字帮不上任何忙 */}
                        <TableCell className="max-w-[220px]">
                          <Button variant="outline" size="sm" disabled={testing === t.id}
                            onClick={() => runTest(t)}>
                            {testing === t.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <PlugZap className="h-3.5 w-3.5" />}
                            <span className="ml-1">测试</span>
                          </Button>
                          {testResults[t.id] && (
                            <p className={`mt-1 text-[11px] leading-snug ${
                              testResults[t.id].ok ? 'text-green-600' : 'text-red-600'}`}>
                              {testResults[t.id].message}
                            </p>
                          )}
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

      {toolPanel && (
        <>
          <OpenApiImportDialog
            pluginId={toolPanel.id} open={importOpen} onOpenChange={setImportOpen}
            onDone={() => { void openTools(toolPanel) }}
          />
          <DbToolDialog
            pluginId={toolPanel.id} open={dbToolOpen} onOpenChange={setDbToolOpen}
            onDone={() => { void openTools(toolPanel) }}
          />
        </>
      )}
    </div>
  )
}
