'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SecurityReview } from '@/lib/mock-data';
import { apiFetch } from '@/lib/api/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  Database,
  Zap,
  GitBranch,
  Clock,
  User,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Wrench,
  MinusCircle
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { ScanResult, SecurityFinding, SecurityCheckCode } from '@/lib/security/scanners';

const riskConfig = {
  low: { label: '低风险', className: 'bg-green-500/10 text-green-500', icon: CheckCircle2 },
  medium: { label: '中风险', className: 'bg-yellow-500/10 text-yellow-500', icon: AlertTriangle },
  high: { label: '高风险', className: 'bg-destructive/10 text-destructive', icon: XCircle }
};

const resourceTypeConfig = {
  skill: { label: 'Skill', icon: Zap },
  agent: { label: 'Agent', icon: FileText },
  workflow: { label: '工作流', icon: GitBranch }
};

const statusConfig = {
  pending: { label: '待审核', className: 'bg-yellow-500/10 text-yellow-500' },
  approved: { label: '已通过', className: 'bg-green-500/10 text-green-500' },
  rejected: { label: '已驳回', className: 'bg-destructive/10 text-destructive' }
};

// 审计日志（/api/audit 返回形状，规格化后一条记录）
type AuditLog = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown>;
  actorId: string | null;
  actorName: string | null;
  ip: string | null;
  createdAt: string | null;
};

// SEC-2/SEC-3：核查结果面板。抽成独立组件，避免 SecurityView 继续膨胀。
function SecurityScanPanel({
  review, scan, loading, error, fixing, onAutoFix,
}: {
  review: SecurityReview
  scan: ScanResult | null
  loading: boolean
  error: string | null
  fixing: boolean
  onAutoFix: (codes: SecurityCheckCode[]) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />正在核查 AI 安全项...
      </div>
    )
  }
  if (error) {
    return <div className="text-sm text-destructive py-2">安全核查失败：{error}</div>
  }
  if (!scan) {
    // workflow 暂不支持扫描；如实说明，不假装"全部通过"
    return (
      <div className="text-sm text-muted-foreground py-2">
        {review.resourceType === 'workflow'
          ? '工作流的自动安全核查尚未支持，请人工审阅节点配置。'
          : '未能读取该资源配置，无法自动核查。'}
      </div>
    )
  }

  const hits = scan.findings.filter((f) => f.status === 'hit')
  const passed = scan.findings.filter((f) => f.status === 'pass')
  const na = scan.findings.filter((f) => f.status === 'n/a')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          AI 安全自动核查
        </h4>
        <Badge className={riskConfig[scan.riskLevel].className}>
          建议：{riskConfig[scan.riskLevel].label}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {scan.summary.high > 0 && <span className="px-2 py-1 rounded bg-destructive/10 text-destructive">高危 {scan.summary.high}</span>}
        {scan.summary.medium > 0 && <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-600">中危 {scan.summary.medium}</span>}
        {scan.summary.low > 0 && <span className="px-2 py-1 rounded bg-muted text-muted-foreground">低危 {scan.summary.low}</span>}
        <span className="px-2 py-1 rounded bg-green-500/10 text-green-600">通过 {scan.summary.passed}</span>
        {scan.summary.na > 0 && <span className="px-2 py-1 rounded bg-muted text-muted-foreground">不适用 {scan.summary.na}</span>}
      </div>

      {scan.autoFixable.length > 0 && (
        <Button size="sm" className="w-full gap-2" disabled={fixing}
          onClick={() => onAutoFix(scan.autoFixable)}>
          {fixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
          确认并自动处理 {scan.autoFixable.length} 项
        </Button>
      )}

      {hits.map((f) => <FindingRow key={f.code} f={f} />)}

      {hits.length === 0 && (
        <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-sm text-green-600 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />全部核查项通过
        </div>
      )}

      {(passed.length > 0 || na.length > 0) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            查看已通过 / 不适用的 {passed.length + na.length} 项
          </summary>
          <div className="mt-2 space-y-1.5">
            {passed.map((f) => (
              <div key={f.code} className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <span><span className="text-foreground">{f.title}</span> — {f.detail}</span>
              </div>
            ))}
            {na.map((f) => (
              <div key={f.code} className="flex items-start gap-2 text-muted-foreground">
                <MinusCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span><span className="text-foreground">{f.title}</span> — {f.detail}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function FindingRow({ f }: { f: SecurityFinding }) {
  const tone = f.severity === 'high'
    ? { box: 'bg-destructive/5 border-destructive/20', icon: <XCircle className="h-4 w-4 text-destructive" />, label: 'bg-destructive/10 text-destructive' }
    : f.severity === 'medium'
      ? { box: 'bg-yellow-500/5 border-yellow-500/20', icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />, label: 'bg-yellow-500/10 text-yellow-600' }
      : { box: 'bg-muted/40 border-border', icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" />, label: 'bg-muted text-muted-foreground' }
  return (
    <div className={`p-3 rounded-lg border space-y-1.5 ${tone.box}`}>
      <div className="flex items-center gap-2">
        {tone.icon}
        <span className="text-sm font-medium text-foreground flex-1">{f.title}</span>
        <Badge className={`text-[10px] ${tone.label}`}>
          {f.severity === 'high' ? '高危' : f.severity === 'medium' ? '中危' : '低危'}
        </Badge>
        {f.autoFixable && <Badge variant="outline" className="text-[10px]">可自动处理</Badge>}
      </div>
      <p className="text-xs text-foreground/90">{f.detail}</p>
      <p className="text-xs text-muted-foreground">建议：{f.suggestion}</p>
    </div>
  )
}

export function SecurityView({ reviews }: { reviews?: SecurityReview[] }) {
  const [selectedReview, setSelectedReview] = useState<SecurityReview | null>(null);
  // 真实审批记录（4.1.3）——本地副本，裁决后就地更新
  const [allReviews, setAllReviews] = useState<SecurityReview[]>(reviews ?? []);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // 审计日志真实拉取
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);

  // SEC-2：选中待审记录时自动核查
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanLoadedKey, setScanLoadedKey] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    apiFetch<{ logs: AuditLog[] }>('/api/audit')
      .then(res => setLogs(res.logs))
      .catch(err => { setLogsError(err instanceof Error ? err.message : '加载失败'); setLogs([]); });
  }, []);

  const scanId = selectedReview?.status === 'pending' ? selectedReview.resourceId : undefined;
  const scanType = selectedReview?.resourceType;
  // 全部 setState 都落在 promise 链里，不放 effect 同步路径——
  // 后者会被 React 编译器判为可能触发级联渲染（react-hooks/set-state-in-effect），
  // 与 extensions-view / model-providers-view 同款写法。
  // loading 由 scanKey 变化推导，不再单独同步置位。
  const scanKey = scanId && scanType ? `${scanType}:${scanId}` : null;
  useEffect(() => {
    if (!scanKey) return;
    let cancelled = false;
    const [type, id] = scanKey.split(':');
    apiFetch<{ scan: ScanResult | null }>(`/api/reviews/scan?resourceType=${type}&resourceId=${id}`)
      .then(r => { if (!cancelled) { setScan(r.scan); setScanError(null); } })
      .catch(e => { if (!cancelled) { setScanError(e instanceof Error ? e.message : '核查失败'); setScan(null); } })
      .finally(() => { if (!cancelled) setScanLoadedKey(scanKey); });
    // 快速切换记录时，先发的请求可能后返回——用 cancelled 挡住，避免把 A 的结论显示在 B 上
    return () => { cancelled = true; };
  }, [scanKey]);
  // 已加载完成的 key 与当前 key 不一致 = 正在核查中
  const scanLoading = !!scanKey && scanLoadedKey !== scanKey;

  async function handleAutoFix(codes: SecurityCheckCode[]) {
    if (!selectedReview?.resourceId || fixing) return;
    setFixing(true); setScanError(null);
    try {
      const r = await apiFetch<{ changes: { description: string }[]; skipped: string[]; scan: ScanResult | null }>(
        '/api/reviews/autofix',
        {
          method: 'POST',
          body: JSON.stringify({
            resourceType: selectedReview.resourceType,
            resourceId: selectedReview.resourceId,
            codes,
          }),
        },
      );
      setScan(r.scan);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : '自动处理失败');
    } finally {
      setFixing(false);
    }
  }

  const pendingReviews = allReviews.filter(r => r.status === 'pending');
  const completedReviews = allReviews.filter(r => r.status !== 'pending');

  // 今日审计事件数（真实指标，取自已加载的审计日志）
  const today = new Date().toDateString();
  const todayAuditCount = (logs ?? []).filter(
    l => l.createdAt && new Date(l.createdAt).toDateString() === today,
  ).length;

  async function handleDecision(decision: 'approved' | 'rejected') {
    if (!selectedReview || submitting) return;
    if (!selectedReview.resourceId) {
      setActionError('该审批记录缺少资源标识，无法裁决');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await apiFetch('/api/reviews/decision', {
        method: 'POST',
        body: JSON.stringify({
          resourceId: selectedReview.resourceId,
          resourceType: selectedReview.resourceType,
          decision,
          comments: comment || undefined,
        }),
      });
      const decidedId = selectedReview.id;
      setAllReviews(prev => prev.map(r => (r.id === decidedId ? { ...r, status: decision } : r)));
      setSelectedReview(null);
      setComment('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '裁决失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full gap-6">
      <div className={`flex-1 space-y-6 ${selectedReview ? 'max-w-2xl' : ''}`}>
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">安全管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">审核 Skill、Agent 和工作流的安全风险</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{pendingReviews.length}</p>
                  <p className="text-xs text-muted-foreground">待审核</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{allReviews.filter(r => r.riskLevel === 'high').length}</p>
                  <p className="text-xs text-muted-foreground">高风险项</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{completedReviews.filter(r => r.status === 'approved').length}</p>
                  <p className="text-xs text-muted-foreground">已通过</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{todayAuditCount}</p>
                  <p className="text-xs text-muted-foreground">今日审计事件</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="bg-muted/50 h-9">
            <TabsTrigger value="pending" className="gap-2">
              待审核
              {pendingReviews.length > 0 && (
                <Badge className="bg-destructive/10 text-destructive">{pendingReviews.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">已处理</TabsTrigger>
            <TabsTrigger value="logs">审计日志</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingReviews.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">暂无待审内容</div>
            )}
            {pendingReviews.map((review) => {
              const RiskIcon = riskConfig[review.riskLevel].icon;
              const ResourceIcon = resourceTypeConfig[review.resourceType].icon;
              return (
                <Card
                  key={review.id}
                  className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${
                    selectedReview?.id === review.id ? 'border-primary ring-1 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedReview(review)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg ${riskConfig[review.riskLevel].className} flex items-center justify-center`}>
                        <RiskIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">{review.resourceName}</h3>
                          <Badge variant="outline" className="text-xs">
                            <ResourceIcon className="h-3 w-3 mr-1" />
                            {resourceTypeConfig[review.resourceType].label}
                          </Badge>
                          <Badge className={riskConfig[review.riskLevel].className}>
                            {riskConfig[review.riskLevel].label}
                          </Badge>
                        </div>
                        {/* SEC-2：列表不再展示静态计数徽标（那三个字段从无数据），
                            具体命中项在右侧详情面板由实时核查给出 */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {review.submitter}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {review.submittedAt}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedReviews.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">暂无已处理记录</div>
            )}
            {completedReviews.map((review) => {
              const RiskIcon = riskConfig[review.riskLevel].icon;
              const ResourceIcon = resourceTypeConfig[review.resourceType].icon;
              return (
                <Card
                  key={review.id}
                  className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${
                    selectedReview?.id === review.id ? 'border-primary ring-1 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedReview(review)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg ${riskConfig[review.riskLevel].className} flex items-center justify-center`}>
                        <RiskIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">{review.resourceName}</h3>
                          <Badge variant="outline" className="text-xs">
                            <ResourceIcon className="h-3 w-3 mr-1" />
                            {resourceTypeConfig[review.resourceType].label}
                          </Badge>
                          <Badge className={statusConfig[review.status].className}>
                            {statusConfig[review.status].label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {review.submitter}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {review.submittedAt}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                {logs === null ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">加载中…</div>
                ) : logsError ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">{logsError}</div>
                ) : logs.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">暂无审计日志</div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log) => {
                      const kind = log.action.includes('approve')
                        ? 'approve'
                        : log.action.includes('reject') || log.action.includes('delete') || log.action.includes('block')
                        ? 'block'
                        : 'info';
                      const target = [log.targetType, log.targetId ? log.targetId.slice(0, 8) : null]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              kind === 'block' ? 'bg-destructive/10' :
                              kind === 'approve' ? 'bg-green-500/10' :
                              'bg-muted'
                            }`}>
                              {kind === 'block' ? <XCircle className="h-4 w-4 text-destructive" /> :
                               kind === 'approve' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                               <Eye className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{log.action}</p>
                              <p className="text-xs text-muted-foreground">
                                {[target, log.actorName].filter(Boolean).join(' · ') || '—'}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Detail Panel */}
      {selectedReview && selectedReview.status === 'pending' && (
        <div className="w-[450px] space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">{selectedReview.resourceName}</CardTitle>
                  <CardDescription>安全审核详情</CardDescription>
                </div>
                <Badge className={riskConfig[selectedReview.riskLevel].className}>
                  {riskConfig[selectedReview.riskLevel].label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* SEC-2：AI 安全自动核查（替代原三块从未有数据的静态占位） */}
              <SecurityScanPanel
                review={selectedReview}
                scan={scan}
                loading={scanLoading}
                error={scanError}
                fixing={fixing}
                onAutoFix={handleAutoFix}
              />

              {/* Review Comment */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">审核意见</h4>
                <Textarea
                  placeholder="请输入审核意见..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="bg-muted/30 border-border min-h-[100px]"
                />
              </div>

              {actionError && (
                <p className="text-sm text-destructive">{actionError}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                  onClick={() => handleDecision('approved')}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  审核通过
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={submitting}
                  onClick={() => handleDecision('rejected')}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  驳回
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Submitter Info */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm text-foreground">提交信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">提交人</span>
                  <span className="text-foreground">{selectedReview.submitter}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">提交时间</span>
                  <span className="text-foreground">{selectedReview.submittedAt}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">资源类型</span>
                  <span className="text-foreground">{resourceTypeConfig[selectedReview.resourceType].label}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
