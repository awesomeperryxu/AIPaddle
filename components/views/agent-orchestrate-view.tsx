'use client';

// Agent 编排页（4.1.7，照搬 Dify）：左侧编排（提示词+AI生成/变量/模型&参数/Agent设置/知识库·工具占位），
// 右侧调试预览（接真实 /chat）。嵌入 dashboard 外壳（非全屏），防抖自动保存 config。
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Sparkles, Loader2, Send, Settings2, BookOpen, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AGENT_MODELS,
  AGENT_MODE_LABEL,
  DEFAULT_AGENT_CONFIG,
  type AgentConfig,
  type AgentMode,
  type AgentVariable,
} from '@/lib/agents/config';

type AgentDetail = {
  id: string;
  name: string;
  department: string;
  description: string;
  status: 'draft' | 'pending' | 'published' | 'offline';
  config: AgentConfig;
};

const STATUS_LABEL: Record<AgentDetail['status'], { text: string; cls: string }> = {
  draft: { text: '草稿', cls: 'bg-muted text-muted-foreground' },
  pending: { text: '待审核', cls: 'bg-amber-500/10 text-amber-600' },
  published: { text: '已发布', cls: 'bg-emerald-500/10 text-emerald-600' },
  offline: { text: '已下线', cls: 'bg-muted text-muted-foreground' },
};

type ChatMsg = { role: 'user' | 'assistant'; content: string };

export function AgentOrchestrateView({ agent, canEdit }: { agent: AgentDetail; canEdit: boolean }) {
  const router = useRouter();

  // 配置状态（从 agent.config 初始化，缺省用默认）
  const [title, setTitle] = useState(agent.name);
  const [systemPrompt, setSystemPrompt] = useState(agent.config.systemPrompt ?? '');
  const [model, setModel] = useState(agent.config.model ?? DEFAULT_AGENT_CONFIG.model);
  const [temperature, setTemperature] = useState(agent.config.temperature ?? DEFAULT_AGENT_CONFIG.temperature);
  const [variables, setVariables] = useState<AgentVariable[]>(agent.config.variables ?? []);
  const [agentMode, setAgentMode] = useState<AgentMode>(agent.config.agentMode ?? DEFAULT_AGENT_CONFIG.agentMode);
  const [maxIterations, setMaxIterations] = useState(agent.config.maxIterations ?? DEFAULT_AGENT_CONFIG.maxIterations);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // 组装当前 config
  const buildConfig = useCallback((): AgentConfig => ({
    systemPrompt, model, temperature, variables, agentMode, maxIterations,
  }), [systemPrompt, model, temperature, variables, agentMode, maxIterations]);

  // 立即保存（返回是否成功）
  const saveNow = useCallback(async () => {
    if (!canEdit) return false;
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: title, config: buildConfig() }),
      });
      if (!res.ok) { setSaveStatus('error'); return false; }
      setSaveStatus('saved');
      return true;
    } catch { setSaveStatus('error'); return false; }
  }, [canEdit, agent.id, title, buildConfig]);

  // 防抖自动保存
  const firstRun = useRef(true);
  useEffect(() => {
    if (!canEdit) return;
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { setSaveStatus('saving'); void saveNow(); }, 800);
    return () => clearTimeout(t);
  }, [title, systemPrompt, model, temperature, variables, agentMode, maxIterations, canEdit, saveNow]);

  // AI 生成提示词
  const [genInstruction, setGenInstruction] = useState('');
  const [genOpen, setGenOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const generate = async () => {
    if (genInstruction.trim().length < 2) { showToast('请先输入需求描述'); return; }
    setGenerating(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/generate-prompt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: genInstruction }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(body?.error?.message ?? '生成失败'); return; }
      setSystemPrompt(body.systemPrompt ?? '');
      setGenOpen(false);
      setGenInstruction('');
    } catch { showToast('生成失败：网络错误'); }
    finally { setGenerating(false); }
  };

  // 变量操作
  const addVariable = () => setVariables((v) => [...v, { key: '', type: 'string' }]);
  const updateVariable = (i: number, patch: Partial<AgentVariable>) =>
    setVariables((v) => v.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeVariable = (i: number) => setVariables((v) => v.filter((_, idx) => idx !== i));

  // 调试预览
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setSending(true);
    try {
      await saveNow(); // 先落最新配置，保证预览用当前提示词/模型
      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${body?.error?.message ?? '对话失败'}` }]); return; }
      setMessages((m) => [...m, { role: 'assistant', content: body.reply ?? '' }]);
    } catch { setMessages((m) => [...m, { role: 'assistant', content: '⚠️ 网络错误' }]); }
    finally { setSending(false); }
  };

  const st = STATUS_LABEL[agent.status];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b border-border px-4 h-14 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push('/agents-admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              className="bg-transparent text-sm font-medium text-foreground outline-none disabled:opacity-70"
            />
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">AGENT · {agent.department || '未分部门'}</span>
              <Badge className={st.cls}>{st.text}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {saveStatus === 'saving' && '自动保存中…'}
          {saveStatus === 'saved' && '已自动保存'}
          {saveStatus === 'error' && <span className="text-destructive">保存失败</span>}
        </div>
      </div>

      {/* Body：左编排 + 右调试预览 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左：编排 */}
        <div className="flex-1 overflow-auto p-6 space-y-5 max-w-3xl">
          {/* 提示词 */}
          <section className="rounded-xl border border-border p-4">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm font-medium">提示词（指令）</Label>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={!canEdit} onClick={() => setGenOpen((v) => !v)}>
                <Sparkles className="h-3.5 w-3.5" /> 生成
              </Button>
            </div>
            {genOpen && (
              <div className="mb-2 flex gap-2">
                <Input
                  value={genInstruction}
                  onChange={(e) => setGenInstruction(e.target.value)}
                  placeholder="一句话描述这个 Agent 要做什么…"
                  onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
                />
                <Button size="sm" onClick={generate} disabled={generating}>
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : '生成'}
                </Button>
              </div>
            )}
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              disabled={!canEdit}
              placeholder="写明角色、职责边界、语气与输出规范…"
              className="min-h-[140px] text-sm"
            />
          </section>

          {/* 变量 */}
          <section className="rounded-xl border border-border p-4">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">变量</Label>
                <p className="text-xs text-muted-foreground">用户输入表单；可在提示词中用 {'{{变量名}}'} 引用。</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={!canEdit} onClick={addVariable}>
                <Plus className="h-3.5 w-3.5" /> 添加
              </Button>
            </div>
            {variables.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">暂无变量</p>
            ) : (
              <div className="space-y-2">
                {variables.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={v.key} onChange={(e) => updateVariable(i, { key: e.target.value })} placeholder="变量名" disabled={!canEdit} className="h-8 flex-1" />
                    <Input value={v.label ?? ''} onChange={(e) => updateVariable(i, { label: e.target.value })} placeholder="显示名（可选）" disabled={!canEdit} className="h-8 flex-1" />
                    <Select value={v.type} onValueChange={(t) => updateVariable(i, { type: t as AgentVariable['type'] })} disabled={!canEdit}>
                      <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">文本</SelectItem>
                        <SelectItem value="number">数字</SelectItem>
                        <SelectItem value="select">选项</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!canEdit} onClick={() => removeVariable(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 模型 & 参数 */}
          <section className="rounded-xl border border-border p-4 space-y-3">
            <Label className="text-sm font-medium">模型 & 参数</Label>
            <div className="flex items-center gap-3">
              <Select value={model} onValueChange={setModel} disabled={!canEdit}>
                <SelectTrigger className="h-9 w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AGENT_MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">温度</Label>
                <Input
                  type="number" min={0} max={2} step={0.1} value={temperature}
                  onChange={(e) => setTemperature(Math.max(0, Math.min(2, Number(e.target.value) || 0)))}
                  disabled={!canEdit} className="h-9 w-20"
                />
              </div>
            </div>
          </section>

          {/* Agent 设置 */}
          <section className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Agent 设置</Label>
            </div>
            <div className="flex items-center gap-3">
              <Select value={agentMode} onValueChange={(v) => setAgentMode(v as AgentMode)} disabled={!canEdit}>
                <SelectTrigger className="h-9 w-72"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="react">{AGENT_MODE_LABEL.react}</SelectItem>
                  <SelectItem value="function_calling">{AGENT_MODE_LABEL.function_calling}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">最大迭代</Label>
                <Input
                  type="number" min={1} max={20} value={maxIterations}
                  onChange={(e) => setMaxIterations(Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1))))}
                  disabled={!canEdit} className="h-9 w-20"
                />
              </div>
            </div>
          </section>

          {/* 知识库 / 工具（4.1.9 绑定，先占位） */}
          <section className="rounded-xl border border-dashed border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" /> 知识库 · <Wrench className="h-4 w-4" /> 工具（Skill/工作流）
            </div>
            <p className="mt-1 text-xs text-muted-foreground">绑定知识库、Skill、工作流作为 Agent 能力 —— 即将上线（4.1.9）。</p>
          </section>
        </div>

        {/* 右：调试与预览 */}
        <div className="flex w-[420px] shrink-0 flex-col border-l border-border">
          <div className="border-b border-border px-4 py-3 text-sm font-medium">调试与预览</div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="pt-8 text-center text-xs text-muted-foreground">在下方输入，与当前配置的 Agent 实时对话调试。</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && <div className="flex justify-start"><div className="rounded-lg bg-muted px-3 py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div></div>}
          </div>
          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="和 Agent 聊天…"
                className="min-h-[40px] max-h-32 text-sm"
              />
              <Button size="icon" onClick={send} disabled={sending || !input.trim()}><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground/90 px-4 py-2 text-sm text-background shadow-lg">{toast}</div>
      )}
    </div>
  );
}
