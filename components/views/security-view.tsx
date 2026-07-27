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
  ChevronRight
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

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

  useEffect(() => {
    apiFetch<{ logs: AuditLog[] }>('/api/audit')
      .then(res => setLogs(res.logs))
      .catch(err => { setLogsError(err instanceof Error ? err.message : '加载失败'); setLogs([]); });
  }, []);

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
                        <div className="flex flex-wrap gap-2 mt-2">
                          {review.sensitiveDataFound.length > 0 && (
                            <span className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive">
                              敏感数据: {review.sensitiveDataFound.length}
                            </span>
                          )}
                          {review.illegalInstructions.length > 0 && (
                            <span className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive">
                              非法指令: {review.illegalInstructions.length}
                            </span>
                          )}
                          {review.dbRisks.length > 0 && (
                            <span className="text-xs px-2 py-1 rounded bg-yellow-500/10 text-yellow-500">
                              DB风险: {review.dbRisks.length}
                            </span>
                          )}
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
              {/* Sensitive Data */}
              {selectedReview.sensitiveDataFound.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    敏感信息检测
                  </h4>
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <ul className="space-y-1">
                      {selectedReview.sensitiveDataFound.map((item, index) => (
                        <li key={index} className="text-sm text-foreground flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Illegal Instructions */}
              {selectedReview.illegalInstructions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    非法指令检测
                  </h4>
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <ul className="space-y-1">
                      {selectedReview.illegalInstructions.map((item, index) => (
                        <li key={index} className="text-sm text-foreground flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* DB Risks */}
              {selectedReview.dbRisks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Database className="h-4 w-4 text-yellow-500" />
                    数据库接口风险
                  </h4>
                  <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <ul className="space-y-1">
                      {selectedReview.dbRisks.map((item, index) => (
                        <li key={index} className="text-sm text-foreground flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

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
