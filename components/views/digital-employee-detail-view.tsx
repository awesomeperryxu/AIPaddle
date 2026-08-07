'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Settings, MessageSquare, AlertTriangle, Bot } from 'lucide-react';
import type { DigitalEmployeeDetail } from '@/lib/data/digital-employee';

// DE-4/DE-5：数字员工详情。回答三个此前页面上无处可查的问题——
// 它由谁组成、是谁什么时候建的、现在还能不能用。
//
// 编辑不在本页重造：改配置一律跳 /agents-admin/[id] 编排页。
// 同一份配置有两个编辑入口，迟早会出现"在哪改的不一样"。

const STATUS: Record<string, { label: string; dotClass: string; pillClass: string }> = {
  draft:     { label: '草稿',   dotClass: 'bg-muted-foreground', pillClass: 'text-muted-foreground bg-muted/50' },
  pending:   { label: '待审核', dotClass: 'bg-amber-500',        pillClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
  published: { label: '已发布', dotClass: 'bg-green-500',        pillClass: 'text-green-600 bg-green-50 dark:bg-green-950/40' },
  offline:   { label: '已下线', dotClass: 'bg-destructive',      pillClass: 'text-destructive bg-destructive/10' },
};

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-orange-400',
  'bg-emerald-500', 'bg-rose-500', 'bg-cyan-600', 'bg-amber-500',
];
const avatarBg = (n: string) => AVATAR_COLORS[(n.charCodeAt(0) || 0) % AVATAR_COLORS.length];

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.pillClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dotClass}`} />{s.label}
    </span>
  );
}

export function DigitalEmployeeDetailView({
  detail,
  canEdit = false,
}: {
  detail: DigitalEmployeeDetail;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const isDigitalEmployee = detail.subAgents.length > 0 || detail.missingSubAgentIds.length > 0;

  // 有效性：下级只要有一个不是 published，这个数字员工就跑不完整（DE-6 会把这条判定挪进 de-readiness）
  const brokenSubs = detail.subAgents.filter(s => s.status !== 'published');
  const hasIssue = brokenSubs.length > 0 || detail.missingSubAgentIds.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5"
            onClick={() => router.push('/agents')} aria-label="返回">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0 ${avatarBg(detail.name)}`}>
            {detail.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground truncate">{detail.name}</h1>
              <StatusPill status={detail.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{detail.description || '暂无描述'}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push('/agents')}>
            <MessageSquare className="h-4 w-4" />对话
          </Button>
          {canEdit && (
            <Button size="sm" className="gap-1.5" onClick={() => router.push(`/agents-admin/${detail.id}`)}>
              <Settings className="h-4 w-4" />编辑配置
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {/* ── 有效性告警 ── */}
        {hasIssue && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              <p className="font-medium">下级 Agent 存在问题，运行时会不完整</p>
              {brokenSubs.length > 0 && (
                <p className="mt-0.5">
                  {brokenSubs.length} 个下级未发布：{brokenSubs.map(s => `${s.name}（${STATUS[s.status]?.label ?? s.status}）`).join('、')}
                </p>
              )}
              {detail.missingSubAgentIds.length > 0 && (
                <p className="mt-0.5">{detail.missingSubAgentIds.length} 个下级已被删除，无法调用</p>
              )}
            </div>
          </div>
        )}

        {/* ── 下级 Agent 组成 ── */}
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-foreground mb-1">下级 Agent 组成</h2>
            <p className="text-xs text-muted-foreground mb-4">
              {isDigitalEmployee
                ? `由 ${detail.subAgents.length} 个 Agent 组成。数字员工被调用时，由它协调这些下级完成任务。`
                : '这是一个普通 Agent，没有下级——它自己就是最小执行单元。'}
            </p>
            {detail.subAgents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">无下级 Agent</p>
            ) : (
              <div className="space-y-2">
                {detail.subAgents.map(s => (
                  <div key={s.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/agents-admin/${s.id}`)}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarBg(s.name)}`}>
                      {s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.description || '暂无描述'}</p>
                    </div>
                    {s.department && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground shrink-0">{s.department}</span>
                    )}
                    <StatusPill status={s.status} />
                  </div>
                ))}
                {detail.missingSubAgentIds.length > 0 && (
                  <p className="text-xs text-destructive pt-1">
                    另有 {detail.missingSubAgentIds.length} 个下级已被删除，不会参与运行
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 创建溯源 ── */}
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-muted-foreground" />创建溯源
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {([
                ['创建人', detail.createdByName],
                ['创建时间', detail.createdAt || '—'],
                ['最后更新', detail.updatedAt || '—'],
                ['来源', detail.origin],
                ['所属部门', detail.department || '—'],
                ['使用模型', detail.model || '租户默认'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
