'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { MessagesSquare, Plus, Send, AtSign, Bot, User } from 'lucide-react';

// 4.1.21 / ADR-015：数字员工群聊（多方：人 + 数字员工/团队）。
// 建群只列本租户数字员工/团队；越权成员由后端剔除回带 rejected。
// 发言分「@定向(mention)」与「主动(proactive)」，前端只展示后端裁定结果。
type DE = { id: string; name: string; department: string; avatar: string };
type Team = { id: string; name: string };
type GroupBasic = { id: string; name: string; createdAt: string; updatedAt: string };
type Msg = {
  id: string;
  role: string;
  content: string;
  speakerType: 'user' | 'agent' | null;
  speakerId: string | null;
  reason: 'mention' | 'proactive' | null;
  createdAt: string;
};

export function GroupChatPanel({
  digitalEmployees,
  canManage = false,
}: {
  digitalEmployees: DE[];
  canManage?: boolean;
}) {
  const [groups, setGroups] = useState<GroupBasic[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [pickedAgents, setPickedAgents] = useState<Set<string>>(new Set());
  const [pickedTeams, setPickedTeams] = useState<Set<string>>(new Set());

  const deById = new Map(digitalEmployees.map((d) => [d.id, d]));
  const endRef = useRef<HTMLDivElement>(null);

  const loadGroups = useCallback(() => {
    apiFetch<{ groups: GroupBasic[] }>('/api/groups')
      .then((res) => setGroups(res.groups))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ groups: GroupBasic[] }>('/api/groups')
      .then((d) => { if (!cancelled) setGroups(d.groups); })
      .catch(() => {});
    apiFetch<{ teams: Team[] }>('/api/teams')
      .then((d) => { if (!cancelled) setTeams(d.teams); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    apiFetch<{ messages: Msg[] }>(`/api/groups/${activeId}/messages`)
      .then((d) => { if (!cancelled) setMessages(d.messages); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function createGroup() {
    const participants = [
      ...[...pickedAgents].map((id) => ({ type: 'agent', id })),
      ...[...pickedTeams].map((id) => ({ type: 'team', id })),
    ];
    const res = await apiFetch<{ group: GroupBasic; rejected: { reason: string }[] }>('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name: newName, participants }),
    }).catch(() => null);
    if (!res) return;
    if (res.rejected?.length) alert(`部分成员被剔除：\n${res.rejected.map((r) => r.reason).join('\n')}`);
    setCreateOpen(false);
    setNewName('');
    setPickedAgents(new Set());
    setPickedTeams(new Set());
    await loadGroups();
    setActiveId(res.group.id);
  }

  async function send() {
    if (!activeId || !input.trim() || sending) return;
    setSending(true);
    try {
      const res = await apiFetch<{ messages: Msg[] }>(`/api/groups/${activeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: input.trim() }),
      });
      setMessages((prev) => [...prev, ...res.messages]);
      setInput('');
    } catch (e) {
      alert(e instanceof Error ? e.message : '发送失败');
    } finally {
      setSending(false);
    }
  }

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  return (
    <Card className="mt-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">数字员工群聊</h2>
            <Badge variant="secondary" className="text-xs">4.1.21</Badge>
          </div>
          {canManage && (
            <Button size="sm" className="gap-1" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> 新建群聊
            </Button>
          )}
        </div>

        <div className="flex gap-4" style={{ minHeight: 320 }}>
          {/* 群列表 */}
          <div className="w-48 shrink-0 border-r pr-3 space-y-1 overflow-y-auto">
            {groups.length === 0 && <p className="text-xs text-muted-foreground">暂无群聊</p>}
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveId(g.id)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm truncate ${activeId === g.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
              >
                {g.name}
              </button>
            ))}
          </div>

          {/* 消息流 */}
          <div className="flex-1 flex flex-col min-w-0">
            {!activeId ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">选择或新建一个群聊</div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ maxHeight: 280 }}>
                  {messages.map((m) => {
                    const isAgent = m.speakerType === 'agent';
                    const de = m.speakerId ? deById.get(m.speakerId) : undefined;
                    return (
                      <div key={m.id} className={`flex gap-2 ${isAgent ? '' : 'flex-row-reverse'}`}>
                        <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${isAgent ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                          {isAgent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </div>
                        <div className={`max-w-[75%] ${isAgent ? '' : 'text-right'}`}>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                            <span>{isAgent ? de?.name ?? '数字员工' : '我'}</span>
                            {m.reason && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {m.reason === 'mention' ? '@定向' : '主动'}
                              </Badge>
                            )}
                          </div>
                          <div className={`inline-block px-3 py-1.5 rounded-lg text-sm whitespace-pre-wrap ${isAgent ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="输入消息，@ 数字员工可定向唤醒"
                  />
                  <Button size="icon" variant="outline" title="@ 提及" onClick={() => setInput((v) => v + '@')}>
                    <AtSign className="h-4 w-4" />
                  </Button>
                  <Button size="icon" onClick={send} disabled={sending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>

      {/* 建群对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建数字员工群聊</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">群名</Label>
              <Input id="group-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如：售后作战群" />
            </div>
            <div className="space-y-1.5">
              <Label>数字员工</Label>
              <div className="flex flex-wrap gap-2">
                {digitalEmployees.length === 0 && <p className="text-xs text-muted-foreground">暂无数字员工</p>}
                {digitalEmployees.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggle(pickedAgents, d.id, setPickedAgents)}
                    className={`px-2.5 py-1 rounded-full text-xs border ${pickedAgents.has(d.id) ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
            {teams.length > 0 && (
              <div className="space-y-1.5">
                <Label>数字员工团队</Label>
                <div className="flex flex-wrap gap-2">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggle(pickedTeams, t.id, setPickedTeams)}
                      className={`px-2.5 py-1 rounded-full text-xs border ${pickedTeams.has(t.id) ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={createGroup} disabled={!newName.trim() || pickedAgents.size + pickedTeams.size === 0}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
