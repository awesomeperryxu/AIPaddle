'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api/client';
import { Users, Plus, Trash2, Pencil, CheckCircle2 } from 'lucide-react';

// 4.1.19 / ADR-014：数字员工团队 = 多个数字员工的扁平组合（最多 1 级）。
// 成员选择只列数字员工；越权/非数字员工由后端拒并回带 rejected。
type Team = { id: string; name: string; description: string; status: string; memberIds: string[]; updatedAt: string };
type DE = { id: string; name: string; department: string; avatar: string };

const statusLabel: Record<string, string> = { draft: '草稿', pending: '待审核', published: '已发布', offline: '已下线' };

export function DigitalEmployeeTeamsPanel({
  digitalEmployees,
  canManage = false,
}: {
  digitalEmployees: DE[];
  canManage?: boolean;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const deById = new Map(digitalEmployees.map((d) => [d.id, d]));

  const load = useCallback(async () => {
    const res = await apiFetch<{ teams: Team[] }>('/api/teams').catch(() => ({ teams: [] as Team[] }));
    setTeams(res.teams);
  }, []);
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ teams: Team[] }>('/api/teams')
      .then((data) => { if (!cancelled) setTeams(data.teams); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // 创建团队
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim()) { setCreateErr('名称不能为空'); return; }
    setCreating(true);
    setCreateErr(null);
    try {
      await apiFetch('/api/teams', { method: 'POST', body: JSON.stringify({ name: newName.trim() }) });
      setCreateOpen(false);
      setNewName('');
      await load();
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  // 编辑成员
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  function openEdit(team: Team) {
    setEditTeam(team);
    setSelected(new Set(team.memberIds));
    setNotice('');
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSaveMembers() {
    if (!editTeam) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ team: Team; rejected: { id: string; reason: string }[] }>(
        `/api/teams/${editTeam.id}`,
        { method: 'PATCH', body: JSON.stringify({ memberIds: [...selected] }) },
      );
      if (res.rejected?.length) {
        setNotice(res.rejected.map((r) => r.reason).join('；'));
      } else {
        setEditTeam(null);
      }
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(team: Team) {
    if (!window.confirm(`确定删除团队「${team.name}」？（软删除）`)) return;
    try {
      await apiFetch(`/api/teams/${team.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除失败');
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-foreground">数字员工团队</h2>
            <p className="text-xs text-muted-foreground">多个数字员工的扁平组合（最多 1 级，成员须为数字员工）</p>
          </div>
        </div>
        {canManage && (
          <Button size="sm" className="gap-2" onClick={() => { setCreateOpen(true); setCreateErr(null); }}>
            <Plus className="h-4 w-4" />
            创建团队
          </Button>
        )}
      </div>

      {/* 创建团队弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建数字员工团队</DialogTitle></DialogHeader>
          {createErr && <p className="text-sm text-red-500">{createErr}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="team-name">团队名称</Label>
            <Input id="team-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例如：售后服务团队" />
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={creating}>{creating ? '创建中...' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 团队列表 */}
      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : teams.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            还没有团队{canManage ? '，点击右上角「创建团队」新建' : ''}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {teams.map((team) => (
            <Card key={team.id} className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground truncate">{team.name}</h3>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{statusLabel[team.status] ?? team.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{team.memberIds.length} 名数字员工</p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(team)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(team)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {team.memberIds.slice(0, 6).map((mid) => (
                    <Badge key={mid} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {deById.get(mid)?.name ?? mid.slice(0, 8)}
                    </Badge>
                  ))}
                  {team.memberIds.length === 0 && <span className="text-xs text-muted-foreground">暂无成员</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 编辑成员弹窗 */}
      <Dialog open={!!editTeam} onOpenChange={(o) => { if (!o) setEditTeam(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑团队成员 · {editTeam?.name}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">仅可选「数字员工」（引用了子 Agent 的 Agent）。非数字员工/越权者由服务端拒绝。</p>
          {notice && <p className="text-sm text-amber-600">{notice}</p>}
          <div className="max-h-72 overflow-y-auto space-y-1">
            {digitalEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">当前租户还没有数字员工，请先在上方创建含子 Agent 的 Agent。</p>
            ) : (
              digitalEmployees.map((de) => {
                const on = selected.has(de.id);
                return (
                  <button
                    key={de.id}
                    onClick={() => toggle(de.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                      on ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'
                    }`}
                  >
                    <span className="text-lg">{de.avatar}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">{de.name}</span>
                      <span className="block text-xs text-muted-foreground truncate">{de.department}</span>
                    </span>
                    {on && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveMembers} disabled={saving}>{saving ? '保存中...' : '保存成员'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
