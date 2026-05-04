'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mockSecurityReviews, SecurityReview } from '@/lib/mock-data';
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

export function SecurityView() {
  const [selectedReview, setSelectedReview] = useState<SecurityReview | null>(null);

  const pendingReviews = mockSecurityReviews.filter(r => r.status === 'pending');
  const completedReviews = mockSecurityReviews.filter(r => r.status !== 'pending');

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
                  <p className="text-lg font-semibold text-foreground">{mockSecurityReviews.filter(r => r.riskLevel === 'high').length}</p>
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
                  <p className="text-lg font-semibold text-foreground">23</p>
                  <p className="text-xs text-muted-foreground">今日拦截</p>
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
                <div className="space-y-3">
                  {[
                    { action: '拦截非法指令', user: '系统', target: '用户输入检测', time: '16:30:45', type: 'block' },
                    { action: '审核通过', user: '赵强', target: '合同审批流程', time: '14:00:12', type: 'approve' },
                    { action: '敏感信息检测', user: '系统', target: 'Agent 输出', time: '13:45:30', type: 'detect' },
                    { action: '拦截越权调用', user: '系统', target: 'DB 查询', time: '12:20:15', type: 'block' },
                    { action: '风险标记', user: '系统', target: 'API 调用', time: '11:05:00', type: 'warn' },
                  ].map((log, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          log.type === 'block' ? 'bg-destructive/10' :
                          log.type === 'approve' ? 'bg-green-500/10' :
                          log.type === 'detect' ? 'bg-yellow-500/10' :
                          'bg-muted'
                        }`}>
                          {log.type === 'block' ? <XCircle className="h-4 w-4 text-destructive" /> :
                           log.type === 'approve' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                           log.type === 'detect' ? <Eye className="h-4 w-4 text-yellow-500" /> :
                           <AlertTriangle className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{log.action}</p>
                          <p className="text-xs text-muted-foreground">{log.target} · {log.user}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{log.time}</span>
                    </div>
                  ))}
                </div>
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
                  className="bg-muted/30 border-border min-h-[100px]"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button className="flex-1 bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  审核通过
                </Button>
                <Button variant="destructive" className="flex-1">
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
