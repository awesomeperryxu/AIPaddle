'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { apiFetch } from '@/lib/api/client'
import { Loader2, ShieldAlert } from 'lucide-react'

// V12-4.3 / V12-4.4：API 与 DB 两类 Plugin 的 Binding 配置对话框。
//
// 🔴 这里的校验只是**即时提示**，不是防线。真正的强制在服务端
// （lib/plugins/binding.ts）——直接 POST 就绕过了本文件的一切。
// 之所以还在前端写一遍，是为了让人在提交前就看见问题，而不是提交后吃个 400。

const splitList = (s: string): string[] =>
  s.split(/[\s,，\n]+/).map((x) => x.trim()).filter(Boolean)

// ── OpenAPI 导入（V12-4.3）────────────────────────────────────────────

export function OpenApiImportDialog({
  pluginId, open, onOpenChange, onDone,
}: {
  pluginId: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const [docText, setDocText] = useState('')
  const [hosts, setHosts] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{
    imported: number; total: number; failed: { name: string; reason: string }[]
  } | null>(null)

  async function submit() {
    let document: unknown
    try {
      document = JSON.parse(docText)
    } catch {
      toast.error('不是合法的 JSON —— 若手上是 YAML 格式的 OpenAPI，请先转成 JSON')
      return
    }
    setBusy(true)
    try {
      const r = await apiFetch<{
        imported: number; total: number; failed: { name: string; reason: string }[]
      }>(`/api/plugins/${pluginId}/import-openapi`, {
        method: 'POST',
        body: JSON.stringify({
          document, allowedHosts: splitList(hosts), baseUrl: baseUrl.trim() || undefined,
        }),
      })
      if (r) {
        setResult(r)
        // 🔴 部分失败时不报「导入成功」。服务端如实回了 failed，
        // 前端再用一句成功提示盖过去，等于白记
        if (r.failed.length > 0) toast.warning(`导入 ${r.imported}/${r.total} 个，${r.failed.length} 个失败`)
        else toast.success(`已导入 ${r.imported} 个 Tool（草稿态）`)
        onDone()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导入失败')
    } finally {
      setBusy(false)
    }
  }

  function close(o: boolean) {
    if (!o) { setDocText(''); setHosts(''); setBaseUrl(''); setResult(null) }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>导入 OpenAPI 文档</DialogTitle>
          <DialogDescription>
            按 operation 拆分为多个 Tool，均为草稿态，需逐个提交审核后才能被调用。
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <p>共 {result.total} 个 operation，成功导入 <strong>{result.imported}</strong> 个。</p>
            {result.failed.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/30">
                <p className="mb-2 font-medium text-amber-800 dark:text-amber-300">
                  以下 {result.failed.length} 个未能导入：
                </p>
                <ul className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
                  {result.failed.map((f) => (
                    <li key={f.name}><span className="font-mono">{f.name}</span> —— {f.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="oa-hosts">域名白名单</Label>
              <Input id="oa-hosts" value={hosts} onChange={(e) => setHosts(e.target.value)}
                placeholder="api.example.com，多个用逗号或换行分隔" />
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  必填。Tool 只能请求白名单内的域名——留空会被拒绝。
                  文档里 servers 的域名也必须在其中，否则「导入一份 OpenAPI」就成了绕过白名单的口子。
                </span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oa-base">接口基地址（选填）</Label>
              <Input id="oa-base" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1" />
              <p className="text-xs text-muted-foreground">
                默认取文档里的 servers[0].url。若文档写的是相对地址（如 <code>/v1</code>）
                或含未定义默认值的变量，就必须在这里补全。
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oa-doc">OpenAPI 文档（JSON）</Label>
              <Textarea id="oa-doc" value={docText} onChange={(e) => setDocText(e.target.value)}
                rows={10} className="font-mono text-xs" placeholder='{"openapi":"3.0.0","servers":[...],"paths":{...}}' />
              <p className="text-xs text-muted-foreground">
                请粘贴文档内容。平台不会代为拉取 URL —— 由服务端去请求任意地址存在 SSRF 风险。
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => close(false)}>完成</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => close(false)}>取消</Button>
              <Button onClick={submit} disabled={busy || !docText.trim() || !hosts.trim()}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}导入
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── DB 查询 Tool（V12-4.4）────────────────────────────────────────────

/** 与服务端同源的即时提示。判定以服务端为准，这里只求早点让人看见。 */
function sqlHint(q: string): string | null {
  const s = q.trim()
  if (!s) return null
  if (!/^\s*(select|with)\b/i.test(s)) return '查询必须以 SELECT 或 WITH 开头'
  if (/\b(insert|update|delete|drop|truncate|alter|create|grant|revoke)\b/i.test(s)) {
    return '查询中含写操作关键字'
  }
  if (s.replace(/;\s*$/, '').includes(';')) return '不允许多条语句'
  return null
}

export function DbToolDialog({
  pluginId, open, onOpenChange, onDone,
}: {
  pluginId: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [query, setQuery] = useState('')
  const [tables, setTables] = useState('')
  const [maxRows, setMaxRows] = useState('100')
  const [maskFields, setMaskFields] = useState('')
  const [busy, setBusy] = useState(false)

  const hint = sqlHint(query)

  async function submit() {
    setBusy(true)
    try {
      const tool = await apiFetch<{ tool: { id: string } }>('/api/tools', {
        method: 'POST',
        body: JSON.stringify({
          pluginId, name: name.trim(), displayName: displayName.trim() || undefined,
          bindingType: 'db', riskLevel: 'medium',
        }),
      })
      if (!tool?.tool?.id) return
      await apiFetch(`/api/tools/${tool.tool.id}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          version: '1.0.0',
          bindingConfig: {
            query_template: query,
            allowed_tables: splitList(tables),
            max_rows: Number(maxRows) || 100,
            mask_fields: splitList(maskFields),
          },
        }),
      })
      toast.success('查询 Tool 已创建（草稿态）')
      close(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      setBusy(false)
    }
  }

  function close(o: boolean) {
    if (!o) { setName(''); setDisplayName(''); setQuery(''); setTables(''); setMaskFields(''); setMaxRows('100') }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>新建查询 Tool</DialogTitle>
          <DialogDescription>
            以查询模板的形式把数据暴露为 Tool。<strong>仅支持只读查询</strong>。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="db-name">Tool 名称</Label>
              <Input id="db-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="query_recent_orders" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="db-display">显示名</Label>
              <Input id="db-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder="查询近期订单" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="db-query">查询模板</Label>
            <Textarea id="db-query" value={query} onChange={(e) => setQuery(e.target.value)}
              rows={5} className="font-mono text-xs"
              placeholder="select id, amount from orders where created_at > :since" />
            {hint && (
              <p className="flex items-center gap-1.5 text-xs text-red-600">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />{hint}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="db-tables">库表白名单</Label>
              <Input id="db-tables" value={tables} onChange={(e) => setTables(e.target.value)}
                placeholder="orders, customers" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="db-rows">行数上限</Label>
              <Input id="db-rows" type="number" min={1} max={1000} value={maxRows}
                onChange={(e) => setMaxRows(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="db-mask">脱敏字段</Label>
            <Input id="db-mask" value={maskFields} onChange={(e) => setMaskFields(e.target.value)}
              placeholder="phone, id_card（选填）" />
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                此处的 select-only 校验是纵深防御的一层，<strong>不能替代只读数据库账号</strong>。
                请确认本 Plugin 绑定的凭证使用的是只读账号——数据库侧的权限才是最终防线。
              </span>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>取消</Button>
          <Button onClick={submit}
            disabled={busy || !name.trim() || !query.trim() || !tables.trim() || !!hint}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
