'use client';

// 监测下级页（4.4.7b）：对齐 Dify「监测」——基于真实运行历史聚合指标看板。
// 诚实约束：后端 listRuns 仅返回最近 50 条，故指标标注为「近 N 次运行」，不谎称全量总计。
import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Activity, CheckCircle2, Timer, Gauge } from 'lucide-react';

type Run = { id: string; status: string; durationMs: number | null; createdAt: string };

function pct(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function WorkflowMonitorPage({ workflowId }: { workflowId: string }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/workflows/${workflowId}/runs`);
        if (!res.ok) {
          if (active) setError('加载失败：无权限或未登录');
          return;
        }
        const { runs } = await res.json();
        if (active) setRuns(Array.isArray(runs) ? runs : []);
      } catch {
        if (active) setError('加载失败：网络错误');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [workflowId]);

  const stats = useMemo(() => {
    const total = runs.length;
    const succeeded = runs.filter((r) => r.status === 'succeeded').length;
    const durations = runs.map((r) => r.durationMs).filter((d): d is number => typeof d === 'number');
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const p95 = Math.round(pct(durations, 95));
    // 按日聚合成功/失败
    const byDay = new Map<string, { date: string; 成功: number; 失败: number }>();
    for (const r of runs) {
      const date = (r.createdAt || '').slice(0, 10) || '—';
      const row = byDay.get(date) ?? { date, 成功: 0, 失败: 0 };
      if (r.status === 'succeeded') row.成功 += 1;
      else row.失败 += 1;
      byDay.set(date, row);
    }
    const trend = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    return { total, succeeded, successRate: total ? Math.round((succeeded / total) * 100) : 0, avg, p95, trend };
  }, [runs]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">加载中…</div>;
  }
  if (error) {
    return <div className="flex h-full items-center justify-center text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-base font-medium text-foreground">监测</h2>
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            基于最近 {stats.total} 次运行（最多 50）
          </span>
        </div>

        {stats.total === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <Activity className="h-9 w-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">尚无运行记录。在「编排」页点击「测试运行」后，这里会出现指标。</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={Activity} label="调用次数" value={String(stats.total)} hint="近 50 次内" />
              <StatCard icon={CheckCircle2} label="成功率" value={`${stats.successRate}%`} hint={`${stats.succeeded}/${stats.total} 成功`} />
              <StatCard icon={Timer} label="平均耗时" value={`${stats.avg} ms`} />
              <StatCard icon={Gauge} label="P95 耗时" value={`${stats.p95} ms`} />
            </div>

            <div className="rounded-xl border border-border p-5">
              <h3 className="mb-3 text-sm font-medium text-foreground">每日调用趋势</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="成功" stackId="a" fill="var(--primary)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="失败" stackId="a" fill="var(--destructive)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
