'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Agent } from '@/lib/mock-data';
import { apiFetch } from '@/lib/api/client';
import {
  Search,
  MessageSquare,
  Send,
  Paperclip,
  Phone,
  MessagesSquare,
  Clock,
  ChevronRight,
  Plus,
  Users,
  Bot,
  Edit2,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

// 彩色首字头像（与 agents-admin 对齐）
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-orange-400',
  'bg-emerald-500', 'bg-rose-500', 'bg-cyan-600', 'bg-amber-500',
];
function getAvatarBg(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

type Team = {
  id: string;
  name: string;
  description: string;
  status: string;
  memberIds: string[];
  updatedAt: string;
};

export function AgentsView({
  agents,
  digitalEmployeeIds = [],
  canManage = false,
}: {
  agents?: Agent[];
  digitalEmployeeIds?: string[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'de' | 'teams'>('de');

  // ── 数字员工 Tab 状态 ──
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sending, setSending] = useState(false);

  // ── 创建数字员工 Dialog 状态 ──
  const [createDeOpen, setCreateDeOpen] = useState(false);
  const [deBaseId, setDeBaseId] = useState('');
  const [deSubIds, setDeSubIds] = useState<string[]>([]);
  const [deCreating, setDeCreating] = useState(false);
  const [deError, setDeError] = useState('');
  const [deSuccess, setDeSuccess] = useState(false);

  // ── 团队 Tab 状态 ──
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // ── 创建/编辑团队 Dialog 状态 ──
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamError, setTeamError] = useState('');

  const allAgents = agents ?? [];
  const deIdSet = new Set(digitalEmployeeIds);

  // 🔴 区分数字员工与数字团队：
  // 数字团队 = 在 digitalEmployeeIds 里的（引用了子 Agent 的上级，如「内容创作专家团」）
  // 数字员工 = 已发布但不是团队上级的普通 Agent（如「文博凯」「律守正」）
  const digitalTeams = allAgents.filter(a => deIdSet.has(a.id));
  const digitalEmployees = allAgents.filter(a => !deIdSet.has(a.id));
  // 可选为 base 的 Agent（建团队时的候选）
  const baseAgentCandidates = allAgents.filter(a => !deIdSet.has(a.id));

  const filteredDe = digitalEmployees.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── 团队加载 ──
  function loadTeams() {
    setTeamsLoading(true);
    apiFetch<{ teams: Team[] }>('/api/teams')
      .then(res => setTeams(res.teams ?? []))
      .catch(() => {})
      .finally(() => setTeamsLoading(false));
  }

  useEffect(() => {
    if (activeTab !== 'teams') return;
    let cancelled = false;
    apiFetch<{ teams: Team[] }>('/api/teams')
      .then(res => { if (!cancelled) setTeams(res.teams ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setTeamsLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab]);

  // ── 切换 Agent（聊天） ──
  function selectAgent(agent: Agent) {
    setSelectedAgent(agent);
    setMessages([]);
    setMessage('');
  }

  async function handleSend(text?: string) {
    const content = (text ?? message).trim();
    if (!content || sending || !selectedAgent) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setMessage('');
    setSending(true);
    try {
      const res = await apiFetch<{ reply: string }>(`/api/agents/${selectedAgent.id}/chat`, {
        method: 'POST',
        body: JSON.stringify({ messages: next }),
      });
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : '对话失败'}` }]);
    } finally {
      setSending(false);
    }
  }

  // ── 创建数字员工 ──
  function openCreateDe() {
    setDeBaseId('');
    setDeSubIds([]);
    setDeError('');
    setDeSuccess(false);
    setCreateDeOpen(true);
  }

  async function handleCreateDe() {
    if (!deBaseId) { setDeError('请选择一个基础 Agent'); return; }
    if (deSubIds.length === 0) { setDeError('请至少选择一个子 Agent'); return; }
    setDeCreating(true);
    setDeError('');
    try {
      // 读取当前资源（保留 kb/skill/mcp/tool），仅覆盖 subAgentIds。
      // 🔴 PUT 是覆盖语义：漏带任何一类，那类已绑的资源就被清空。
      // 加 toolIds 时这里必须同步，否则「建数字员工」会静默清掉已绑的 Tool。
      const current = await apiFetch<{ resources: { knowledgeBaseIds: string[]; skillIds: string[]; mcpServerIds: string[]; toolIds?: string[] } }>(
        `/api/agents/${deBaseId}/resources`
      );
      await apiFetch(`/api/agents/${deBaseId}/resources`, {
        method: 'PUT',
        body: JSON.stringify({
          knowledgeBaseIds: current.resources.knowledgeBaseIds,
          skillIds: current.resources.skillIds,
          mcpServerIds: current.resources.mcpServerIds,
          toolIds: current.resources.toolIds ?? [],
          source: 'digital-employee', subAgentIds: deSubIds,
        }),
      });
      setDeSuccess(true);
      setTimeout(() => {
        setCreateDeOpen(false);
        // 刷新页面获取最新 digitalEmployeeIds（由服务端计算）
        window.location.reload();
      }, 1200);
    } catch (e) {
      setDeError(e instanceof Error ? e.message : '创建失败，请重试');
    } finally {
      setDeCreating(false);
    }
  }

  function toggleDeSubId(id: string) {
    setDeSubIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // ── 团队 Dialog ──
  function openCreateTeam() {
    setEditingTeam(null);
    setTeamName('');
    setTeamDesc('');
    setTeamMemberIds([]);
    setTeamError('');
    setTeamDialogOpen(true);
  }

  function openEditTeam(team: Team) {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamDesc(team.description);
    setTeamMemberIds(team.memberIds);
    setTeamError('');
    setTeamDialogOpen(true);
  }

  async function handleSaveTeam() {
    if (!teamName.trim()) { setTeamError('团队名称不能为空'); return; }
    setTeamSaving(true);
    setTeamError('');
    try {
      if (editingTeam) {
        await apiFetch(`/api/teams/${editingTeam.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: teamName, description: teamDesc, memberIds: teamMemberIds }),
        });
      } else {
        const created = await apiFetch<{ team: Team }>('/api/teams', {
          method: 'POST',
          body: JSON.stringify({ name: teamName }),
        });
        if (teamMemberIds.length > 0) {
          await apiFetch(`/api/teams/${created.team.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ description: teamDesc, memberIds: teamMemberIds }),
          });
        }
      }
      setTeamDialogOpen(false);
      loadTeams();
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : '保存失败，请重试');
    } finally {
      setTeamSaving(false);
    }
  }

  async function handleDeleteTeam(id: string, name: string) {
    if (!confirm(`确认删除团队「${name}」？`)) return;
    try {
      await apiFetch(`/api/teams/${id}`, { method: 'DELETE' });
      loadTeams();
    } catch {
      // 静默
    }
  }

  function toggleMember(id: string) {
    setTeamMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // ──────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-0">
      {/* 页头 + Tab */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground">数字员工</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理数字员工及其团队</p>
        </div>
        {canManage && (
          activeTab === 'de' ? (
            <Button size="sm" className="gap-1.5" onClick={openCreateDe}>
              <Plus className="h-4 w-4" />
              创建数字员工
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={openCreateTeam}>
              <Plus className="h-4 w-4" />
              创建团队
            </Button>
          )
        )}
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'de' | 'teams')} className="flex-shrink-0 mb-4">
        <TabsList className="h-9">
          <TabsTrigger value="de" className="gap-1.5 text-sm px-4">
            <Bot className="h-3.5 w-3.5" />
            数字员工 ({digitalEmployees.length})
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1.5 text-sm px-4">
            <Users className="h-3.5 w-3.5" />
            数字团队 ({digitalTeams.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── 数字员工 Tab ── */}
      {activeTab === 'de' && (
        <div className="flex flex-1 gap-5 min-h-0">
          {/* 左侧列表 */}
          <div className={`flex flex-col ${selectedAgent ? 'w-72' : 'flex-1'} min-h-0`}>
            {/* Search */}
            <div className="relative mb-4 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索数字员工..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-card border-border h-9"
              />
            </div>

            {/* 最近使用（未选中时） */}
            {!selectedAgent && digitalEmployees.length > 0 && (
              <div className="mb-4 flex-shrink-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">最近使用</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {digitalEmployees.slice(0, 3).map((agent) => (
                    <button
                      key={agent.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors shrink-0"
                      onClick={() => selectAgent(agent)}
                    >
                      <span className={`w-6 h-6 rounded-full ${getAvatarBg(agent.name)} text-white text-[11px] font-bold flex items-center justify-center`}>
                        {agent.name[0]}
                      </span>
                      <span className="text-sm text-foreground">{agent.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 空状态 */}
            {filteredDe.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16">
                <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {searchTerm ? '没有匹配的数字员工' : '暂无数字员工'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {!searchTerm && canManage && '点击「创建数字员工」将 Agent 升格为数字员工'}
                  </p>
                </div>
              </div>
            )}

            {/* Agent Grid/List */}
            <div className={`flex-1 overflow-y-auto ${selectedAgent ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start'}`}>
              {filteredDe.map((agent) => (
                <Card
                  key={agent.id}
                  className={`bg-card border-border cursor-pointer transition-all hover:shadow-md ${
                    selectedAgent?.id === agent.id ? 'ring-2 ring-primary shadow-md' : 'shadow-sm'
                  }`}
                  onClick={() => selectAgent(agent)}
                >
                  <CardContent className={`${selectedAgent ? 'p-3' : 'p-4'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`${selectedAgent ? 'w-9 h-9 text-sm' : 'w-11 h-11 text-base'} rounded-xl ${getAvatarBg(agent.name)} text-white font-bold flex items-center justify-center shrink-0`}>
                        {agent.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium text-foreground truncate ${selectedAgent ? 'text-sm' : ''}`}>{agent.name}</h3>
                        <p className={`text-muted-foreground ${selectedAgent ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'}`}>{agent.description}</p>
                        {!selectedAgent && (
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{agent.department}</Badge>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {agent.calls.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                      {selectedAgent
                        ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        : canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                              <button className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                              <DropdownMenuItem onSelect={() => router.push(`/agent-schedules/new?agentId=${agent.id}`)}>
                                <Clock className="h-4 w-4 mr-2" />
                                配置定时执行
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )
                      }
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* 右侧聊天区 */}
          {selectedAgent && (
            <div className="flex-1 flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              {/* 聊天头部 */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${getAvatarBg(selectedAgent.name)} text-white text-sm font-bold flex items-center justify-center`}>
                    {selectedAgent.name[0]}
                  </div>
                  <div>
                    <h2 className="text-sm font-medium text-foreground">{selectedAgent.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{selectedAgent.department}</Badge>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        在线
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    本地CC
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5">
                    <MessagesSquare className="h-3.5 w-3.5" />
                    企微
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    历史
                  </Button>
                </div>
              </div>

              {/* 消息区 */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className={`${getAvatarBg(selectedAgent.name)} text-white text-xs font-bold`}>
                      {selectedAgent.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-[75%]">
                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border rounded-tl-sm">
                      <p className="text-sm text-foreground leading-relaxed">
                        你好！我是{selectedAgent.name}。{selectedAgent.description}
                        <br /><br />
                        有什么可以帮助你的吗？
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">刚刚</p>
                  </div>
                </div>

                {messages.map((msg, index) => (
                  <div
                    key={index}
                    data-testid={msg.role === 'assistant' ? 'chat-message-assistant' : undefined}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={
                        msg.role === 'user'
                          ? 'bg-primary/10 text-primary text-xs'
                          : `${getAvatarBg(selectedAgent.name)} text-white text-xs font-bold`
                      }>
                        {msg.role === 'user' ? '你' : selectedAgent.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                      <div className={`p-3.5 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted/40 border border-border rounded-tl-sm'
                      }`}>
                        <p className={`text-sm whitespace-pre-wrap leading-relaxed ${
                          msg.role === 'user' ? 'text-primary-foreground' : 'text-foreground'
                        }`}>{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={`${getAvatarBg(selectedAgent.name)} text-white text-xs font-bold`}>
                        {selectedAgent.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border rounded-tl-sm">
                      <p className="text-sm text-muted-foreground">正在思考…</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 输入区 */}
              <div className="p-4 border-t border-border bg-muted/10">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <Input
                      aria-label="输入消息"
                      placeholder={`向 ${selectedAgent.name} 提问...`}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                      }}
                      disabled={sending}
                      className="pr-10 py-5 bg-background border-border"
                    />
                    <Button variant="ghost" size="icon" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    aria-label="发送"
                    className="h-10 w-10 rounded-lg shadow-sm"
                    onClick={() => handleSend()}
                    disabled={sending || !message.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 数字团队 Tab ── */}
      {activeTab === 'teams' && (
        <div className="flex-1 overflow-y-auto">
          {digitalTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">暂无数字团队</p>
                {canManage && <p className="text-xs text-muted-foreground mt-1">数字团队由多个数字员工组成，点击「创建团队」</p>}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
              {digitalTeams.map((team) => {
                // 团队的成员 = 它引用的子 Agent（从 digitalEmployees 里匹配）
                // 这里暂用同 department 的个体 Agent 作为成员显示（与导入时的绑定逻辑一致）
                const memberAgents = digitalEmployees.filter(a => a.department === team.department);
                const isExpanded = expandedTeamId === team.id;
                return (
                  <Card key={team.id} className="bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/agents-admin/${team.id}`)}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shrink-0`}>
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {team.department && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{team.department}</span>}
                        </div>
                      </div>
                      <h3 className="font-semibold text-foreground leading-snug mb-1 line-clamp-1">{team.name}</h3>
                      <p className="text-xs text-primary/80 font-medium mb-1">{memberAgents.length} 名数字员工</p>
                      {team.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{team.description}</p>
                      )}

                      {/* 成员展开 */}
                      {memberAgents.length > 0 && (
                        <div className="mt-3">
                          <button
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            成员列表
                          </button>
                          {isExpanded && (
                            <div className="mt-2 flex flex-col gap-1.5">
                              {memberAgents.map(a => (
                                <div key={a.id} className="flex items-center gap-2">
                                  <div className={`w-5 h-5 rounded-full ${getAvatarBg(a.name)} text-white text-[10px] font-bold flex items-center justify-center`}>
                                    {a.name[0]}
                                  </div>
                                  <span className="text-xs text-foreground">{a.name}</span>
                                  <span className="text-[10px] text-muted-foreground">{a.department}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 创建数字员工 Dialog ── */}
      <Dialog open={createDeOpen} onOpenChange={setCreateDeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>创建数字员工</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {deSuccess ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <span className="text-green-500 text-xl">✓</span>
                </div>
                <p className="text-sm font-medium text-foreground">创建成功！页面即将刷新…</p>
              </div>
            ) : (
              <>
                {/* 选 base Agent */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">选择基础 Agent</label>
                  <p className="text-xs text-muted-foreground mb-2">选择一个已发布的 Agent 将其升格为数字员工</p>
                  <select
                    className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={deBaseId}
                    onChange={e => { setDeBaseId(e.target.value); setDeSubIds([]); }}
                  >
                    <option value="">— 请选择 —</option>
                    {baseAgentCandidates.map(a => (
                      <option key={a.id} value={a.id}>{a.name}（{a.department}）</option>
                    ))}
                  </select>
                  {baseAgentCandidates.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">所有已发布的 Agent 均已是数字员工</p>
                  )}
                </div>

                {/* 选 sub-agents */}
                {deBaseId && (
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">选择子 Agent</label>
                    <p className="text-xs text-muted-foreground mb-2">子 Agent 不能是数字员工（仅 1 层嵌套），服务端将自动校验</p>
                    <div className="max-h-48 overflow-y-auto border border-border rounded-md divide-y divide-border">
                      {allAgents.filter(a => a.id !== deBaseId).map(a => (
                        <label key={a.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-primary"
                            checked={deSubIds.includes(a.id)}
                            onChange={() => toggleDeSubId(a.id)}
                          />
                          <div className={`w-6 h-6 rounded-full ${getAvatarBg(a.name)} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
                            {a.name[0]}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm text-foreground">{a.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{a.department}</span>
                          </div>
                        </label>
                      ))}
                      {allAgents.filter(a => a.id !== deBaseId).length === 0 && (
                        <div className="px-3 py-4 text-xs text-muted-foreground text-center">暂无其他可用的 Agent</div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">已选 {deSubIds.length} 个</p>
                  </div>
                )}

                {deError && <p className="text-xs text-destructive">{deError}</p>}
              </>
            )}
          </div>
          {!deSuccess && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDeOpen(false)} disabled={deCreating}>取消</Button>
              <Button onClick={handleCreateDe} disabled={deCreating || !deBaseId || deSubIds.length === 0}>
                {deCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {deCreating ? '创建中…' : '确认创建'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 创建/编辑团队 Dialog ── */}
      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTeam ? '编辑团队' : '创建团队'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">团队名称 *</label>
              <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="输入团队名称" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">描述</label>
              <Input value={teamDesc} onChange={e => setTeamDesc(e.target.value)} placeholder="（可选）描述团队职责" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">成员（仅限数字员工）</label>
              {digitalEmployees.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">暂无可用的数字员工，请先创建数字员工</p>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-border rounded-md divide-y divide-border">
                  {digitalEmployees.map(a => (
                    <label key={a.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={teamMemberIds.includes(a.id)}
                        onChange={() => toggleMember(a.id)}
                      />
                      <div className={`w-6 h-6 rounded-full ${getAvatarBg(a.name)} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
                        {a.name[0]}
                      </div>
                      <span className="text-sm text-foreground">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{a.department}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">已选 {teamMemberIds.length} 名成员</p>
            </div>
            {teamError && <p className="text-xs text-destructive">{teamError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamDialogOpen(false)} disabled={teamSaving}>取消</Button>
            <Button onClick={handleSaveTeam} disabled={teamSaving || !teamName.trim()}>
              {teamSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {teamSaving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
