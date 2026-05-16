'use client';

import { useState } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { DashboardView } from '@/components/views/dashboard-view';
import { AgentsAdminView } from '@/components/views/agents-admin-view';
import { SkillHubView } from '@/components/views/skill-hub-view';
import { SecurityView } from '@/components/views/security-view';
import { WorkflowView } from '@/components/views/workflow-view';
import { AssistantView } from '@/components/views/assistant-view';
import { AgentsView } from '@/components/views/agents-view';
import { MembersView } from '@/components/views/members-view';
import { KnowledgeAdminView } from '@/components/views/knowledge-admin-view';
import { TenantsView } from '@/components/views/tenants-view';
import { Bell, Search, HelpCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

export default function AIPaddlePlatform() {
  const [activeView, setActiveView] = useState('dashboard');

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'agents-admin':
        return <AgentsAdminView />;
      case 'skill-hub':
        return <SkillHubView />;
      case 'security':
        return <SecurityView />;
      case 'workflows':
        return <WorkflowView />;
      case 'assistant':
        return <AssistantView />;
      case 'agents':
        return <AgentsView />;
      case 'members':
        return <MembersView />;
      case 'knowledge-admin':
        return <KnowledgeAdminView />;
      case 'tenants':
        return <TenantsView />;
      case 'knowledge':
        return <KnowledgeAdminView />;
      case 'my-skills':
        return <SkillHubView />;
      case 'saas-dashboard':
        return <TenantsView />;
      case 'keys':
      case 'billing':
      case 'settings':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-xl bg-muted flex items-center justify-center">
                <Settings className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">功能开发中</h2>
                <p className="text-sm text-muted-foreground mt-1">此模块正在开发中，敬请期待</p>
              </div>
            </div>
          </div>
        );
      default:
        return <DashboardView />;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      dashboard: '监控',
      'agents-admin': 'Agent 管理',
      'skill-hub': 'Skill Hub',
      security: '安全管理',
      workflows: '工作流管理',
      assistant: '个人助理',
      agents: '数字员工',
      members: '成员管理',
      'knowledge-admin': '知识库管理',
      tenants: '租户管理',
      knowledge: '知识库问答',
      'my-skills': '我的 Skill',
      'saas-dashboard': '运营看板',
      keys: 'Key 管理',
      billing: '账单管理',
      settings: '系统设置'
    };
    return titles[activeView] || '监控';
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <AppSidebar activeView={activeView} onViewChange={setActiveView} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-12 border-b border-border bg-card px-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-foreground">{getPageTitle()}</h2>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Global Search */}
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜索..."
                  className="pl-8 h-8 text-sm bg-muted/30 border-border"
                />
              </div>
              
              {/* Help */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">帮助文档</p>
                </TooltipContent>
              </Tooltip>
              
              {/* Notifications */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px]">
                      3
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">通知</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-5 bg-background">
            {renderView()}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
