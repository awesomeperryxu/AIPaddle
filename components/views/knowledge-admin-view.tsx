'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { mockKnowledgeBases, KnowledgeBase } from '@/lib/mock-data';
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  Search,
  Upload,
  Database,
  FileText,
  FolderOpen,
  Settings,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const statusConfig = {
  processing: { label: '处理中', className: 'bg-yellow-500/10 text-yellow-500', icon: Clock },
  completed: { label: '已完成', className: 'bg-green-500/10 text-green-500', icon: CheckCircle2 },
  failed: { label: '失败', className: 'bg-destructive/10 text-destructive', icon: XCircle }
};

export function KnowledgeAdminView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);

  const filteredKBs = mockKnowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full gap-6">
      <div className={`flex-1 space-y-6 ${selectedKB ? 'max-w-2xl' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">知识库管理</h1>
            <p className="text-muted-foreground">管理企业知识文档</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            创建知识库
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{mockKnowledgeBases.length}</p>
                  <p className="text-xs text-muted-foreground">知识库数量</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{mockKnowledgeBases.reduce((acc, kb) => acc + kb.documents, 0)}</p>
                  <p className="text-xs text-muted-foreground">总文档数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{mockKnowledgeBases.filter(kb => kb.vectorStatus === 'completed').length}</p>
                  <p className="text-xs text-muted-foreground">已完成向量化</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{mockKnowledgeBases.filter(kb => kb.vectorStatus === 'processing').length}</p>
                  <p className="text-xs text-muted-foreground">处理中</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索知识库..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>

        {/* Knowledge Base List */}
        <div className="space-y-4">
          {filteredKBs.map((kb) => {
            const StatusIcon = statusConfig[kb.vectorStatus].icon;
            return (
              <Card
                key={kb.id}
                className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${
                  selectedKB?.id === kb.id ? 'border-primary ring-1 ring-primary' : ''
                }`}
                onClick={() => setSelectedKB(kb)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FolderOpen className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground">{kb.name}</h3>
                        <Badge className={statusConfig[kb.vectorStatus].className}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[kb.vectorStatus].label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{kb.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {kb.documents} 文档
                        </span>
                        <span>{kb.size}</span>
                        <span>更新于 {kb.lastUpdated}</span>
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
                          <Upload className="h-4 w-4 mr-2" />
                          上传文档
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          重新向量化
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Settings className="h-4 w-4 mr-2" />
                          设置
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          删除知识库
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Knowledge Base Detail */}
      {selectedKB && (
        <div className="w-[420px] space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-foreground">{selectedKB.name}</CardTitle>
                  <CardDescription>{selectedKB.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold text-foreground">{selectedKB.documents}</p>
                  <p className="text-xs text-muted-foreground">文档数量</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold text-foreground">{selectedKB.size}</p>
                  <p className="text-xs text-muted-foreground">存储大小</p>
                </div>
              </div>

              {/* Vector Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-foreground">向量化状态</h4>
                  <Badge className={statusConfig[selectedKB.vectorStatus].className}>
                    {statusConfig[selectedKB.vectorStatus].label}
                  </Badge>
                </div>
                {selectedKB.vectorStatus === 'processing' ? (
                  <div className="space-y-2">
                    <Progress value={65} className="h-2" />
                    <p className="text-xs text-muted-foreground">正在处理: 技术架构文档.pdf (65%)</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">所有文档已完成向量化处理</p>
                )}
              </div>

              {/* Recent Documents */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">最近文档</h4>
                <div className="space-y-2">
                  {['员工手册 v2.0.pdf', '请假制度说明.docx', '福利政策.md'].map((doc) => (
                    <div key={doc} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{doc}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">权限范围</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">全员可访问</Badge>
                  <Badge variant="outline">HR政策顾问 Agent</Badge>
                  <Badge variant="outline">智能客服助手 Agent</Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  上传文档
                </Button>
                <Button variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  测试召回
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Supported Formats */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm text-foreground">支持的文档格式</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['PDF', 'Word', 'Excel', 'Markdown', 'TXT', 'HTML'].map((format) => (
                  <Badge key={format} variant="outline" className="text-xs">
                    {format}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
