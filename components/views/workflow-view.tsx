'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { mockWorkflows, Workflow } from '@/lib/mock-data';
import {
  Plus,
  Search,
  GitBranch,
  Play,
  Pause,
  Settings,
  Zap,
  Users,
  CheckCircle,
  Clock,
  ArrowRight,
  MessageSquare,
  Database,
  Bot
} from 'lucide-react';

const statusConfig = {
  draft: { label: '草稿', className: 'bg-muted text-muted-foreground' },
  published: { label: '已发布', className: 'bg-green-500/10 text-green-500' },
  offline: { label: '已下线', className: 'bg-destructive/10 text-destructive' }
};

const typeConfig = {
  internal: { label: 'Agent 内部', className: 'bg-blue-500/10 text-blue-500' },
  'cross-agent': { label: '跨 Agent', className: 'bg-purple-500/10 text-purple-500' }
};

export function WorkflowView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  const filteredWorkflows = mockWorkflows.filter(wf =>
    wf.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full gap-6">
      <div className={`flex-1 space-y-6 ${selectedWorkflow ? 'max-w-xl' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-foreground">工作流管理</h1>
            <p className="text-sm text-muted-foreground mt-0.5">可视化编排 AI 业务流程</p>
          </div>
          <Button className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            创建工作流
          </Button>
        </div>

        {/* Natural Language Input */}
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="用自然语言描述你的工作流需求，AI 将自动生成初始流程..."
                  className="bg-card/50 border-border"
                />
              </div>
              <Button>
                <Zap className="h-4 w-4 mr-2" />
                生成流程
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索工作流..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>

        {/* Workflow List */}
        <div className="space-y-4">
          {filteredWorkflows.map((workflow) => (
            <Card
              key={workflow.id}
              className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${
                selectedWorkflow?.id === workflow.id ? 'border-primary ring-1 ring-primary' : ''
              }`}
              onClick={() => setSelectedWorkflow(workflow)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground">{workflow.name}</h3>
                      <Badge className={typeConfig[workflow.type].className}>
                        {typeConfig[workflow.type].label}
                      </Badge>
                      <Badge className={statusConfig[workflow.status].className}>
                        {statusConfig[workflow.status].label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {workflow.nodes} 节点
                      </span>
                      <span className="flex items-center gap-1">
                        <Play className="h-3 w-3" />
                        {workflow.executions} 次执行
                      </span>
                      {workflow.successRate > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {workflow.successRate}% 成功率
                        </span>
                      )}
                      {workflow.lastRun !== '-' && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {workflow.lastRun}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Workflow Detail / Visual Editor Preview */}
      {selectedWorkflow && (
        <div className="flex-1 space-y-4">
          <Card className="bg-card border-border h-full">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">{selectedWorkflow.name}</CardTitle>
                  <CardDescription>可视化流程编辑器</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Play className="h-4 w-4 mr-2" />
                    调试
                  </Button>
                  <Button size="sm">
                    发布
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Visual Workflow Preview */}
              <div className="h-[500px] bg-muted/20 rounded-xl border border-border p-6 overflow-auto">
                <div className="flex flex-col items-center gap-4">
                  {/* Start Node */}
                  <div className="w-24 h-10 rounded-lg bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                    <span className="text-sm text-green-500 font-medium">开始</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />

                  {/* User Input Node */}
                  <div className="w-64 p-4 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center">
                        <MessageSquare className="h-3 w-3 text-blue-500" />
                      </div>
                      <span className="text-sm font-medium text-foreground">用户输入</span>
                    </div>
                    <p className="text-xs text-muted-foreground">接收用户请求并解析意图</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />

                  {/* Condition Node */}
                  <div className="w-64 p-4 rounded-xl bg-card border border-yellow-500/40">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded bg-yellow-500/20 flex items-center justify-center">
                        <GitBranch className="h-3 w-3 text-yellow-500" />
                      </div>
                      <span className="text-sm font-medium text-foreground">条件判断</span>
                    </div>
                    <p className="text-xs text-muted-foreground">判断请求类型和优先级</p>
                  </div>

                  {/* Branch */}
                  <div className="flex gap-8">
                    <div className="flex flex-col items-center gap-4">
                      <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                      <div className="w-48 p-3 rounded-xl bg-card border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center">
                            <Database className="h-3 w-3 text-purple-500" />
                          </div>
                          <span className="text-sm font-medium text-foreground">查询知识库</span>
                        </div>
                        <p className="text-xs text-muted-foreground">检索相关信息</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                      <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                      <div className="w-48 p-3 rounded-xl bg-card border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded bg-orange-500/20 flex items-center justify-center">
                            <Users className="h-3 w-3 text-orange-500" />
                          </div>
                          <span className="text-sm font-medium text-foreground">人工审批</span>
                        </div>
                        <p className="text-xs text-muted-foreground">等待审批确认</p>
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />

                  {/* AI Processing Node */}
                  <div className="w-64 p-4 rounded-xl bg-card border border-primary/40">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                        <Bot className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground">AI 处理</span>
                    </div>
                    <p className="text-xs text-muted-foreground">调用 Agent 生成回复</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />

                  {/* End Node */}
                  <div className="w-24 h-10 rounded-lg bg-destructive/20 border border-destructive/40 flex items-center justify-center">
                    <span className="text-sm text-destructive font-medium">结束</span>
                  </div>
                </div>
              </div>

              {/* Node Library */}
              <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border">
                <h4 className="text-sm font-medium text-foreground mb-3">节点库</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: MessageSquare, label: '用户输入', color: 'blue' },
                    { icon: GitBranch, label: '条件判断', color: 'yellow' },
                    { icon: Database, label: '知识库', color: 'purple' },
                    { icon: Zap, label: 'Skill 调用', color: 'green' },
                    { icon: Bot, label: 'Agent 调用', color: 'primary' },
                    { icon: Users, label: '人工审批', color: 'orange' },
                  ].map((node) => (
                    <div
                      key={node.label}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <node.icon className={`h-4 w-4 text-${node.color}-500`} />
                      <span className="text-sm text-foreground">{node.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
