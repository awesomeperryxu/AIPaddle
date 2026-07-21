'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { apiFetch } from '@/lib/api/client';
import {
  Send, Bot, User, Sparkles, Plus, Zap, FileText, Image as ImageIcon,
  Loader2, Trash2, MessageSquare, X,
} from 'lucide-react';

type Citation = { documentId: string; filename: string; snippet: string; similarity: number };
// 消息附件（#55）：仅用于气泡展示（doc 只留文件名，image 可缩略）
type MsgAttachment = { kind: 'doc' | 'image'; filename: string; dataUrl?: string };
type Msg = { id: string; role: 'user' | 'assistant' | 'system'; content: string; citations: Citation[]; attachments?: MsgAttachment[] };
type Conversation = { id: string; title: string; updatedAt: string };
type Res = { id: string; name: string };
// 待发送附件（#55 · Block B/C）：doc 携带解析文本；image 携带 base64 data URL
type ClientAttachment =
  | { kind: 'doc'; filename: string; text: string }
  | { kind: 'image'; filename: string; dataUrl: string };

const MAX_ATTACHMENTS = 8; // 单条最多附件数
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 图片原图上限 20MB（前端压缩后再上传）
const IMG_MAX_EDGE = 1600; // 压缩后最大边（qwen-vl 足够，兼顾清晰与体积）
const IMG_QUALITY = 0.82; // JPEG 质量

// 前端图片压缩：解码 → 缩到最大边 ≤ IMG_MAX_EDGE → 转 JPEG，显著降低 base64 体积与 VL 调用开销。
// 解码失败（非位图等）回退原图 base64。
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
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return await rawDataUrl(); }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', IMG_QUALITY);
  } catch {
    return rawDataUrl();
  }
}

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
  // #55 Block A：/skill、@agent 引用列表（插入文本 token）
  const [skillList, setSkillList] = useState<Res[]>([]);
  const [agentList, setAgentList] = useState<Res[]>([]);
  // #55 Block B/C：待发送附件 + 上传态 + 文件选择器
  const [attachments, setAttachments] = useState<ClientAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<typeof resources>('/api/assistant/resources')
      .then(setResources)
      .catch(() => {});
    apiFetch<{ skills: Res[] }>('/api/skills').then((r) => setSkillList(r.skills ?? [])).catch(() => {});
    apiFetch<{ agents: Res[] }>('/api/agents').then((r) => setAgentList(r.agents ?? [])).catch(() => {});
  }, []);

  // 在输入框末尾插入 /{name} 或 @{name} 引用 token（Block A）
  function insertToken(token: string) {
    setInput((v) => `${v}${v && !v.endsWith(' ') ? ' ' : ''}${token} `);
  }

  // 选文档 → 上传 /api/assistant/attachments 解析为文本（Block B）
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

  // 选图片 → 前端读为 base64 data URL（Block C）
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
    let text = input.trim();
    const atts = attachments;
    if ((!text && atts.length === 0) || sending) return;
    // 仅附件无提问：给个默认指令，后端要求 content 非空
    if (!text) text = atts.some((a) => a.kind === 'image') ? '请分析这些图片' : '请总结这些文档';
    const agent = pickedAgent, skill = pickedSkill;
    setInput('');
    setAttachments([]);
    setSending(true); setStreamText(''); setStreamCitations([]);
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
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} citations={msg.citations} attachments={msg.attachments} />
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
          {/* 隐藏文件选择器 */}
          <input ref={docInputRef} type="file" multiple accept=".doc,.docx,.pdf,.ppt,.pptx,.xls,.xlsx,.txt,.md" className="hidden"
            onChange={(e) => onPickDocs(e.target.files)} />
          <input ref={imgInputRef} type="file" multiple accept="image/*" className="hidden"
            onChange={(e) => onPickImages(e.target.files)} />
          {/* 快捷动作（#55 Block A）：总结文档 / 分析图片 / /skill / @agent */}
          <div className="flex gap-2 items-center flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" disabled={uploading || attachments.length >= MAX_ATTACHMENTS}
              onClick={() => docInputRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}📄 总结文档
            </Button>
            <Button variant="outline" size="sm" className="gap-2" disabled={attachments.length >= MAX_ATTACHMENTS}
              onClick={() => imgInputRef.current?.click()}>
              <ImageIcon className="h-4 w-4" />🖼 分析图片
            </Button>
            <RefPicker kind="skill" items={skillList} onInsert={insertToken} />
            <RefPicker kind="agent" items={agentList} onInsert={insertToken} />
            <span className="ml-auto text-xs text-muted-foreground">@ 调 Agent，/ 调 Skill</span>
          </div>
          {/* 待发送附件 chips（#55 Block B/C）*/}
          {attachments.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {attachments.map((a, i) => (
                <Badge key={`${a.filename}-${i}`} variant="secondary" className="gap-1 max-w-[16rem]">
                  {a.kind === 'image' ? <ImageIcon className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{a.filename}</span>
                  <button onClick={() => removeAttachment(i)} aria-label="移除附件" className="ml-0.5 shrink-0"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
          )}
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
            <Button size="icon" aria-label="发送" className="h-12 w-12 rounded-xl" onClick={send} disabled={sending || (!input.trim() && attachments.length === 0)}>
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// #55 Block A：/skill、@agent 引用选择器 —— Popover + Command 搜索，选中插入文本 token
function RefPicker({ kind, items, onInsert }: {
  kind: 'agent' | 'skill'; items: Res[]; onInsert: (token: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isAgent = kind === 'agent';
  const prefix = isAgent ? '@' : '/';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid={`ref-${kind}`}>
          {isAgent ? <Bot className="h-4 w-4" /> : <Zap className="h-4 w-4" />}{isAgent ? '@agent' : '/skill'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={isAgent ? '搜索 Agent…' : '搜索 Skill…'} />
          <CommandList>
            <CommandEmpty>无匹配</CommandEmpty>
            <CommandGroup heading={isAgent ? '插入 @Agent 引用' : '插入 /Skill 引用'}>
              {items.map((it) => (
                <CommandItem key={it.id} value={it.name} onSelect={() => { onInsert(`${prefix}${it.name}`); setOpen(false); }}>
                  {isAgent ? <Bot className="h-4 w-4 text-primary" /> : <Zap className="h-4 w-4 text-primary" />}
                  {it.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MessageBubble({ role, content, citations, streaming, attachments }: {
  role: Msg['role']; content: string; citations: Citation[]; streaming?: boolean; attachments?: MsgAttachment[];
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
          {attachments && attachments.length > 0 && (
            <div className={`mt-2 flex gap-1.5 flex-wrap ${isUser ? 'justify-end' : ''}`}>
              {attachments.map((a, i) => (
                <span key={`${a.filename}-${i}`} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] max-w-[12rem] ${isUser ? 'bg-primary-foreground/15' : 'bg-muted'}`}>
                  {a.kind === 'image' ? <ImageIcon className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{a.filename}</span>
                </span>
              ))}
            </div>
          )}
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
