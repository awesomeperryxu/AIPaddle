'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { mockSkills, Skill } from '@/lib/mock-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Search,
  Download,
  Zap,
  Database,
  Globe,
  GitBranch,
  MessageSquare,
  Shield,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react';

const typeConfig = {
  MCP: { icon: Globe, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  API: { icon: Zap, color: 'text-green-500', bg: 'bg-green-500/10' },
  DB: { icon: Database, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  Workflow: { icon: GitBranch, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  Prompt: { icon: MessageSquare, color: 'text-pink-500', bg: 'bg-pink-500/10' }
};

const riskConfig = {
  low: { label: '低', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  medium: { label: '中', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  high: { label: '高', className: 'bg-destructive/10 text-destructive border-destructive/20' }
};

const statusConfig = {
  draft: { label: '草稿', icon: XCircle, className: 'bg-muted text-muted-foreground' },
  pending: { label: '待审核', icon: Clock, className: 'bg-warning/10 text-warning' },
  published: { label: '已发布', icon: CheckCircle2, className: 'bg-green-500/10 text-green-600' }
};

export function SkillHubView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  const filteredSkills = mockSkills.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || skill.type === selectedType;
    return matchesSearch && matchesType;
  });

  const publishedSkills = filteredSkills.filter(s => s.status === 'published');
  const mySkills = filteredSkills.filter(s => s.publisher === '系统管理员' || s.publisher === 'IT部');

  const stats = {
    total: mockSkills.length,
    published: mockSkills.filter(s => s.status === 'published').length,
    pending: mockSkills.filter(s => s.status === 'pending').length,
    totalInstalls: mockSkills.reduce((acc, s) => acc + s.installs, 0),
  };

  return (
    <div className="flex h-full gap-6">
      <div className={`flex-1 flex flex-col min-w-0 ${selectedSkill ? 'max-w-2xl' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Skill Hub</h1>
            <p className="text-sm text-muted-foreground mt-0.5">企业 AI 能力市场</p>
          </div>
          <Button className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            创建 Skill
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">全部 Skill</p>
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
                  <p className="text-lg font-semibold text-foreground">{stats.published}</p>
                  <p className="text-xs text-muted-foreground">已发布</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">待审核</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Download className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{stats.totalInstalls}</p>
                  <p className="text-xs text-muted-foreground">总安装量</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Type Filter */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索 Skill..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border h-9"
            />
          </div>
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
            {['all', 'MCP', 'API', 'DB', 'Workflow', 'Prompt'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedType === type
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {type === 'all' ? '全部' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="market" className="flex-1 flex flex-col">
          <TabsList className="bg-muted/50 h-9 w-fit mb-4">
            <TabsTrigger value="market" className="text-xs px-4">Skill 市场</TabsTrigger>
            <TabsTrigger value="my" className="text-xs px-4">我的 Skill</TabsTrigger>
            <TabsTrigger value="forced" className="text-xs px-4">强制安装</TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="flex-1 overflow-y-auto mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {publishedSkills.map((skill) => {
                const TypeIcon = typeConfig[skill.type].icon;
                return (
                  <Card
                    key={skill.id}
                    className={`bg-card border-border cursor-pointer transition-all hover:shadow-md ${
                      selectedSkill?.id === skill.id ? 'ring-2 ring-primary shadow-md' : 'shadow-sm'
                    }`}
                    onClick={() => setSelectedSkill(skill)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg ${typeConfig[skill.type].bg} flex items-center justify-center shrink-0`}>
                          <TypeIcon className={`h-5 w-5 ${typeConfig[skill.type].color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm text-foreground truncate">{skill.name}</h3>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{skill.type}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{skill.description}</p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {skill.installs}
                            </span>
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {(skill.calls / 1000).toFixed(1)}k
                            </span>
                            <span>v{skill.version}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${riskConfig[skill.riskLevel].className}`}>
                          {riskConfig[skill.riskLevel].label}风险
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="my" className="flex-1 overflow-y-auto mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mySkills.map((skill) => {
                const TypeIcon = typeConfig[skill.type].icon;
                const StatusIcon = statusConfig[skill.status].icon;
                return (
                  <Card
                    key={skill.id}
                    className={`bg-card border-border cursor-pointer transition-all hover:shadow-md ${
                      selectedSkill?.id === skill.id ? 'ring-2 ring-primary shadow-md' : 'shadow-sm'
                    }`}
                    onClick={() => setSelectedSkill(skill)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg ${typeConfig[skill.type].bg} flex items-center justify-center shrink-0`}>
                          <TypeIcon className={`h-5 w-5 ${typeConfig[skill.type].color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm text-foreground truncate">{skill.name}</h3>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{skill.type}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{skill.description}</p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {skill.installs}
                            </span>
                            <span>v{skill.version}</span>
                          </div>
                        </div>
                        <Badge className={`text-[10px] shrink-0 gap-1 ${statusConfig[skill.status].className}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig[skill.status].label}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="forced" className="flex-1 overflow-y-auto mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mockSkills.filter(s => s.name === '敏感信息检测').map((skill) => {
                const TypeIcon = typeConfig[skill.type].icon;
                return (
                  <Card
                    key={skill.id}
                    className="bg-card border-border cursor-pointer transition-all hover:shadow-md shadow-sm"
                    onClick={() => setSelectedSkill(skill)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg ${typeConfig[skill.type].bg} flex items-center justify-center shrink-0`}>
                          <TypeIcon className={`h-5 w-5 ${typeConfig[skill.type].color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm text-foreground truncate">{skill.name}</h3>
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary">强制安装</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{skill.description}</p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              安全类 Skill
                            </span>
                            <span>v{skill.version}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Skill Detail Panel */}
      {selectedSkill && (
        <div className="w-[380px] flex flex-col gap-4 overflow-y-auto">
          {/* Basic Info */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {(() => {
                  const TypeIcon = typeConfig[selectedSkill.type].icon;
                  return (
                    <div className={`w-11 h-11 rounded-xl ${typeConfig[selectedSkill.type].bg} flex items-center justify-center`}>
                      <TypeIcon className={`h-5 w-5 ${typeConfig[selectedSkill.type].color}`} />
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base text-foreground">{selectedSkill.name}</CardTitle>
                  <CardDescription className="text-xs">{selectedSkill.publisher}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedSkill.description}</p>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-xs">{selectedSkill.type}</Badge>
                <Badge variant="outline" className={`text-xs ${riskConfig[selectedSkill.riskLevel].className}`}>
                  {riskConfig[selectedSkill.riskLevel].label}风险
                </Badge>
                <Badge variant="outline" className="text-xs">v{selectedSkill.version}</Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                  <p className="text-base font-semibold text-foreground">{selectedSkill.installs}</p>
                  <p className="text-[11px] text-muted-foreground">安装量</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                  <p className="text-base font-semibold text-foreground">{(selectedSkill.calls / 1000).toFixed(1)}k</p>
                  <p className="text-[11px] text-muted-foreground">调用量</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                  <p className="text-base font-semibold text-foreground">4.8</p>
                  <p className="text-[11px] text-muted-foreground">评分</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Input/Output Schema */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">接口规范</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">输入参数</p>
                <div className="p-2.5 rounded-lg bg-muted/50 font-mono text-[11px] text-muted-foreground">
                  {`{
  "query": "string",
  "limit": "number?"
}`}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">输出格式</p>
                <div className="p-2.5 rounded-lg bg-muted/50 font-mono text-[11px] text-muted-foreground">
                  {`{
  "result": "object[]",
  "total": "number"
}`}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Version History */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">版本历史</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-primary/5">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-foreground font-medium">v{selectedSkill.version}</span>
                  </div>
                  <span className="text-xs text-primary">当前版本</span>
                </div>
                <div className="flex items-center justify-between text-sm p-2">
                  <span className="text-muted-foreground">v{(parseFloat(selectedSkill.version) - 0.1).toFixed(1)}.0</span>
                  <span className="text-xs text-muted-foreground">2024-02-15</span>
                </div>
                <div className="flex items-center justify-between text-sm p-2">
                  <span className="text-muted-foreground">v{(parseFloat(selectedSkill.version) - 0.2).toFixed(1)}.0</span>
                  <span className="text-xs text-muted-foreground">2024-01-20</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button className="flex-1 shadow-sm">
              <Download className="h-4 w-4 mr-2" />
              安装 Skill
            </Button>
            <Button variant="outline" className="gap-1">
              文档
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
