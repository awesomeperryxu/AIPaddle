'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api/client';
import {
  Send, Bot, User, Sparkles, Plus, Zap, FileText, Image as ImageIcon,
  Loader2, Trash2, MessageSquare,
} from 'lucide-react';

type Citation = { documentId: string; filename: string; snippet: string; similarity: number };
type Msg = { id: string; role: 'user' | 'assistant' | 'system'; content: string; citations: Citation[] };
type Conversation = { id: string; title: string; updatedAt: string };
type Res = { id: string; name: string };

// 快捷动作（切片1 暂不实现，置灰；切片3 接工具能力）
const QUICK_ACTIONS = [
  { icon: FileText, label: '总结文档' },
  { icon: Zap, label: '创建 Skill' },
  { icon: ImageIcon, label: '分析图片' },
];

export function AssistantView() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streamCitations, setStreamCitations] = useState<Citation[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // 切片3：@Agent / /Skill 资源调取
  const [resources, setResources] = useState<{ agents: Res[]; skills: Res[]; knowledgeBases: (Res & { documentCount?: number })[] }>({ agents: [], skills: [], knowledgeBases: [] });
  const [pickedAgent, setPickedAgent] = useState<Res | null>(null);
  const [pickedSkill, setPickedSkill] = useState<Res | null>(null);

  useEffect(() => {
    apiFetch<typeof resources>('/api/assistant/resources')
      .then(setResources)
      .catch(() => {});
  }, []);

  // 输入以 @ 或 / 开头时显示资源选择器
  const pickerMode: 'agent' | 'skill' | null =
    !pickedAgent && !pickedSkill && input.startsWith('@') ? 'agent'
      : !pickedAgent && !pickedSkill && input.startsWith('/') ? 'skill'
        : null;
  const pickerQuery = pickerMode ? input.slice(1).toLowerCase() : '';
  const pickerItems = pickerMode === 'agent'
    ? resources.agents.filter((a) => a.name.toLowerCase().includes(pickerQuery))
    : pickerMode === 'skill'
      ? resources.skills.filter((s) => s.name.toLowerCase().includes(pickerQuery))
      : [];

  const loadConversations = useCallback(async () => {
    try {
      const r = await apiFetch<{ conversations: Conversation[] }>('/api/assistant/conversations');
      setConversations(r.conversations);
      return r.conversations;
    } catch { return []; }
  }, []);

  useEffect(() => {
    loadConversations().then((cs) => { if (cs.length) setActiveId(cs[0].id); });
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    apiFetch<{ messages: Msg[] }>(`/api/assistant/conversations/${activeId}/messages`)
      .then((r) => setMessages(r.messages))
      .catch(() => setMessages([]));
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamText]);

  async function newConversation() {
    const r = await apiFetch<{ conversation: Conversation }>('/api/assistant/conversations', { method: 'POST' });
    setConversations((c) => [r.conversation, ...c]);
    setActiveId(r.conversation.id);
    setMessages([]);
  }

  async function deleteConversation(id: string) {
    if (!window.confirm('删除该会话？')) return;
    await apiFetch(`/api/assistant/conversations/${id}`, { method: 'DELETE' });
    setConversations((c) => c.filter((x) => x.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }

  async function ensureConversation(): Promise<string> {
    if (activeId) return activeId;
    const r = await apiFetch<{ conversation: Conversation }>('/api/assistant/conversations', { method: 'POST' });
    setConversations((c) => [r.conversation, ...c]);
    setActiveId(r.conversation.id);
    return r.conversation.id;
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const agent = pickedAgent, skill = pickedSkill;
    setInput('');
    setSending(true); setStreamText(''); setStreamCitations([]);
    const convId = await ensureConversation();
    const prefix = agent ? `@${agent.name} ` : skill ? `/${skill.name} ` : '';
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: prefix + text, citations: [] }]);
    try {
      const res = await fetch(`/api/assistant/conversations/${convId}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: text, agentId: agent?.id, skillId: skill?.id }),
      });
      if (!res.ok || !res.body) throw new Error('发送失败');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', full = '', cites: Citation[] = [];
      let redirect: { target: string; description: string } | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop() ?? '';
        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith('data:')) continue;
          const obj = JSON.parse(line.slice(5).trim());
          if (obj.type === 'citations') { cites = obj.citations; setStreamCitations(cites); }
          else if (obj.type === 'delta') { full += obj.text; setStreamText(full); }
          else if (obj.type === 'redirect') { redirect = { target: obj.target, description: obj.description }; }
          else if (obj.type === 'error') throw new Error(obj.message);
        }
      }
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: full, citations: cites }]);
      loadConversations();
      // 切片2：识别为创建意图 → 整页跳转创建页并预填描述
      if (redirect) {
        setTimeout(() => router.push(`${redirect!.target}?assistant=${encodeURIComponent(redirect!.description)}`), 700);
      }
    } catch (e) {
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : '发送失败'}`, citations: [] }]);
    } finally {
      setSending(false); setStreamText(''); setStreamCitations([]);
      setPickedAgent(null); setPickedSkill(null);
    }
  }

  const hasChat = messages.length > 0 || sending;

  return (
    <div className="flex h-full gap-6">
      {/* 会话历史 */}
      <div className="w-72 flex flex-col gap-4 min-h-0">
        <Button className="w-full gap-2" onClick={newConversation}>
          <Plus className="h-4 w-4" />新建对话
        </Button>
        <div className="space-y-2 overflow-y-auto min-h-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">历史会话</p>
          {conversations.length === 0 && <p className="px-2 text-xs text-muted-foreground">暂无会话，直接提问即可</p>}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group p-3 rounded-lg cursor-pointer transition-colors flex items-start gap-2 ${
                activeId === conv.id ? 'bg-primary/10 border border-primary/20' : 'bg-card hover:bg-muted/50'
              }`}
              onClick={() => setActiveId(conv.id)}
            >
              <MessageSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground truncate flex-1">{conv.title}</span>
              <button
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                aria-label="删除会话"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 主对话区 */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-medium text-foreground">个人助理</h2>
            <p className="text-xs text-muted-foreground">基于企业知识库的 AI 助理</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto py-6 space-y-6">
          {!hasChat && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">你好！我是你的 AI 助理</h2>
                <p className="text-muted-foreground">可就企业知识库内容提问，回答会带来源引用</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} citations={msg.citations} />
          ))}

          {sending && (
            <MessageBubble role="assistant" content={streamText} citations={streamCitations} streaming />
          )}
        </div>

        {/* 输入区 */}
        <div className="relative pt-4 border-t border-border space-y-3">
          {/* @Agent / /Skill 选择器（切片3）*/}
          {pickerMode && pickerItems.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-80 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg z-20 p-1">
              <p className="px-2 py-1 text-[11px] text-muted-foreground">{pickerMode === 'agent' ? '@ 选择 Agent（本条由其回答）' : '/ 选择 Skill（触发试跑）'}</p>
              {pickerItems.map((it) => (
                <button
                  key={it.id}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm text-foreground hover:bg-muted"
                  onClick={() => {
                    if (pickerMode === 'agent') setPickedAgent(it); else setPickedSkill(it);
                    setInput('');
                  }}
                >
                  {pickerMode === 'agent' ? <Bot className="h-4 w-4 text-primary" /> : <Zap className="h-4 w-4 text-primary" />}
                  {it.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-center">
            {QUICK_ACTIONS.map((a) => (
              <Button key={a.label} variant="outline" size="sm" className="gap-2" disabled title="即将支持">
                <a.icon className="h-4 w-4" />{a.label}
              </Button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">输入 @ 调 Agent，/ 调 Skill</span>
          </div>
          {(pickedAgent || pickedSkill) && (
            <div>
              <Badge variant="secondary" className="gap-1">
                {pickedAgent ? <><Bot className="h-3 w-3" />@{pickedAgent.name}</> : <><Zap className="h-3 w-3" />/{pickedSkill!.name}</>}
                <button onClick={() => { setPickedAgent(null); setPickedSkill(null); }} aria-label="取消" className="ml-1">×</button>
              </Badge>
            </div>
          )}
          <div className="flex items-end gap-3">
            <Input
              aria-label="输入消息"
              placeholder={pickedAgent ? `向 @${pickedAgent.name} 提问…` : pickedSkill ? `给 /${pickedSkill.name} 的输入…` : '输入你的问题；@ 调 Agent，/ 调 Skill…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !pickerMode) { e.preventDefault(); send(); } }}
              disabled={sending}
              className="py-6 bg-card border-border"
            />
            <Button size="icon" aria-label="发送" className="h-12 w-12 rounded-xl" onClick={send} disabled={sending || !input.trim()}>
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* 可用资源（切片3）：真实 Agent / Skill / 知识库 */}
      <div className="w-72 flex flex-col gap-4 min-h-0 overflow-y-auto">
        <ResourceGroup kind="agent" title="可调取 Agent（@）" icon={Bot} items={resources.agents}
          hint="点击 @ 该 Agent 回答本条" onPick={(it) => { setPickedSkill(null); setPickedAgent(it); }} />
        <ResourceGroup kind="skill" title="可调取 Skill（/）" icon={Zap} items={resources.skills}
          hint="点击 / 触发该 Skill 试跑" onPick={(it) => { setPickedAgent(null); setPickedSkill(it); }} />
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5"><FileText className="h-4 w-4 text-primary" />知识库（自动检索）</h3>
          <div className="space-y-1.5">
            {resources.knowledgeBases.length === 0 && <p className="px-1 text-xs text-muted-foreground">暂无知识库</p>}
            {resources.knowledgeBases.map((k) => (
              <div key={k.id} className="rounded-lg bg-card border border-border p-2 text-xs text-foreground flex items-center justify-between">
                <span className="truncate">{k.name}</span>
                {typeof k.documentCount === 'number' && <span className="text-muted-foreground shrink-0 ml-1">{k.documentCount} 文档</span>}
              </div>
            ))}
          </div>
          <p className="px-1 mt-1 text-[11px] text-muted-foreground">提问时自动检索全员可见知识库并带引用</p>
        </div>
      </div>
    </div>
  );
}

function ResourceGroup({ kind, title, icon: Icon, items, hint, onPick }: {
  kind: 'agent' | 'skill'; title: string; icon: typeof Bot; items: Res[]; hint: string; onPick: (it: Res) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5"><Icon className="h-4 w-4 text-primary" />{title}</h3>
      <div className="space-y-1.5">
        {items.length === 0 && <p className="px-1 text-xs text-muted-foreground">暂无</p>}
        {items.map((it) => (
          <button key={it.id} data-testid={`res-${kind}`} onClick={() => onPick(it)} title={hint}
            className="w-full rounded-lg bg-card border border-border p-2 text-xs text-left text-foreground hover:border-primary/50 truncate">
            {it.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ role, content, citations, streaming }: {
  role: Msg['role']; content: string; citations: Citation[]; streaming?: boolean;
}) {
  const isUser = role === 'user';
  return (
    <div
      data-testid={isUser ? 'assistant-msg-user' : 'assistant-msg'}
      className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isUser ? 'bg-primary/10' : 'bg-gradient-to-br from-primary/20 to-accent/20'}`}>
        {isUser ? <User className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-primary" />}
      </div>
      <div className={`max-w-[72%] ${isUser ? 'text-right' : ''}`}>
        <div className={`p-4 rounded-2xl ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border border-border rounded-tl-sm'}`}>
          <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isUser ? 'text-primary-foreground' : 'text-foreground'}`}>
            {content}{streaming && <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-primary animate-pulse" />}
          </p>
        </div>
        {!isUser && citations.length > 0 && (
          <div className="mt-2 space-y-1 text-left">
            <p className="text-xs text-muted-foreground">引用来源（{citations.length}）</p>
            {citations.map((c, i) => (
              <div key={c.documentId + i} className="rounded-lg bg-muted/40 p-2 text-xs">
                <div className="flex items-center gap-1.5 text-foreground">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium truncate">{c.filename}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">{Math.round(c.similarity * 100)}%</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
