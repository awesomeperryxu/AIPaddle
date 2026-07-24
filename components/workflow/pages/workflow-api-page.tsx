'use client';

// 访问 API 下级页（4.4.7a）：对齐 Dify「访问 API」——展示对外调用该工作流的
// 真实端点、鉴权说明、请求/响应示例与字段文档。不造假数据、不伪造密钥：
// 独立 API Key（Bearer）尚未接入（见 4.4.7a-2），此处如实标注当前鉴权=登录会话。
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Code2, Copy, Check, KeyRound, AlertTriangle } from 'lucide-react';

type Wf = { id: string; name: string; status: 'draft' | 'published'; type: 'workflow' | 'chatflow' };

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* 剪贴板不可用时静默：用户仍可手动选中复制 */
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
      aria-label={label ?? '复制'}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? '已复制' : label ?? '复制'}
    </button>
  );
}

function CodeBlock({ code, copyable = true }: { code: string; copyable?: boolean }) {
  return (
    <div className="relative">
      {copyable && (
        <div className="absolute right-2 top-2">
          <CopyButton text={code} />
        </div>
      )}
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-5">
      <h3 className="mb-3 text-sm font-medium text-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function WorkflowApiPage({ workflowId }: { workflowId: string }) {
  const [wf, setWf] = useState<Wf | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 本页仅在用户切到「访问 API」标签后渲染（编辑器早已 hydrate），window 必然存在，
  // 故渲染时直接读 origin，无需 state/effect（避免 effect 内同步 setState）。
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (!res.ok) {
          if (active) setError('加载失败：无权限或未登录');
          return;
        }
        const { workflow } = await res.json();
        if (active) setWf(workflow ?? null);
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

  const endpoint = `${origin}/api/workflows/${workflowId}/run`;
  const published = wf?.status === 'published';

  const curl = [
    `curl -X POST '${endpoint}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'Cookie: <你的登录会话 Cookie>' \\`,
    `  -d '{ "input": "你好，请介绍一下你自己" }'`,
  ].join('\n');

  const respExample = JSON.stringify(
    {
      run: {
        id: 'a1b2c3d4-…',
        status: 'succeeded',
        output: '（工作流最终输出文本）',
        durationMs: 1280,
        traces: [
          { nodeId: 'start', type: 'start', status: 'succeeded', ms: 0 },
          { nodeId: 'llm-1', type: 'llm', status: 'succeeded', ms: 1200 },
          { nodeId: 'end', type: 'end', status: 'succeeded', ms: 1 },
        ],
      },
    },
    null,
    2,
  );

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
          <Code2 className="h-5 w-5 text-primary" />
          <h2 className="text-base font-medium text-foreground">访问 API</h2>
          <span
            className={cn(
              'ml-1 rounded-full px-2 py-0.5 text-xs',
              published ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600',
            )}
          >
            {published ? '已发布' : '未发布'}
          </span>
        </div>

        {!published && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>该工作流尚未发布。以下端点与示例仅供参考，<span className="font-semibold">发布后</span>方可稳定对外调用（未发布时草稿图仍可测试运行）。</p>
          </div>
        )}

        <Section title="API 端点">
          <p className="mb-2 text-xs text-muted-foreground">向该端点 POST 一段输入，即可运行本工作流并取回结果与各节点执行轨迹。</p>
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">POST</span>
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
              {endpoint}
            </code>
            <CopyButton text={endpoint} />
          </div>
        </Section>

        <Section title="鉴权">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p>当前调用经<span className="font-medium text-foreground">登录会话（Cookie）</span>鉴权，并按租户（org）做 RLS 隔离——只有本租户已登录用户可调用。</p>
              <p className="text-xs">
                独立 <span className="font-medium text-foreground">API Key（Bearer Token）</span> 管理即将上线（4.4.7a-2），
                届时可脱离浏览器会话、用密钥直接对外调用。
              </p>
            </div>
          </div>
        </Section>

        <Section title="请求">
          <p className="mb-2 text-xs text-muted-foreground">
            请求体为 JSON，字段 <code className="text-foreground">input</code>（string）= 工作流的起始输入文本。
          </p>
          <CodeBlock code={curl} />
        </Section>

        <Section title="响应">
          <p className="mb-2 text-xs text-muted-foreground">返回本次运行记录（已落库到运行历史，可在「日志」页查看）。</p>
          <CodeBlock code={respExample} />
        </Section>

        <Section title="字段说明">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">字段</th>
                  <th className="py-2 pr-4 font-medium">类型</th>
                  <th className="py-2 font-medium">说明</th>
                </tr>
              </thead>
              <tbody className="text-foreground">
                {[
                  ['input（请求）', 'string', '工作流起始输入文本'],
                  ['run.id', 'string', '本次运行记录 ID（落库到运行历史）'],
                  ['run.status', 'string', "运行状态：succeeded / failed"],
                  ['run.output', 'string', '工作流最终输出文本'],
                  ['run.durationMs', 'number', '本次运行耗时（毫秒）'],
                  ['run.traces[]', 'array', '各节点执行轨迹（nodeId / type / status / ms / error?）'],
                ].map(([f, t, d]) => (
                  <tr key={f} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono">{f}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{t}</td>
                    <td className="py-2 text-muted-foreground">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}
