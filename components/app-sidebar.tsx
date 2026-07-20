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
  ChevronRight,
  Building2,
  Key,
  CreditCard,
  BarChart3,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface NavItem {
  title: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navSections: NavSection[] = [
  {
    title: '工作台',
    defaultOpen: true,
    items: [
      { title: '监控', icon: <LayoutDashboard className="h-4 w-4" />, href: 'dashboard' },
      { title: '个人助理', icon: <MessageSquare className="h-4 w-4" />, href: 'assistant' },
    ]
  },
  {
    title: 'Agent',
    defaultOpen: true,
    items: [
      { title: 'Agent 管理', icon: <Bot className="h-4 w-4" />, href: 'agents-admin', badge: 6 },
      { title: '数字员工', icon: <Bot className="h-4 w-4" />, href: 'agents' },
    ]
  },
  {
    title: 'Skill',
    defaultOpen: true,
    items: [
      { title: 'Skill Hub', icon: <Boxes className="h-4 w-4" />, href: 'skill-hub', badge: 8 },
      { title: '我的 Skill', icon: <Zap className="h-4 w-4" />, href: 'my-skills' },
    ]
  },
  {
    title: '知识库',
    defaultOpen: false,
    items: [
      { title: '知识库管理', icon: <FileText className="h-4 w-4" />, href: 'knowledge-admin' },
      { title: '知识库问答', icon: <Database className="h-4 w-4" />, href: 'knowledge' },
    ]
  },
  {
    title: '工作流',
    defaultOpen: false,
    items: [
      { title: '工作流管理', icon: <GitBranch className="h-4 w-4" />, href: 'workflows' },
    ]
  },
  {
    title: '安全与管理',
    defaultOpen: false,
    items: [
      { title: '安全管理', icon: <Shield className="h-4 w-4" />, href: 'security', badge: 3 },
      { title: '成员管理', icon: <Users className="h-4 w-4" />, href: 'members' },
    ]
  },
  {
    title: '平台管理',
    defaultOpen: false,
    items: [
      { title: '运营看板', icon: <BarChart3 className="h-4 w-4" />, href: 'saas-dashboard' },
      { title: '租户管理', icon: <Building2 className="h-4 w-4" />, href: 'tenants' },
      { title: 'Key 管理', icon: <Key className="h-4 w-4" />, href: 'keys' },
      { title: '账单管理', icon: <CreditCard className="h-4 w-4" />, href: 'billing' },
    ]
  },
];

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  orgName?: string;
}

export function AppSidebar({ activeView, onViewChange, orgName = '—' }: AppSidebarProps) {
  const [openSections, setOpenSections] = useState<string[]>(
    navSections.filter(s => s.defaultOpen).map(s => s.title)
  );
  const [isDark, setIsDark] = useState(true);

  const toggleSection = (title: string) => {
    setOpenSections(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <aside className="w-60 bg-sidebar flex flex-col h-screen border-r border-sidebar-border">
      {/* Logo */}
      <div className="h-14 px-4 flex items-center border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-sidebar-foreground">AIPaddle</h1>
            <p className="text-[10px] text-sidebar-foreground/60">AI 业务赋能平台</p>
          </div>
        </div>
      </div>

      {/* Tenant Selector */}
      <div className="px-3 py-2.5 border-b border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center justify-between px-2.5 py-2 rounded-md bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors text-left">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-medium text-sidebar-foreground truncate">{orgName}</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/60 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem>
              <Building2 className="h-4 w-4 mr-2" />
              {orgName}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="h-4 w-4 mr-2" />
              租户设置
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navSections.map((section) => {
          const isOpen = openSections.includes(section.title);
          const hasActiveItem = section.items.some(item => item.href === activeView);
          
          return (
            <div key={section.title} className="mb-1">
              <button
                onClick={() => toggleSection(section.title)}
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider rounded transition-colors',
                  hasActiveItem 
                    ? 'text-primary' 
                    : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/70'
                )}
              >
                <span>{section.title}</span>
                <ChevronRight className={cn(
                  'h-3 w-3 transition-transform',
                  isOpen && 'rotate-90'
                )} />
              </button>
              
              {isOpen && (
                <ul className="mt-0.5 space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <button
                        onClick={() => onViewChange(item.href)}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition-all',
                          activeView === item.href
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          {item.icon}
                          <span className="text-[13px]">{item.title}</span>
                        </div>
                        {item.badge && (
                          <span className={cn(
                            'px-1.5 py-0.5 text-[10px] font-medium rounded-full',
                            activeView === item.href
                              ? 'bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground'
                              : 'bg-primary/10 text-primary'
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                  陈
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-sidebar-foreground truncate">陈雪</p>
                <p className="text-[11px] text-sidebar-foreground/60 truncate">企业管理员</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/60 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={toggleTheme}>
              {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {isDark ? '浅色模式' : '深色模式'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewChange('settings')}>
              <Settings className="h-4 w-4 mr-2" />
              系统设置
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
