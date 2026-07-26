'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { apiFetch } from '@/lib/api/client';
import {
  Send, Bot, Sparkles, SquarePen, Zap, FileText, Image as ImageIcon,
  Loader2, Trash2, MessageSquare, X, Paperclip, AtSign, ChevronRight, Users,
} from 'lucide-react';

type Citation = { documentId: string; filename: string; snippet: string; similarity: number };
type MsgAttachment = { kind: 'doc' | 'image'; filename: string; dataUrl?: string };
type Msg = { id: string; role: 'user' | 'assistant' | 'system'; content: string; citations: Citation[]; attachments?: MsgAttachment[]; label?: string };
type Conversation = { id: string; title: string; updatedAt: string };
type Res = { id: string; name: string };
// 4.1.20：@@ 唤醒目标——数字员工 或 数字员工团队
type WakeTarget = { type: 'employee' | 'team'; id: string; name: string };
type ClientAttachment =
  | { kind: 'doc'; filename: string; text: string }
  | { kind: 'image'; filename: string; dataUrl: string };

const MAX_ATTACHMENTS = 8;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const IMG_MAX_EDGE = 1600;
const IMG_QUALITY = 0.82;

async function compressImage(file: File): Promise<string> {
  const rawDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('读取失败'));
      r.readAsDataURL(file);
    });
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, IMG_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return await rawDataUrl(); }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', IMG_QUALITY);
  } catch {
    return rawDataUrl();
  }
}

const SUGGESTIONS = [
  { icon: '📝', text: '总结一份文档的要点', sub: '上传 PDF / Word / PPT' },
  { icon: '🔍', text: '搜索知识库中的内容', sub: '带来源引用的精准回答' },
  { icon: '🤖', text: '让 Agent 帮我处理事务', sub: '输入 @AgentName 指定' },
  { icon: '⚡', text: '运行一个 Skill 工具', sub: '输入 /SkillName 调用' },
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const [resources, setResources] = useState<{ agents: Res[]; skills: Res[]; knowledgeBases: (Res & { documentCount?: number })[] }>({ agents: [], skills: [], knowledgeBases: [] });
  const [pickedAgent, setPickedAgent] = useState<Res | null>(null);
  const [pickedSkill, setPickedSkill] = useState<Res | null>(null);
  // 4.1.20：@@ 唤醒的数字员工/团队（候选由 /api/digital-employees 服务端 RLS 出）
  const [pickedWake, setPickedWake] = useState<WakeTarget | null>(null);
  const [wakeList, setWakeList] = useState<{ employees: Res[]; teams: Res[] }>({ employees: [], teams: [] });
  const wakeLoaded = useRef(false);
  const [attachments, setAttachments] = useState<ClientAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  function insertToken(token: string) {
    setInput((v) => `${v}${v && !v.endsWith(' ') ? ' ' : ''}${token} `);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function onPickDocs(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    const picked = Array.from(files).slice(0, room);
    if (picked.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      picked.forEach((f) => fd.append('files', f));
      const res = await fetch('/api/assistant/attachments', { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message ?? '上传失败');
      const { attachments: parsed } = (await res.json()) as { attachments: ClientAttachment[] };
      setAttachments((a) => [...a, ...parsed].slice(0, MAX_ATTACHMENTS));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '文档解析失败');
    } finally {
      setUploading(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  }

  async function onPickImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    const picked = Array.from(files).slice(0, room);
    const next: ClientAttachment[] = [];
    for (const f of picked) {
      if (f.size > MAX_IMAGE_SIZE) { window.alert(`「${f.name}」超出 20MB 限制`); continue; }
      const dataUrl = await compressImage(f).catch(() => '');
      if (dataUrl) next.push({ kind: 'image', filename: f.name, dataUrl });
    }
    setAttachments((a) => [...a, ...next].slice(0, MAX_ATTACHMENTS));
    if (imgInputRef.current) imgInputRef.current.value = '';
  }

  function removeAttachment(i: number) {
    setAttachments((a) => a.filter((_, idx) => idx !== i));
  }

  // @@ 优先于 @（@@ 也以 @ 开头，须先判）；已选任一引用则关闭选择器
  const pickerMode: 'wake' | 'agent' | 'skill' | null =
    (pickedAgent || pickedSkill || pickedWake) ? null
      : input.startsWith('@@') ? 'wake'
        : input.startsWith('@') ? 'agent'
          : input.startsWith('/') ? 'skill'
            : null;
  const pickerQuery = (pickerMode === 'wake' ? input.slice(2) : pickerMode ? input.slice(1) : '').toLowerCase();
  const pickerItems = pickerMode === 'agent'
    ? resources.agents.filter((a) => a.name.toLowerCase().includes(pickerQuery))
    : pickerMode === 'skill'
      ? resources.skills.filter((s) => s.name.toLowerCase().includes(pickerQuery))
      : [];
  // 唤醒候选：数字员工 + 团队，合并后按查询过滤
  const wakeItems: WakeTarget[] = pickerMode === 'wake'
    ? [
        ...wakeList.employees.map((e): WakeTarget => ({ type: 'employee', id: e.id, name: e.name })),
        ...wakeList.teams.map((t): WakeTarget => ({ type: 'team', id: t.id, name: t.name })),
      ].filter((x) => x.name.toLowerCase().includes(pickerQuery))
    : [];

  const loadConversations = useCallback(async () => {
    try {
      const r = await apiFetch<{ conversations: Conversation[] }>('/api/assistant/conversations');
      setConversations(r.conversations);
      return r.conversations;
    } catch { return []; }
  }, []);

  // 初次加载：单一 /api/assistant/init 请求同时取会话、资源、第一条会话消息
  // 消除原来 4 个并行客户端请求，改为服务端一次并行聚合后返回
  const preloadedId = useRef<string | null>(null);
  useEffect(() => {
    type InitData = {
      conversations: Conversation[];
      firstConversationId: string | null;
      firstMessages: Msg[];
      resources: { agents: Res[]; skills: Res[]; knowledgeBases: (Res & { documentCount?: number })[] };
    };
    apiFetch<InitData>('/api/assistant/init').then((r) => {
      setConversations(r.conversations);
      setResources(r.resources);
      if (r.firstConversationId) {
        preloadedId.current = r.firstConversationId;
        setActiveId(r.firstConversationId);
        setMessages(r.firstMessages ?? []);
      }
    }).catch(() => {});
  }, []);

  // 用户手动切换会话时加载消息（跳过已预加载的初始会话）
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    if (activeId === preloadedId.current) { preloadedId.current = null; return; }
    apiFetch<{ messages: Msg[] }>(`/api/assistant/conversations/${activeId}/messages`)
      .then((r) => setMessages(r.messages))
      .catch(() => setMessages([]));
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamText]);

  // 首次进入 @@ 模式时懒加载唤醒候选（数字员工 + 团队），只列有权访问项（服务端 RLS）
  useEffect(() => {
    if (pickerMode === 'wake' && !wakeLoaded.current) {
      wakeLoaded.current = true;
      apiFetch<{ employees: Res[]; teams: Res[] }>('/api/digital-employees')
        .then((r) => setWakeList({ employees: r.employees ?? [], teams: r.teams ?? [] }))
        .catch(() => { wakeLoaded.current = false; });
    }
  }, [pickerMode]);

  async function newConversation() {
    const r = await apiFetch<{ conversation: Conversation }>('/api/assistant/conversations', { method: 'POST' });
    setConversations((c) => [r.conversation, ...c]);
    setActiveId(r.conversation.id);
    setMessages([]);
    setTimeout(() => textareaRef.current?.focus(), 100);
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

  // 调单个数字员工大脑：POST /api/agents/{id}/chat（其 workflow 大脑负责多子 Agent 编排）
  async function callEmployeeChat(agentId: string, text: string): Promise<string> {
    const res = await fetch(`/api/agents/${agentId}/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: text }] }),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) throw new Error((data as { error?: { message?: string } })?.error?.message ?? '唤醒失败');
    const reply = (data as { reply?: unknown }).reply;
    return typeof reply === 'string' ? reply : '（无回复）';
  }

  // 4.1.20：@@ 唤醒——数字员工直接调其大脑；团队展开为各成员各答一条
  async function sendWake(target: WakeTarget, text: string) {
    setInput('');
    setAttachments([]);
    setSending(true); setStreamText(''); setStreamCitations([]);
    setTimeout(() => { if (textareaRef.current) textareaRef.current.style.height = 'auto'; }, 0);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: `@@${target.name} ${text}`, citations: [] }]);
    try {
      if (target.type === 'employee') {
        const reply = await callEmployeeChat(target.id, text);
        setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: reply, citations: [], label: `数字员工 · ${target.name}` }]);
      } else {
        const { team } = await apiFetch<{ team: { memberIds: string[] } }>(`/api/teams/${target.id}`);
        const memberIds = team?.memberIds ?? [];
        if (memberIds.length === 0) {
          setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: `团队「${target.name}」暂无成员数字员工。`, citations: [], label: `团队 · ${target.name}` }]);
        } else {
          // 协同从简：各成员就本轮各答一条（顺序调用），分条展示并标注各自名字
          for (const mid of memberIds) {
            const name = wakeList.employees.find((e) => e.id === mid)?.name ?? '数字员工';
            try {
              const reply = await callEmployeeChat(mid, text);
              setMessages((m) => [...m, { id: `a-${mid}-${Date.now()}`, role: 'assistant', content: reply, citations: [], label: `${target.name} · ${name}` }]);
            } catch (e) {
              setMessages((m) => [...m, { id: `e-${mid}-${Date.now()}`, role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : '处理失败'}`, citations: [], label: `${target.name} · ${name}` }]);
            }
          }
        }
      }
    } catch (e) {
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : '唤醒失败'}`, citations: [] }]);
    } finally {
      setSending(false); setStreamText(''); setStreamCitations([]);
      setPickedWake(null);
    }
  }

  async function send() {
    let text = input.trim();
    const atts = attachments;
    if ((!text && atts.length === 0) || sending) return;
    if (!text) text = atts.some((a) => a.kind === 'image') ? '请分析这些图片' : '请总结这些文档';
    if (pickedWake) { await sendWake(pickedWake, text); return; }
    const agent = pickedAgent, skill = pickedSkill;
    setInput('');
    setAttachments([]);
    setSending(true); setStreamText(''); setStreamCitations([]);
    setTimeout(() => { if (textareaRef.current) textareaRef.current.style.height = 'auto'; }, 0);
    const convId = await ensureConversation();
    const prefix = agent ? `@${agent.name} ` : skill ? `/${skill.name} ` : '';
    const msgAtts: MsgAttachment[] = atts.map((a) => ({ kind: a.kind, filename: a.filename, dataUrl: a.kind === 'image' ? a.dataUrl : undefined }));
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: prefix + text, citations: [], attachments: msgAtts }]);
    try {
      const res = await fetch(`/api/assistant/conversations/${convId}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: text, agentId: agent?.id, skillId: skill?.id, attachments: atts }),
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
  const canSend = (input.trim().length > 0 || attachments.length > 0) && !sending;

  return (
    <div className="flex h-full">

      {/* ── 左侧会话列表 ─────────────────────────────── */}
      <aside className="w-60 flex flex-col border-r border-border/40 bg-sidebar/20 shrink-0">
        <div className="flex items-center justify-between px-3 py-3.5 border-b border-border/40">
          <span className="text-[13px] font-medium text-foreground/80 flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            个人助理
          </span>
          <button
            onClick={newConversation}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="新建对话"
          >
            <SquarePen className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {conversations.length === 0 && (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center">暂无历史对话</p>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setActiveId(conv.id)}
              className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                activeId === conv.id
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <span className="flex-1 truncate text-[13px]">{conv.title || '新对话'}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:text-destructive transition-all"
                aria-label="删除"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── 主对话区 ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">

        {/* 消息滚动区 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!hasChat ? (
            /* 欢迎屏 */
            <div className="h-full flex flex-col items-center justify-center px-6 pb-12">
              <div className="w-16 h-16 mb-5 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 flex items-center justify-center ring-1 ring-border/30 shadow-sm">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-[22px] font-semibold text-foreground mb-2 tracking-tight">
                你好！我是你的 AI 助理
              </h1>
              <p className="text-sm text-muted-foreground mb-10 text-center max-w-sm leading-relaxed">
                可就企业知识库提问、调用 Agent 处理事务、运行 Skill 工具，回答会带来源引用
              </p>
              <div className="grid grid-cols-2 gap-2.5 w-full max-w-md">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => { setInput(s.text); setTimeout(() => textareaRef.current?.focus(), 0); }}
                    className="group text-left p-3.5 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="text-lg mb-1">{s.icon}</div>
                    <div className="text-[13px] font-medium text-foreground/90 group-hover:text-primary transition-colors line-clamp-1 leading-snug">{s.text}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  citations={msg.citations}
                  attachments={msg.attachments}
                  label={msg.label}
                />
              ))}
              {sending && (
                <MessageBubble role="assistant" content={streamText} citations={streamCitations} streaming />
              )}
            </div>
          )}
        </div>

        {/* ── 输入区 ───────────────────────────────────── */}
        <div className="px-4 pb-4 pt-1.5 max-w-2xl mx-auto w-full">
          {/* @@ 唤醒数字员工/团队 浮层选择器 */}
          {pickerMode === 'wake' && wakeItems.length > 0 && (
            <div data-testid="wake-picker" className="mb-2 rounded-xl border border-border bg-popover shadow-lg p-1 max-h-48 overflow-y-auto">
              <p className="px-3 py-1 text-[11px] text-muted-foreground">@@ 唤醒数字员工 / 团队</p>
              {wakeItems.map((it) => (
                <button
                  key={`${it.type}-${it.id}`}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-foreground hover:bg-muted transition-colors"
                  onClick={() => {
                    setPickedWake(it);
                    setInput('');
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                >
                  {it.type === 'team' ? <Users className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-primary" />}
                  <span className="flex-1 text-left">{it.name}</span>
                  <span className="text-[11px] text-muted-foreground">{it.type === 'team' ? '团队' : '数字员工'}</span>
                </button>
              ))}
            </div>
          )}

          {/* @Agent / /Skill 浮层选择器 */}
          {(pickerMode === 'agent' || pickerMode === 'skill') && pickerItems.length > 0 && (
            <div className="mb-2 rounded-xl border border-border bg-popover shadow-lg p-1 max-h-48 overflow-y-auto">
              <p className="px-3 py-1 text-[11px] text-muted-foreground">
                {pickerMode === 'agent' ? '@ 指定 Agent 回答' : '/ 调用 Skill'}
              </p>
              {pickerItems.map((it) => (
                <button
                  key={it.id}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-foreground hover:bg-muted transition-colors"
                  onClick={() => {
                    if (pickerMode === 'agent') setPickedAgent(it); else setPickedSkill(it);
                    setInput('');
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                >
                  {pickerMode === 'agent' ? <Bot className="h-4 w-4 text-primary" /> : <Zap className="h-4 w-4 text-primary" />}
                  {it.name}
                </button>
              ))}
            </div>
          )}

          {/* 输入框主体 */}
          <div className="rounded-2xl border border-border bg-card shadow-sm focus-within:border-primary/40 focus-within:shadow-md transition-all">

            {/* 附件 + 已选引用 chips */}
            {(attachments.length > 0 || pickedAgent || pickedSkill || pickedWake) && (
              <div className="px-3.5 pt-3 pb-1 flex flex-wrap gap-1.5">
                {pickedWake && (
                  <Badge data-testid="wake-chip" variant="secondary" className="gap-1.5 pr-1 text-xs font-normal">
                    {pickedWake.type === 'team'
                      ? <Users className="h-3 w-3 text-primary" />
                      : <Bot className="h-3 w-3 text-primary" />}
                    @@{pickedWake.name}
                    <button
                      onClick={() => setPickedWake(null)}
                      className="ml-0.5 rounded p-0.5 hover:bg-muted/60"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                )}
                {(pickedAgent || pickedSkill) && (
                  <Badge variant="secondary" className="gap-1.5 pr-1 text-xs font-normal">
                    {pickedAgent
                      ? <><Bot className="h-3 w-3 text-primary" />@{pickedAgent.name}</>
                      : <><Zap className="h-3 w-3 text-primary" />/{pickedSkill!.name}</>
                    }
                    <button
                      onClick={() => { setPickedAgent(null); setPickedSkill(null); }}
                      className="ml-0.5 rounded p-0.5 hover:bg-muted/60"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                )}
                {attachments.map((a, i) => (
                  <Badge key={`${a.filename}-${i}`} variant="secondary" className="gap-1 pr-1 max-w-[13rem] text-xs font-normal">
                    {a.kind === 'image' ? <ImageIcon className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{a.filename}</span>
                    <button onClick={() => removeAttachment(i)} className="ml-0.5 rounded p-0.5 hover:bg-muted/60 shrink-0">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              aria-label="输入消息"
              placeholder={
                pickedWake ? `向 @@${pickedWake.name} 提问…`
                  : pickedAgent ? `向 @${pickedAgent.name} 提问…`
                    : pickedSkill ? `给 /${pickedSkill.name} 的指令…`
                      : '输入问题；@@ 唤醒数字员工/团队，@ 指定 Agent，/ 调用 Skill'
              }
              value={input}
              rows={1}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !pickerMode && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={sending}
              className="w-full resize-none bg-transparent px-3.5 pt-3.5 pb-2 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none min-h-[52px]"
              style={{ maxHeight: '200px', overflowY: 'auto' }}
            />

            {/* 底部工具栏 */}
            <div className="flex items-center px-2.5 pb-2.5 gap-0.5">
              {/* 隐藏 input */}
              <input ref={docInputRef} type="file" multiple
                accept=".doc,.docx,.pdf,.ppt,.pptx,.xls,.xlsx,.txt,.md" className="hidden"
                onChange={(e) => onPickDocs(e.target.files)} />
              <input ref={imgInputRef} type="file" multiple accept="image/*" className="hidden"
                onChange={(e) => onPickImages(e.target.files)} />

              <ToolBtn title="上传文档" disabled={uploading || attachments.length >= MAX_ATTACHMENTS} onClick={() => docInputRef.current?.click()}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </ToolBtn>
              <ToolBtn title="上传图片" disabled={attachments.length >= MAX_ATTACHMENTS} onClick={() => imgInputRef.current?.click()}>
                <ImageIcon className="h-4 w-4" />
              </ToolBtn>
              <RefPicker kind="agent" items={resources.agents} onInsert={insertToken} />
              <RefPicker kind="skill" items={resources.skills} onInsert={insertToken} />

              <div className="flex-1" />

              {/* 发送 */}
              <button
                onClick={send}
                disabled={!canSend}
                aria-label="发送"
                className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all ${
                  canSend
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                    : 'bg-muted text-muted-foreground/40 cursor-not-allowed'
                }`}
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground/50 mt-2">
            由通义千问驱动 · 回答仅供参考
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 工具栏图标按钮 ────────────────────────────────────────────
function ToolBtn({ children, title, disabled, onClick }: {
  children: React.ReactNode; title: string; disabled?: boolean; onClick?: () => void;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

// ── @Agent / /Skill Popover 选择器 ───────────────────────────
function RefPicker({ kind, items, onInsert }: {
  kind: 'agent' | 'skill'; items: Res[]; onInsert: (token: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isAgent = kind === 'agent';
  const prefix = isAgent ? '@' : '/';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid={`ref-${kind}`}
          title={isAgent ? '指定 Agent' : '调用 Skill'}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {isAgent ? <AtSign className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start" side="top">
        <Command>
          <CommandInput placeholder={isAgent ? '搜索 Agent…' : '搜索 Skill…'} />
          <CommandList>
            <CommandEmpty>无匹配项</CommandEmpty>
            <CommandGroup heading={isAgent ? '选择 Agent' : '选择 Skill'}>
              {items.map((it) => (
                <CommandItem
                  key={it.id}
                  value={it.name}
                  onSelect={() => { onInsert(`${prefix}${it.name}`); setOpen(false); }}
                  className="gap-2"
                >
                  {isAgent ? <Bot className="h-4 w-4 text-primary" /> : <Zap className="h-4 w-4 text-primary" />}
                  {it.name}
                  <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── 消息气泡 ─────────────────────────────────────────────────
function MessageBubble({ role, content, citations, streaming, attachments, label }: {
  role: Msg['role']; content: string; citations: Citation[]; streaming?: boolean; attachments?: MsgAttachment[]; label?: string;
}) {
  const isUser = role === 'user';

  if (isUser) {
    return (
      <div data-testid="assistant-msg-user" className="flex justify-end">
        <div className="max-w-[82%] space-y-1.5">
          {attachments && attachments.length > 0 && (
            <div className="flex gap-1.5 flex-wrap justify-end">
              {attachments.map((a, i) => (
                <span key={`${a.filename}-${i}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] bg-muted text-muted-foreground max-w-[12rem]">
                  {a.kind === 'image' ? <ImageIcon className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{a.filename}</span>
                </span>
              ))}
            </div>
          )}
          <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant 消息 —— 无气泡框，更接近 Claude 风格
  return (
    <div data-testid="assistant-msg" className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mt-0.5 ring-1 ring-border/30">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {label && (
          <p className="text-[11px] font-medium text-primary/80">{label}</p>
        )}
        <div className="text-sm leading-7 text-foreground whitespace-pre-wrap">
          {content || (streaming && '')}
          {streaming && (
            <span className="inline-block w-0.5 h-4 ml-0.5 align-middle bg-primary/70 animate-pulse rounded-full" />
          )}
        </div>

        {!streaming && citations.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">引用来源 · {citations.length} 条</p>
            <div className="flex flex-wrap gap-1.5">
              {citations.map((c, i) => (
                <div key={c.documentId + i} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/40 text-xs max-w-[200px]">
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate text-foreground/75 font-medium">{c.filename}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0 border-border/50">
                    {Math.round(c.similarity * 100)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
