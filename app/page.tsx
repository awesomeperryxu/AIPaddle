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
import { BillingView } from '@/components/views/billing-view';
import { ApiKeysView } from '@/components/views/api-keys-view';
import { SettingsView } from '@/components/views/settings-view';
import { Bell, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

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
        return <ApiKeysView />;
      case 'billing':
        return <BillingView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      dashboard: '监控看板',
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
    return titles[activeView] || '监控看板';
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar activeView={activeView} onViewChange={setActiveView} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border bg-background px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="font-medium text-foreground">{getPageTitle()}</h2>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Global Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索..."
                className="pl-9 h-9 bg-muted/30 border-border"
              />
            </div>
            
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px]">
                3
              </Badge>
            </Button>
            
            {/* Settings */}
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
