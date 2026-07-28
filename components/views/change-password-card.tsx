'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api/client'
import { KeyRound } from 'lucide-react'

/**
 * 4.8.18c：用户自行修改密码。
 * 4.8.18 起账号由创建人指定初始密码，没有这个入口的话初始密码会长期不变——
 * 那才是真正的风险，所以它是「创建时指定密码」的必要配套，而非可选项。
 */
export function ChangePasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function handleSubmit() {
    if (busy) return
    setErr(null); setOk(false)
    if (!current) { setErr('请输入原密码'); return }
    if (next !== confirm) { setErr('两次输入的新密码不一致'); return }

    setBusy(true)
    try {
      await apiFetch('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      setCurrent(''); setNext(''); setConfirm('')
      setOk(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '修改失败')
    } finally { setBusy(false) }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          修改密码
        </CardTitle>
        <CardDescription>
          账号由管理员创建时设置了初始密码，建议首次登录后立即修改
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="pwd-current">原密码</Label>
          <Input id="pwd-current" type="password" value={current} onChange={e => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pwd-new">新密码</Label>
          <Input id="pwd-new" type="password" value={next} onChange={e => setNext(e.target.value)}
                 placeholder="至少 8 位，含字母/数字/符号中至少两类" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pwd-confirm">确认新密码</Label>
          <Input id="pwd-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        {ok && <p className="text-xs text-green-500">密码已更新，下次登录请使用新密码</p>}
        <Button onClick={handleSubmit} disabled={busy}>
          {busy ? '提交中…' : '更新密码'}
        </Button>
      </CardContent>
    </Card>
  )
}
