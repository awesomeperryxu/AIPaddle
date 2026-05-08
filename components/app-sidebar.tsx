'use client';

import { cn } from '@/lib/utils';
import {
  Bot,
  Boxes,
  Database,
  FileText,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Shield,
  Users,
  Zap,
  ChevronDown,
  Building2,
  Key,
  CreditCard,
  BarChart3,
  Network,
  UserCog,
  ShieldCheck,
  Lock,
  Gauge,
  ScrollText,
} from 'lucide-react';

interface NavItem {
  title: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
  children?: { title: string; href: string }[];
}

const employeeNav: NavItem[] = [
  { title: '个人助理', icon: <MessageSquare className="h-4 w-4" />, href: 'assistant' },
  { title: '数字员工', icon: <Bot className="h-4 w-4" />, href: 'agents' },
  { title: '知识库问答', icon: <Database className="h-4 w-4" />, href: 'knowledge' },
  { title: '我的 Skill', icon: <Zap className="h-4 w-4" />, href: 'my-skills' },
];

const adminNav: NavItem[] = [
  { title: '监控看板', icon: <LayoutDashboard className="h-4 w-4" />, href: 'dashboard' },
  { title: 'Agent 管理', icon: <Bot className="h-4 w-4" />, href: 'agents-admin', badge: 6 },
  { title: 'Skill Hub', icon: <Boxes className="h-4 w-4" />, href: 'skill-hub', badge: 8 },
  { title: '知识库管理', icon: <FileText className="h-4 w-4" />, href: 'knowledge-admin' },
  { title: '工作流管理', icon: <GitBranch className="h-4 w-4" />, href: 'workflows' },
  { title: '安全管理', icon: <Shield className="h-4 w-4" />, href: 'security', badge: 3 },
  { title: '成员管理', icon: <Users className="h-4 w-4" />, href: 'members' },
  { title: '系统设置', icon: <Settings className="h-4 w-4" />, href: 'settings' },
];

const tenantInternalNav: NavItem[] = [
  { title: '组织架构', icon: <Network className="h-4 w-4" />, href: 'org-structure' },
  { title: '人员管理', icon: <UserCog className="h-4 w-4" />, href: 'users-management' },
  { title: '角色权限', icon: <ShieldCheck className="h-4 w-4" />, href: 'roles-permissions' },
  { title: '访问控制', icon: <Lock className="h-4 w-4" />, href: 'access-control' },
  { title: '资源配额', icon: <Gauge className="h-4 w-4" />, href: 'quota-management' },
  { title: '审计日志', icon: <ScrollText className="h-4 w-4" />, href: 'audit-log' },
];

const saasNav: NavItem[] = [
  { title: '运营看板', icon: <BarChart3 className="h-4 w-4" />, href: 'saas-dashboard' },
  { title: '租户管理', icon: <Building2 className="h-4 w-4" />, href: 'tenants' },
  { title: 'Key 管理', icon: <Key className="h-4 w-4" />, href: 'keys' },
  { title: '账单管理', icon: <CreditCard className="h-4 w-4" />, href: 'billing' },
];

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export function AppSidebar({ activeView, onViewChange }: AppSidebarProps) {
  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground">AIPaddle</h1>
            <p className="text-xs text-muted-foreground">AI 业务赋能平台</p>
          </div>
        </div>
      </div>

      {/* Tenant Selector */}
      <div className="p-3 border-b border-sidebar-border">
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-sidebar-foreground">示范科技有限公司</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Employee Section */}
        <div>
          <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">员工端</p>
          <ul className="space-y-1">
            {employeeNav.map((item) => (
              <li key={item.href}>
                <button
                  onClick={() => onViewChange(item.href)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    activeView === item.href
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Admin Section */}
        <div>
          <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">管理端</p>
          <ul className="space-y-1">
            {adminNav.map((item) => (
              <li key={item.href}>
                <button
                  onClick={() => onViewChange(item.href)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    activeView === item.href
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Tenant Internal Management Section */}
        <div>
          <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">租户管理</p>
          <ul className="space-y-1">
            {tenantInternalNav.map((item) => (
              <li key={item.href}>
                <button
                  onClick={() => onViewChange(item.href)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    activeView === item.href
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* SaaS Admin Section */}
        <div>
          <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">平台运营</p>
          <ul className="space-y-1">
            {saasNav.map((item) => (
              <li key={item.href}>
                <button
                  onClick={() => onViewChange(item.href)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    activeView === item.href
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-medium text-primary-foreground">
            陈
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">陈雪</p>
            <p className="text-xs text-muted-foreground truncate">企业管理员</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
