'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { mockAgents, Agent } from '@/lib/mock-data';
import {
  Bot,
  Plus,
  Search,
  Settings,
  Play,
  Pause,
  Trash2,
  MoreHorizontal,
  Filter,
  Zap,
  Database,
  GitBranch,
  MessageSquare,
  Copy
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const statusConfig = {
  draft: { label: '草稿', className: 'bg-muted text-muted-foreground' },
  pending: { label: '待审核', className: 'bg-yellow-500/10 text-yellow-500' },
  published: { label: '已发布', className: 'bg-green-500/10 text-green-500' },
  offline: { label: '已下线', className: 'bg-destructive/10 text-destructive' }
};

export function AgentsAdminView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const filteredAgents = mockAgents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full gap-6">
      {/* Agent List */}
      <div className={`flex-1 space-y-4 ${selectedAgent ? 'max-w-xl' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Agent 管理</h1>
            <p className="text-muted-foreground">创建、配置和管理 AI Agent</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            创建 Agent
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索 Agent 名称或部门..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            筛选
          </Button>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-1 gap-4">
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${
                selectedAgent?.id === agent.id ? 'border-primary ring-1 ring-primary' : ''
              }`}
              onClick={() => setSelectedAgent(agent)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-2xl">
                    {agent.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground truncate">{agent.name}</h3>
                      <Badge className={statusConfig[agent.status].className}>
                        {statusConfig[agent.status].label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{agent.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {agent.model}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {agent.calls.toLocaleString()} 次调用
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {(agent.tokenUsage / 1000000).toFixed(2)}M tokens
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuItem>
                        <Settings className="h-4 w-4 mr-2" />
                        配置
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Play className="h-4 w-4 mr-2" />
                        调试
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="h-4 w-4 mr-2" />
                        复制
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {agent.status === 'published' ? (
                        <DropdownMenuItem>
                          <Pause className="h-4 w-4 mr-2" />
                          下线
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem>
                          <Play className="h-4 w-4 mr-2" />
                          发布
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Agent Detail Panel */}
      {selectedAgent && (
        <div className="w-[480px] space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xl">
                    {selectedAgent.avatar}
                  </div>
                  <div>
                    <CardTitle className="text-foreground">{selectedAgent.name}</CardTitle>
                    <CardDescription>{selectedAgent.department}</CardDescription>
                  </div>
                </div>
                <Badge className={statusConfig[selectedAgent.status].className}>
                  {statusConfig[selectedAgent.status].label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">{selectedAgent.description}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">总调用量</p>
                  <p className="text-lg font-semibold text-foreground">{selectedAgent.calls.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">成功率</p>
                  <p className="text-lg font-semibold text-foreground">{selectedAgent.successRate}%</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Token 消耗</p>
                  <p className="text-lg font-semibold text-foreground">{(selectedAgent.tokenUsage / 1000000).toFixed(2)}M</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">创建日期</p>
                  <p className="text-lg font-semibold text-foreground">{selectedAgent.createdAt}</p>
                </div>
              </div>

              {/* Configuration */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">配置信息</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">模型</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{selectedAgent.model}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">知识库</span>
                    </div>
                    <span className="text-sm text-muted-foreground">2 个已绑定</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">Skill</span>
                    </div>
                    <span className="text-sm text-muted-foreground">5 个已绑定</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">工作流</span>
                    </div>
                    <span className="text-sm text-muted-foreground">1 个已绑定</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button className="flex-1">
                  <Settings className="h-4 w-4 mr-2" />
                  编辑配置
                </Button>
                <Button variant="outline" className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  调试测试
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* API Token */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm text-foreground">API Token</CardTitle>
              <CardDescription>用于外部系统调用此 Agent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 rounded bg-muted text-xs text-muted-foreground font-mono truncate">
                  ap_sk_live_xxxxxxxxxxxxxxxxxxxxx
                </code>
                <Button variant="outline" size="sm">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
