'use client';

// 日志下级页：真实拉取运行历史（GET /api/workflows/[id]/runs），对齐 Dify「日志」页。
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, ScrollText } from 'lucide-react';

type Run = {
  id: string;
  status: string;
  durationMs: number | null;
  input: string;
  output: string;
  traceCount: number;
  createdAt: string;
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  succeeded: { text: '成功', cls: 'text-emerald-600 bg-emerald-500/10' },
  failed: { text: '失败', cls: 'text-destructive bg-destructive/10' },
  running: { text: '运行中', cls: 'text-amber-600 bg-amber-500/10' },
  waiting: { text: '等待', cls: 'text-muted-foreground bg-muted' },
  exception: { text: '异常', cls: 'text-destructive bg-destructive/10' },
  paused: { text: '暂停', cls: 'text-muted-foreground bg-muted' },
};

export function WorkflowLogsPage({ workflowId }: { workflowId: string }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`);
      if (!res.ok) { setError('加载失败：无权限或未登录'); return; }
      const { runs } = await res.json();
      setRuns(Array.isArray(runs) ? runs : []);
    } catch { setError('加载失败：网络错误'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}/runs`);
        if (!res.ok) { if (active) setError('加载失败：无权限或未登录'); return; }
        const { runs } = await res.json();
        if (active) setRuns(Array.isArray(runs) ? runs : []);
      } catch { if (active) setError('加载失败：网络错误'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [workflowId]);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">运行日志</h3>
          <p className="text-xs text-muted-foreground">工作流每次运行的输入 / 输出 / 状态 / 耗时 / 节点轨迹数（最近 50 条）。</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          刷新
        </button>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}

      {!error && loading && <div className="p-8 text-center text-sm text-muted-foreground">加载中…</div>}

      {!error && !loading && runs.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <ScrollText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无运行记录</p>
          <p className="text-xs text-muted-foreground">在「编排」页点击「测试运行」后，这里会出现运行历史。</p>
        </div>
      )}

      {!error && !loading && runs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">时间</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">耗时</th>
                <th className="px-4 py-2 font-medium">输入</th>
                <th className="px-4 py-2 font-medium">输出</th>
                <th className="px-4 py-2 font-medium">节点数</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const s = STATUS_LABEL[r.status] ?? { text: r.status, cls: 'text-muted-foreground bg-muted' };
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{r.createdAt}</td>
                    <td className="px-4 py-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-xs', s.cls)}>{s.text}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{r.durationMs != null ? `${r.durationMs} ms` : '—'}</td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-xs" title={r.input}>{r.input || '—'}</td>
                    <td className="max-w-[240px] truncate px-4 py-2 text-xs" title={r.output}>{r.output || '—'}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.traceCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
