'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api/client';
import {
  Plus, Save, Send, Loader2, ShieldCheck, Building2, User, Rocket, FileText, Search,
  Bot, Sparkles, Wand2,
} from 'lucide-react';

// 轻量 Markdown 编辑器（用到 window，禁 SSR）
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

type SkillCategory = 'platform-builtin' | 'platform-market' | 'user-private' | 'user-shared';
type SkillStatus = 'draft' | 'pending' | 'published';
type SkillType = 'MCP' | 'API' | 'DB' | 'Workflow' | 'Prompt';

type Skill = {
  id: string;
  name: string;
  description: string;
  type: SkillType;
  status: SkillStatus;
  category: SkillCategory;
  mine: boolean;
  documentation: string;
};

// 四类来源徽章（对齐 ADR-010 / #46）
const CATEGORY: Record<SkillCategory, { label: string; icon: typeof User; className: string }> = {
  'platform-builtin': { label: '平台内置', icon: ShieldCheck, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  'platform-market': { label: '平台官方', icon: Building2, className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  'user-private': { label: '自建·私有', icon: User, className: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  'user-shared': { label: '自建·已推送', icon: Rocket, className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
};

const STATUS_LABEL: Record<SkillStatus, string> = { draft: '草稿', pending: '待审核', published: '已发布' };

function CategoryBadge({ category }: { category: SkillCategory }) {
  const c = CATEGORY[category];
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`gap-1 text-[10px] ${c.className}`}>
      <Icon className="h-3 w-3" />{c.label}
    </Badge>
  );
}

export function MySkillsWorkspaceView({
  skills: initial,
  canCreate,
  canSubmit,
}: {
  skills: Skill[];
  canCreate: boolean;
  canSubmit: boolean;
}) {
  // 只展示本人创建的 Skill（自建私有 + 自建已推送）
  const [skills, setSkills] = useState<Skill[]>(initial.filter((s) => s.mine));
  const [activeId, setActiveId] = useState<string | null>(skills[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [doc, setDoc] = useState<string>(skills[0]?.documentation ?? '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const active = useMemo(() => skills.find((s) => s.id === activeId) ?? null, [skills, activeId]);

  // 切换选中 Skill：同步载入其正文（事件驱动，避免在 effect 内同步 setState）
  function selectSkill(id: string, list: Skill[] = skills) {
    setActiveId(id);
    setDoc(list.find((s) => s.id === id)?.documentation ?? '');
    setDirty(false);
  }

  const filtered = useMemo(
    () => skills.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())),
    [skills, query],
  );

  async function refresh() {
    const r = await apiFetch<{ skills: Skill[] }>('/api/skills');
    setSkills(r.skills.filter((s) => s.mine));
    return r.skills;
  }

  async function createSkill() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const r = await apiFetch<{ skill: Skill }>('/api/skills', {
        method: 'POST',
        body: JSON.stringify({ name, type: 'Prompt' }), // 默认 Prompt 型（无需 MCP 封装），可后续改类型
      });
      setNewName('');
      const all = await refresh();
      selectSkill(r.skill.id, all);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    if (!active || !dirty) return;
    setSaving(true);
    try {
      await apiFetch(`/api/skills/${active.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ documentation: doc }),
      });
      setSkills((list) => list.map((s) => (s.id === active.id ? { ...s, documentation: doc } : s)));
      setDirty(false);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function applyToHub() {
    if (!active) return;
    if (!window.confirm(`将「${active.name}」申请上架 Skill Hub？提交后由平台管理员审核。`)) return;
    setSubmitting(true);
    try {
      if (dirty) await save();
      const r = await apiFetch<{ skill: Skill; autoPublished: boolean }>(
        `/api/skills/${active.id}/transition`,
        { method: 'POST', body: JSON.stringify({ action: 'submit' }) },
      );
      await refresh();
      window.alert(r.autoPublished ? '低风险已自动上架发布 ✅' : '已提交，等待平台管理员审核 ⏳');
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '申请失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col p-6 gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-medium text-foreground">我的 Skill</h1>
          <p className="text-xs text-muted-foreground">创建、编辑并申请上架你的 Skill</p>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* 左侧：我的 Skill 列表 */}
        <div className="w-64 flex flex-col gap-3 min-h-0">
          {canCreate && (
            <div className="flex gap-2">
              <Input
                aria-label="新建 Skill 名称"
                placeholder="新 Skill 名称…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createSkill(); }}
                disabled={creating}
                className="h-9"
              />
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={createSkill} disabled={creating || !newName.trim()} aria-label="创建">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input aria-label="搜索" placeholder="搜索" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 pl-8 text-xs" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
            {filtered.length === 0 && <p className="text-xs text-muted-foreground px-1 py-4 text-center">暂无自建 Skill，点上方 + 新建</p>}
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSkill(s.id)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                  activeId === s.id ? 'bg-primary/10 border-primary/30' : 'bg-card border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{s.name}</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <CategoryBadge category={s.category} />
                  <span className="text-[10px] text-muted-foreground">{STATUS_LABEL[s.status]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 右侧：Skill 的 Markdown 正文，可编辑保存 */}
        <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-border bg-card">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              从左侧选择一个 Skill，或新建一个
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-foreground truncate">{active.name}.md</span>
                  <CategoryBadge category={active.category} />
                  <Badge variant="secondary" className="text-[10px]">{active.type}</Badge>
                  <span className="text-xs text-muted-foreground">{STATUS_LABEL[active.status]}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={save} disabled={!dirty || saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}保存
                  </Button>
                  {canSubmit && active.status === 'draft' && (
                    <Button size="sm" className="gap-1.5" onClick={applyToHub} disabled={submitting}>
                      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}申请上架
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto p-3" data-color-mode="dark">
                <MDEditor
                  value={doc}
                  onChange={(v) => { setDoc(v ?? ''); setDirty(true); }}
                  height="100%"
                  preview="live"
                  visibleDragbar={false}
                />
              </div>
            </>
          )}
        </div>

        {/* 第三栏：AI 对话窗（多轮引导建 Skill，样式对齐个人助理）*/}
        {canCreate && (
          <SkillCopilotChat
            onCreated={async (id) => { const all = await refresh(); selectSkill(id, all); }}
          />
        )}
      </div>
    </div>
  );
}

type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string };
type Draft = { name: string; type: SkillType; description: string; riskLevel: string; documentation: string };

// 去掉 AI 回复里的定稿 JSON 块，只展示自然语言
function sanitize(text: string): string {
  return text.replace(/```skilldraft[\s\S]*?```/gi, '').trim();
}

function SkillCopilotChat({ onCreated }: { onCreated: (id: string) => Promise<void> | void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [creating, setCreating] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setDraft(null);
    setSending(true);
    setStreamText('');
    const next: ChatMsg[] = [...messages, { id: `u-${Date.now()}`, role: 'user', content: text }];
    setMessages(next);
    try {
      const res = await fetch('/api/skills/copilot/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok || !res.body) throw new Error('对话失败');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', full = '', gotDraft: Draft | null = null;
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
          if (obj.type === 'delta') { full += obj.text; setStreamText(sanitize(full)); }
          else if (obj.type === 'draft') { gotDraft = obj.draft; }
          else if (obj.type === 'error') throw new Error(obj.message);
        }
      }
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: sanitize(full) }]);
      if (gotDraft) setDraft(gotDraft);
    } catch (e) {
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : '对话失败'}` }]);
    } finally {
      setSending(false);
      setStreamText('');
    }
  }

  async function createFromDraft() {
    if (!draft) return;
    setCreating(true);
    try {
      const r = await apiFetch<{ skill: { id: string } }>('/api/skills', {
        method: 'POST',
        body: JSON.stringify({
          name: draft.name,
          type: draft.type,
          description: draft.description,
          documentation: draft.documentation,
          riskLevel: draft.riskLevel,
        }),
      });
      setDraft(null);
      setMessages((m) => [...m, { id: `s-${Date.now()}`, role: 'assistant', content: `✅ 已创建草稿「${draft.name}」，右侧可继续编辑正文` }]);
      await onCreated(r.skill.id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="w-80 flex flex-col min-h-0 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Wand2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Skill 创建助手</p>
          <p className="text-[11px] text-muted-foreground">对话式引导，一键生成草稿</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
        {messages.length === 0 && !sending && (
          <div className="h-full flex items-center justify-center text-center">
            <div className="space-y-2">
              <Sparkles className="h-7 w-7 text-primary mx-auto" />
              <p className="text-sm text-foreground">描述你想要的 Skill</p>
              <p className="text-xs text-muted-foreground">例：帮我做一个把周报要点整理成邮件的 Skill</p>
            </div>
          </div>
        )}
        {messages.map((m) => <ChatBubble key={m.id} role={m.role} content={m.content} />)}
        {sending && <ChatBubble role="assistant" content={streamText} streaming />}
        {draft && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-medium text-foreground">{draft.name}</span>
              <Badge variant="secondary" className="text-[10px]">{draft.type}</Badge>
            </div>
            {draft.description && <p className="text-xs text-muted-foreground">{draft.description}</p>}
            <Button size="sm" className="w-full gap-1.5" onClick={createFromDraft} disabled={creating}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}创建此 Skill（草稿）
            </Button>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border shrink-0 flex items-end gap-2">
        <Input
          aria-label="描述 Skill 需求"
          placeholder="描述需求…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={sending}
          className="h-10"
        />
        <Button size="icon" className="h-10 w-10 shrink-0" onClick={send} disabled={sending || !input.trim()} aria-label="发送">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function ChatBubble({ role, content, streaming }: { role: 'user' | 'assistant'; content: string; streaming?: boolean }) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isUser ? 'bg-primary/10' : 'bg-gradient-to-br from-primary/20 to-accent/20'}`}>
        {isUser ? <User className="h-3.5 w-3.5 text-primary" /> : <Bot className="h-3.5 w-3.5 text-primary" />}
      </div>
      <div className={`max-w-[80%] p-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted/50 text-foreground rounded-tl-sm'}`}>
        {content}{streaming && <span className="inline-block w-1 h-3.5 ml-0.5 align-middle bg-primary animate-pulse" />}
      </div>
    </div>
  );
}
