'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/api/client';
import {
  Plus, Search, Download, Zap, Database, Globe, GitBranch, MessageSquare,
  CheckCircle2, Clock, XCircle,
} from 'lucide-react';

// 客户端 Skill 形状（对齐 /api/skills 响应；不 import 服务端 lib/data）
type SkillType = 'MCP' | 'API' | 'DB' | 'Workflow' | 'Prompt';
type Skill = {
  id: string; name: string; description: string; type: SkillType;
  version: string; installs: number; rating: number;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'draft' | 'pending' | 'published';
  tags: string[];
};

type Props = {
  skills: Skill[];
  installedIds: string[];
  mcpServers: { id: string; name: string }[];
  canCreate: boolean;
  canReview: boolean;
};

const typeConfig: Record<SkillType, { icon: typeof Globe; color: string; bg: string }> = {
  MCP: { icon: Globe, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  API: { icon: Zap, color: 'text-green-500', bg: 'bg-green-500/10' },
  DB: { icon: Database, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  Workflow: { icon: GitBranch, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  Prompt: { icon: MessageSquare, color: 'text-pink-500', bg: 'bg-pink-500/10' },
};
const riskConfig = {
  low: { label: '低', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  medium: { label: '中', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  high: { label: '高', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};
const statusConfig = {
  draft: { label: '草稿', icon: XCircle, className: 'bg-muted text-muted-foreground' },
  pending: { label: '待审核', icon: Clock, className: 'bg-warning/10 text-warning' },
  published: { label: '已发布', icon: CheckCircle2, className: 'bg-green-500/10 text-green-600' },
};

const emptyForm = { name: '', type: 'API' as SkillType, riskLevel: 'low' as Skill['riskLevel'], description: '', mcpServerId: '' };

export function SkillHubView({ skills, installedIds, mcpServers, canCreate, canReview }: Props) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const installed = new Set(installedIds);

  const filtered = skills.filter((s) => {
    const q = searchTerm.toLowerCase();
    const matchQ = s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    const matchT = selectedType === 'all' || s.type === selectedType;
    return matchQ && matchT;
  });
  const marketSkills = filtered.filter((s) => s.status === 'published');
  const mySkills = filtered.filter((s) => installed.has(s.id));
  const pendingSkills = filtered.filter((s) => s.status === 'pending');

  const stats = {
    total: skills.length,
    published: skills.filter((s) => s.status === 'published').length,
    pending: skills.filter((s) => s.status === 'pending').length,
    totalInstalls: skills.reduce((acc, s) => acc + s.installs, 0),
  };

  async function toggleInstall(skill: Skill) {
    setBusy(true);
    try {
      await apiFetch(`/api/skills/${skill.id}/install`, { method: installed.has(skill.id) ? 'DELETE' : 'POST' });
      router.refresh();
      setSelectedSkill(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function transition(skill: Skill, action: 'submit' | 'approve' | 'reject') {
    setBusy(true);
    try {
      await apiFetch(`/api/skills/${skill.id}/transition`, { method: 'POST', body: JSON.stringify({ action }) });
      router.refresh();
      setSelectedSkill(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const config = form.type === 'MCP' ? { mcp_server_id: form.mcpServerId, allowed_tools: [] } : {};
      await apiFetch('/api/skills', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name, type: form.type, riskLevel: form.riskLevel, description: form.description, config,
        }),
      });
      setCreateOpen(false);
      setForm(emptyForm);
      router.refresh();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  const renderCard = (skill: Skill) => {
    const TypeIcon = typeConfig[skill.type].icon;
    const StatusIcon = statusConfig[skill.status].icon;
    return (
      <Card
        key={skill.id}
        data-testid="skill-card"
        data-skill-name={skill.name}
        className={`bg-card border-border cursor-pointer transition-all hover:shadow-md ${
          selectedSkill?.id === skill.id ? 'ring-2 ring-primary shadow-md' : 'shadow-sm'
        }`}
        onClick={() => setSelectedSkill(skill)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg ${typeConfig[skill.type].bg} flex items-center justify-center shrink-0`}>
              <TypeIcon className={`h-5 w-5 ${typeConfig[skill.type].color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-sm text-foreground truncate">{skill.name}</h3>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{skill.type}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{skill.description}</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Download className="h-3 w-3" />{skill.installs}</span>
                <span>v{skill.version}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge className={`text-[10px] gap-1 ${statusConfig[skill.status].className}`}>
                <StatusIcon className="h-3 w-3" />{statusConfig[skill.status].label}
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${riskConfig[skill.riskLevel].className}`}>
                {riskConfig[skill.riskLevel].label}风险
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex h-full gap-6">
      <div className={`flex-1 flex flex-col min-w-0 ${selectedSkill ? 'max-w-2xl' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Skill Hub</h1>
            <p className="text-sm text-muted-foreground mt-0.5">企业 AI 能力市场</p>
          </div>
          {canCreate && (
            <Button className="gap-2 shadow-sm" data-testid="create-skill" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              创建 Skill
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { icon: Zap, bg: 'bg-primary/10', color: 'text-primary', value: stats.total, label: '全部 Skill' },
            { icon: CheckCircle2, bg: 'bg-green-500/10', color: 'text-green-500', value: stats.published, label: '已发布' },
            { icon: Clock, bg: 'bg-warning/10', color: 'text-warning', value: stats.pending, label: '待审核' },
            { icon: Download, bg: 'bg-accent/10', color: 'text-accent', value: stats.totalInstalls, label: '总安装量' },
          ].map((s, i) => (
            <Card key={i} className="bg-card border-border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search + Type Filter */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索 Skill..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border h-9"
            />
          </div>
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
            {['all', 'MCP', 'API', 'DB', 'Workflow', 'Prompt'].map((type) => (
              <button
                key={type} onClick={() => setSelectedType(type)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedType === type ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {type === 'all' ? '全部' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="market" className="flex-1 flex flex-col">
          <TabsList className="bg-muted/50 h-9 w-fit mb-4">
            <TabsTrigger value="market" className="text-xs px-4">Skill 市场</TabsTrigger>
            <TabsTrigger value="my" className="text-xs px-4">我的 Skill</TabsTrigger>
            {canReview && <TabsTrigger value="review" className="text-xs px-4">待审核</TabsTrigger>}
          </TabsList>

          <TabsContent value="market" className="flex-1 overflow-y-auto mt-0">
            {marketSkills.length === 0
              ? <p className="text-sm text-muted-foreground py-8 text-center">暂无已发布 Skill</p>
              : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{marketSkills.map(renderCard)}</div>}
          </TabsContent>
          <TabsContent value="my" className="flex-1 overflow-y-auto mt-0">
            {mySkills.length === 0
              ? <p className="text-sm text-muted-foreground py-8 text-center">还没有安装任何 Skill</p>
              : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{mySkills.map(renderCard)}</div>}
          </TabsContent>
          {canReview && (
            <TabsContent value="review" className="flex-1 overflow-y-auto mt-0">
              {pendingSkills.length === 0
                ? <p className="text-sm text-muted-foreground py-8 text-center">无待审核 Skill</p>
                : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{pendingSkills.map(renderCard)}</div>}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Detail Panel */}
      {selectedSkill && (
        <div className="w-[380px] flex flex-col gap-4 overflow-y-auto">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {(() => {
                  const TypeIcon = typeConfig[selectedSkill.type].icon;
                  return (
                    <div className={`w-11 h-11 rounded-xl ${typeConfig[selectedSkill.type].bg} flex items-center justify-center`}>
                      <TypeIcon className={`h-5 w-5 ${typeConfig[selectedSkill.type].color}`} />
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base text-foreground">{selectedSkill.name}</CardTitle>
                  <CardDescription className="text-xs">{selectedSkill.type} · v{selectedSkill.version}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedSkill.description || '（无描述）'}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-xs">{selectedSkill.type}</Badge>
                <Badge variant="outline" className={`text-xs ${riskConfig[selectedSkill.riskLevel].className}`}>
                  {riskConfig[selectedSkill.riskLevel].label}风险
                </Badge>
                <Badge className={`text-xs gap-1 ${statusConfig[selectedSkill.status].className}`}>
                  {statusConfig[selectedSkill.status].label}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                  <p className="text-base font-semibold text-foreground" data-testid="skill-installs">{selectedSkill.installs}</p>
                  <p className="text-[11px] text-muted-foreground">安装量</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                  <p className="text-base font-semibold text-foreground">{selectedSkill.rating || '—'}</p>
                  <p className="text-[11px] text-muted-foreground">评分</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {selectedSkill.status === 'published' && (
              <Button
                className="w-full shadow-sm" disabled={busy}
                variant={installed.has(selectedSkill.id) ? 'outline' : 'default'}
                data-testid="install-skill"
                onClick={() => toggleInstall(selectedSkill)}
              >
                {installed.has(selectedSkill.id) ? '卸载' : <><Download className="h-4 w-4 mr-2" />安装</>}
              </Button>
            )}
            {selectedSkill.status === 'draft' && (
              <Button className="w-full" disabled={busy} onClick={() => transition(selectedSkill, 'submit')}>
                提交发布
              </Button>
            )}
            {selectedSkill.status === 'pending' && canReview && (
              <div className="flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={() => transition(selectedSkill, 'approve')}>审核通过</Button>
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => transition(selectedSkill, 'reject')}>驳回</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 创建 Skill 对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建 Skill</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="skill-name">名称</Label>
              <Input id="skill-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Skill 名称" />
            </div>
            <div>
              <Label>类型</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as SkillType, mcpServerId: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['MCP', 'API', 'DB', 'Workflow', 'Prompt'] as SkillType[]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.type === 'MCP' && (
              <div>
                <Label>封装的 MCP Server</Label>
                <Select value={form.mcpServerId} onValueChange={(v) => setForm({ ...form, mcpServerId: v })}>
                  <SelectTrigger><SelectValue placeholder={mcpServers.length ? '选择一个已审批 Server' : '暂无可用 Server'} /></SelectTrigger>
                  <SelectContent>
                    {mcpServers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">只能封装你有权限的已审批 Server（ADR-004）</p>
              </div>
            )}
            <div>
              <Label>风险等级</Label>
              <Select value={form.riskLevel} onValueChange={(v) => setForm({ ...form, riskLevel: v as Skill['riskLevel'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">低（提交后自动发布）</SelectItem>
                  <SelectItem value="medium">中（须安全审核）</SelectItem>
                  <SelectItem value="high">高（须安全审核）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button
              disabled={creating || !form.name.trim() || (form.type === 'MCP' && !form.mcpServerId)}
              onClick={handleCreate}
            >
              {creating ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
