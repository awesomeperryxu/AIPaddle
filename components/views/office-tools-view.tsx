'use client';

import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileText, Upload, Loader2, Download, AlertCircle } from 'lucide-react';

// 办公文件处理（4.2.4 通道①）：客户端只经 fetch 调 /api/office/process（ADR-008，不直连 DB）。
// 端点返回生成文件的二进制，故走原生 fetch 而非 apiFetch（后者按 JSON 解析）。

type Task = 'summarize' | 'rewrite' | 'translate';
type Format = 'docx' | 'xlsx' | 'pdf';

const TASKS: { value: Task; label: string; desc: string }[] = [
  { value: 'summarize', label: '总结', desc: '提炼要点，输出摘要' },
  { value: 'rewrite', label: '改写', desc: '优化表达，保持原意' },
  { value: 'translate', label: '翻译', desc: '翻译为目标语言' },
];

const FORMATS: { value: Format; label: string }[] = [
  { value: 'docx', label: 'Word (.docx)' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'pdf', label: 'PDF (.pdf)' },
];

// 从 Content-Disposition 解析 filename*（UTF-8''… 优先），失败回退。
function parseFilename(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try { return decodeURIComponent(star[1]); } catch { /* 忽略解码失败 */ }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ?? fallback;
}

export function OfficeToolsView() {
  const [file, setFile] = useState<File | null>(null);
  const [task, setTask] = useState<Task>('summarize');
  const [format, setFormat] = useState<Format>('docx');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcess = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('task', task);
      fd.append('format', format);
      const res = await fetch('/api/office/process', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message ?? '处理失败');
        return;
      }
      const blob = await res.blob();
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const fallback = `${baseName}-${task}.${format}`;
      const downloadName = parseFilename(res.headers.get('Content-Disposition'), fallback);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('处理失败：网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">办公文件处理</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          上传文件，由 AI 总结 / 改写 / 翻译，生成 Word / Excel / PDF 下载
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">1. 选择文件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError('');
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 p-4 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {file ? <FileText className="h-5 w-5 text-primary" /> : <Upload className="h-5 w-5 text-primary" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {file ? file.name : '点击选择 PDF 文件'}
              </p>
              <p className="text-xs text-muted-foreground">当前仅支持含文本的 PDF</p>
            </div>
          </button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">2. 处理方式</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TASKS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTask(t.value)}
              className={cn(
                'p-3 rounded-lg border text-left transition-colors',
                task === t.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
              )}
            >
              <p className="text-sm font-medium text-foreground">{t.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">3. 输出格式</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormat(f.value)}
              className={cn(
                'px-4 py-2 rounded-lg border text-sm transition-colors',
                format === f.value ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {f.label}
            </button>
          ))}
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button className="w-full gap-2" disabled={!file || loading} onClick={handleProcess}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {loading ? '处理中…' : '开始处理并下载'}
      </Button>
    </div>
  );
}
