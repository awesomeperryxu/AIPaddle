'use client';

import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle, GitBranch, Bot, Clock, ArrowRight } from 'lucide-react';

// WF-6：助理对话里的编排卡片（方案 A：内联，不用弹窗）。
// 内联的好处是操作痕迹留在对话历史里——哪步做完了、当前卡在哪，回头翻聊天记录就能看到；
// 弹窗关掉就什么都不剩。

export type OrchestrateStage = 'plan' | 'workflow-drafted' | 'agent-drafted' | 'done' | 'failed';

export type OrchestrateState = {
  stage: OrchestrateStage;
  description: string;
  workflow?: {
    id: string; name: string; nodeCount: number; edgeCount: number;
    pendingAbilityNodes: string[]; valid: boolean; validation: { message: string }[];
  };
  agent?: { id: string; name: string };
  pendingReview?: boolean;
  error?: string;
  busy?: boolean;
};

type Props = {
  state: OrchestrateState;
  onDraftWorkflow: () => void;
  onPublishWorkflow: () => void;
  onPublishAgent: () => void;
  onGotoSchedule: () => void;
  onOpenWorkflow: (id: string) => void;
};

export function AssistantOrchestrateCard({
  state, onDraftWorkflow, onPublishWorkflow, onPublishAgent, onGotoSchedule, onOpenWorkflow,
}: Props) {
  const { stage, workflow, agent, busy, error, pendingReview } = state;

  return (
    <div className="mt-3 rounded-xl border border-border bg-card/60 p-3.5 space-y-3">
      <StepRow
        icon={<GitBranch className="h-3.5 w-3.5" />}
        title="工作流"
        done={!!workflow}
        current={stage === 'plan'}
        detail={workflow ? `${workflow.name}（${workflow.nodeCount} 个节点 / ${workflow.edgeCount} 条连线）` : undefined}
        onDetailClick={workflow ? () => onOpenWorkflow(workflow.id) : undefined}
      />
      <StepRow
        icon={<Bot className="h-3.5 w-3.5" />}
        title="数字员工"
        done={!!agent}
        current={stage === 'workflow-drafted'}
        detail={agent?.name}
      />
      <StepRow
        icon={<Clock className="h-3.5 w-3.5" />}
        title="定时执行"
        done={stage === 'done'}
        current={stage === 'agent-drafted'}
      />

      {/* 生成后的流程要点：让用户在点「发布」前知道这条流程到底靠不靠谱 */}
      {workflow && !workflow.valid && (
        <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-2.5 py-2 text-[11px] text-destructive">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          校验未通过，无法发布：{workflow.validation.map((v) => v.message).join('；')}
        </div>
      )}
      {workflow && workflow.pendingAbilityNodes.length > 0 && (
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-2.5 py-2 text-[11px] text-amber-600">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          有 {workflow.pendingAbilityNodes.length} 个节点没有匹配到可用能力，当前由模型代为处理（内容可能是编的）：
          {workflow.pendingAbilityNodes.join('、')}。可先发布，之后在编辑器里挂载对应 Skill。
        </div>
      )}
      {pendingReview && (
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-2.5 py-2 text-[11px] text-amber-600">
          已提交审核。你没有审批权限，需管理员通过后才能配置定时执行。
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-2.5 py-2 text-[11px] text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        {stage === 'plan' && (
          <Button size="sm" className="h-7 text-xs gap-1.5" disabled={busy} onClick={onDraftWorkflow}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {busy ? '正在生成流程…' : '开始执行'}
          </Button>
        )}
        {stage === 'workflow-drafted' && (
          <Button size="sm" className="h-7 text-xs gap-1.5" disabled={busy || !workflow?.valid} onClick={onPublishWorkflow}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {busy ? '发布中…' : '确认发布工作流，并创建数字员工'}
          </Button>
        )}
        {stage === 'agent-drafted' && (
          <Button size="sm" className="h-7 text-xs gap-1.5" disabled={busy} onClick={onPublishAgent}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {busy ? '发布中…' : '确认发布数字员工'}
          </Button>
        )}
        {stage === 'done' && !pendingReview && (
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onGotoSchedule}>
            去配置定时执行 <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function StepRow({
  icon, title, done, current, detail, onDetailClick,
}: {
  icon: React.ReactNode; title: string; done: boolean; current: boolean;
  detail?: string; onDetailClick?: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
        done ? 'bg-green-500/10 text-green-600' : current ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      }`}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-xs font-medium ${done || current ? 'text-foreground' : 'text-muted-foreground'}`}>
          {title}
        </div>
        {detail && (
          onDetailClick ? (
            <button onClick={onDetailClick} className="text-[11px] text-primary hover:underline text-left">
              {detail}
            </button>
          ) : (
            <div className="text-[11px] text-muted-foreground">{detail}</div>
          )
        )}
      </div>
    </div>
  );
}
