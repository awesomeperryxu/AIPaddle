'use client';

// 测试运行抽屉（W1-c）：接真实 POST /api/workflows/[id]/run，展示真实运行结果与逐节点轨迹。
// 说明：当前执行引擎仅实跑 start/llm/end，其余节点标记 skipped（透传）——面板如实呈现，不造假。
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Trace = {
  nodeId: string;
  type: string;
  status: 'succeeded' | 'failed' | 'skipped';
  input?: string;
  output?: string;
  error?: string;
  ms: number;
};
type RunResult = {
  id: string | null;
  status: 'succeeded' | 'failed';
  output: string;
  traces: Trace[];
  durationMs: number;
};

const TRACE_STATUS: Record<Trace['status'], { text: string; cls: string }> = {
  succeeded: { text: '成功', cls: 'text-emerald-600 bg-emerald-500/10' },
  failed: { text: '失败', cls: 'text-destructive bg-destructive/10' },
  skipped: { text: '跳过', cls: 'text-muted-foreground bg-muted' },
};

export function WorkflowRunDrawer({
  workflowId,
  open,
  beforeRun,
  onClose,
  onFinished,
}: {
  workflowId: string;
  open: boolean;
  beforeRun?: () => Promise<void>;
  onClose: () => void;
  onFinished?: () => void;
}) {
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      await beforeRun?.(); // 运行前先保存最新画布
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? '运行失败：无权限或未登录');
        return;
      }
      setResult(body.run as RunResult);
      onFinished?.();
    } catch {
      setError('运行失败：网络错误');
    } finally {
      setRunning(false);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute inset-y-0 right-0 z-30 flex w-[420px] flex-col border-l border-border bg-background shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">测试运行</span>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 起始输入 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">起始输入</label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入工作流的起始输入（传给开始节点）…"
            className="min-h-[80px] text-sm"
          />
        </div>
        <Button onClick={run} disabled={running} className="w-full gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? '运行中…' : '运行'}
        </Button>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
        )}

        {result && (
          <div className="space-y-3">
            {/* 概要 */}
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-xs',
                  result.status === 'succeeded' ? 'text-emerald-600 bg-emerald-500/10' : 'text-destructive bg-destructive/10'
                )}
              >
                {result.status === 'succeeded' ? '运行成功' : '运行失败'}
              </span>
              <span className="text-xs text-muted-foreground">耗时 {result.durationMs} ms</span>
            </div>

            {/* 最终输出 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">最终输出</label>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words">
                {result.output || <span className="text-muted-foreground">（空）</span>}
              </div>
            </div>

            {/* 逐节点轨迹 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">节点轨迹（{result.traces.length}）</label>
              <div className="space-y-2">
                {result.traces.map((t, i) => {
                  const s = TRACE_STATUS[t.status] ?? { text: t.status, cls: 'text-muted-foreground bg-muted' };
                  return (
                    <div key={`${t.nodeId}-${i}`} className="rounded-lg border border-border p-2.5 text-xs">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium text-foreground">{t.type} · {t.nodeId}</span>
                        <span className="flex items-center gap-2">
                          <span className={cn('rounded px-1.5 py-0.5', s.cls)}>{s.text}</span>
                          <span className="text-muted-foreground">{t.ms} ms</span>
                        </span>
                      </div>
                      {t.error && <p className="text-destructive">{t.error}</p>}
                      {!t.error && t.output && (
                        <p className="text-muted-foreground break-words line-clamp-4" title={t.output}>{t.output}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
