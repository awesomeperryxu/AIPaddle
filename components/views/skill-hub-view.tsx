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
  Filter,
  Zap,
  Database,
  Globe,
  GitBranch,
  MessageSquare,
  Shield,
  ChevronRight,
  Star,
  Users,
  TrendingUp
} from 'lucide-react';

const typeConfig = {
  MCP: { icon: Globe, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  API: { icon: Zap, color: 'text-green-500', bg: 'bg-green-500/10' },
  DB: { icon: Database, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  Workflow: { icon: GitBranch, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  Prompt: { icon: MessageSquare, color: 'text-pink-500', bg: 'bg-pink-500/10' }
};

const riskConfig = {
  low: { label: '低风险', className: 'bg-green-500/10 text-green-500' },
  medium: { label: '中风险', className: 'bg-yellow-500/10 text-yellow-500' },
  high: { label: '高风险', className: 'bg-destructive/10 text-destructive' }
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

  return (
    <div className="flex h-full gap-6">
      <div className={`flex-1 space-y-4 ${selectedSkill ? 'max-w-2xl' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Skill Hub</h1>
            <p className="text-muted-foreground">企业 AI 能力市场</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            创建 Skill
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{mockSkills.length}</p>
                  <p className="text-xs text-muted-foreground">总 Skill 数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{mockSkills.filter(s => s.status === 'published').length}</p>
                  <p className="text-xs text-muted-foreground">已发布</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{mockSkills.reduce((acc, s) => acc + s.installs, 0)}</p>
                  <p className="text-xs text-muted-foreground">总安装量</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{mockSkills.filter(s => s.status === 'pending').length}</p>
                  <p className="text-xs text-muted-foreground">待审核</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索 Skill..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'MCP', 'API', 'DB', 'Workflow', 'Prompt'].map((type) => (
              <Button
                key={type}
                variant={selectedType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type)}
              >
                {type === 'all' ? '全部' : type}
              </Button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="market" className="space-y-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="market">Skill 市场</TabsTrigger>
            <TabsTrigger value="my">我的 Skill</TabsTrigger>
            <TabsTrigger value="forced">强制安装</TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {publishedSkills.map((skill) => {
                const TypeIcon = typeConfig[skill.type].icon;
                return (
                  <Card
                    key={skill.id}
                    className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${
                      selectedSkill?.id === skill.id ? 'border-primary ring-1 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedSkill(skill)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg ${typeConfig[skill.type].bg} flex items-center justify-center`}>
                          <TypeIcon className={`h-5 w-5 ${typeConfig[skill.type].color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-foreground truncate">{skill.name}</h3>
                            <Badge variant="outline" className="text-xs">{skill.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">{skill.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {skill.installs}
                            </span>
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {skill.calls.toLocaleString()}
                            </span>
                            <span>v{skill.version}</span>
                          </div>
                        </div>
                        <Badge className={riskConfig[skill.riskLevel].className}>
                          {riskConfig[skill.riskLevel].label}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="my" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mySkills.map((skill) => {
                const TypeIcon = typeConfig[skill.type].icon;
                return (
                  <Card
                    key={skill.id}
                    className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${
                      selectedSkill?.id === skill.id ? 'border-primary ring-1 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedSkill(skill)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg ${typeConfig[skill.type].bg} flex items-center justify-center`}>
                          <TypeIcon className={`h-5 w-5 ${typeConfig[skill.type].color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-foreground truncate">{skill.name}</h3>
                            <Badge variant="outline" className="text-xs">{skill.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">{skill.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {skill.installs}
                            </span>
                            <span>v{skill.version}</span>
                          </div>
                        </div>
                        <Badge className={skill.status === 'published' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}>
                          {skill.status === 'published' ? '已发布' : '待审核'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="forced" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockSkills.filter(s => s.name === '敏感信息检测').map((skill) => {
                const TypeIcon = typeConfig[skill.type].icon;
                return (
                  <Card
                    key={skill.id}
                    className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50`}
                    onClick={() => setSelectedSkill(skill)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg ${typeConfig[skill.type].bg} flex items-center justify-center`}>
                          <TypeIcon className={`h-5 w-5 ${typeConfig[skill.type].color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-foreground truncate">{skill.name}</h3>
                            <Badge className="bg-primary/10 text-primary text-xs">强制安装</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">{skill.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
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
        <div className="w-[400px] space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                {(() => {
                  const TypeIcon = typeConfig[selectedSkill.type].icon;
                  return (
                    <div className={`w-12 h-12 rounded-xl ${typeConfig[selectedSkill.type].bg} flex items-center justify-center`}>
                      <TypeIcon className={`h-6 w-6 ${typeConfig[selectedSkill.type].color}`} />
                    </div>
                  );
                })()}
                <div className="flex-1">
                  <CardTitle className="text-foreground">{selectedSkill.name}</CardTitle>
                  <CardDescription>{selectedSkill.publisher}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">{selectedSkill.description}</p>

              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedSkill.type}</Badge>
                <Badge className={riskConfig[selectedSkill.riskLevel].className}>
                  {riskConfig[selectedSkill.riskLevel].label}
                </Badge>
                <Badge variant="outline">v{selectedSkill.version}</Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold text-foreground">{selectedSkill.installs}</p>
                  <p className="text-xs text-muted-foreground">安装量</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold text-foreground">{(selectedSkill.calls / 1000).toFixed(1)}k</p>
                  <p className="text-xs text-muted-foreground">调用量</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-lg font-semibold text-foreground">4.8</p>
                  <p className="text-xs text-muted-foreground">评分</p>
                </div>
              </div>

              {/* Input/Output Schema */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">输入参数</h4>
                <div className="p-3 rounded-lg bg-muted/30 font-mono text-xs text-muted-foreground">
                  {`{
  "query": "string",
  "limit": "number?"
}`}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">输出格式</h4>
                <div className="p-3 rounded-lg bg-muted/30 font-mono text-xs text-muted-foreground">
                  {`{
  "result": "object[]",
  "total": "number"
}`}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  安装 Skill
                </Button>
                <Button variant="outline">
                  查看文档
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Version History */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm text-foreground">版本历史</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">v{selectedSkill.version}</span>
                  <span className="text-muted-foreground">当前版本</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">v{(parseFloat(selectedSkill.version) - 0.1).toFixed(1)}.0</span>
                  <span className="text-muted-foreground">2024-02-15</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">v{(parseFloat(selectedSkill.version) - 0.2).toFixed(1)}.0</span>
                  <span className="text-muted-foreground">2024-01-20</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
