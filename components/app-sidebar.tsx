'use client';

import { cn } from '@/lib/utils';
import { signOut } from '@/app/(dashboard)/actions';
import {
  Bot,
  Boxes,
  Plug,
  Database,
  Mail,
  FileText,
  GitBranch,
  Globe,
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
  KeyRound,
  BarChart3,
  LogOut,
  Moon,
  Sun,
  Server,
  LayoutTemplate,
  Cpu,
  Clock,
} from 'lucide-react';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { AGENT_MODELS } from '@/lib/agents/config';
import { apiFetch } from '@/lib/api/client';

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
      { title: '定时作业', icon: <Clock className="h-4 w-4" />, href: 'agent-schedules' },
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
    title: 'Plugin',
    defaultOpen: false,
    items: [
      { title: 'MCP', icon: <Server className="h-4 w-4" />, href: 'plugins/mcp' },
      { title: 'API', icon: <Globe className="h-4 w-4" />, href: 'plugins/api' },
      { title: 'DB', icon: <Database className="h-4 w-4" />, href: 'plugins/db' },
      { title: 'SMTP', icon: <Mail className="h-4 w-4" />, href: 'plugins/smtp' },
    ]
  },
  {
    title: '知识库',
    defaultOpen: false,
    items: [
      { title: '知识库管理', icon: <FileText className="h-4 w-4" />, href: 'knowledge-admin' },
      { title: '知识库问答', icon: <Database className="h-4 w-4" />, href: 'knowledge' },
      { title: '办公文件处理', icon: <FileText className="h-4 w-4" />, href: 'office-tools' },
    ]
  },
  {
    title: '工作流',
    defaultOpen: false,
    items: [
      { title: '工作流管理', icon: <GitBranch className="h-4 w-4" />, href: 'workflows' },
      { title: '模板库',    icon: <LayoutTemplate className="h-4 w-4" />, href: 'templates' },
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
    title: '扩展能力',
    defaultOpen: false,
    items: [
      { title: '扩展管理', icon: <Plug className="h-4 w-4" />, href: 'extensions' },
    ]
  },
  {
    title: '平台管理',
    defaultOpen: false,
    items: [
      { title: '运营看板', icon: <BarChart3 className="h-4 w-4" />, href: 'saas-dashboard' },
      { title: '租户管理', icon: <Building2 className="h-4 w-4" />, href: 'tenants' },
      { title: 'Key 管理', icon: <Key className="h-4 w-4" />, href: 'keys' },
      { title: 'Key 总览（全平台）', icon: <KeyRound className="h-4 w-4" />, href: 'platform-keys' },
    ]
  },
];

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  orgName?: string;
  userName?: string;
  userRole?: string;
  defaultModel?: string;
  canManageTenant?: boolean;
}

export function AppSidebar({ activeView, onViewChange, orgName = '—', userName = '用户', userRole = '成员', defaultModel = 'qwen-plus', canManageTenant = false }: AppSidebarProps) {
  // 默认全部展开（需求：左侧菜单默认全展开）
  const [openSections, setOpenSections] = useState<string[]>(
    navSections.map(s => s.title)
  );
  // 主题：走 next-themes（持久化 + 与 <html> class 同步）。切换入口在关闭的下拉菜单内，
  // 初始 SSR 不渲染 → 无水合不一致，直接用 resolvedTheme。
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  // 租户默认模型：初值来自服务端 prop；管理员切换时乐观更新 + 失败回滚。
  const [model, setModel] = useState(defaultModel);
  const [modelHint, setModelHint] = useState<string | null>(null);
  const currentModelLabel = AGENT_MODELS.find((m) => m.value === model)?.label ?? model;

  const handleSelectModel = (value: string) => {
    if (value === model) return;
    const prev = model;
    setModel(value);
    setModelHint(null);
    apiFetch('/api/tenant/model', { method: 'PATCH', body: JSON.stringify({ model: value }) })
      .then(() => setModelHint('已更新'))
      .catch((e) => {
        setModel(prev);
        setModelHint(e instanceof Error ? e.message : '更新失败');
      });
  };

  const toggleSection = (title: string) => {
    setOpenSections(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
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
            {/* 模型选择（以租户为单位）：Admin 可切换，其他角色只读展示 */}
            {canManageTenant ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Cpu className="h-4 w-4 mr-2" />
                  <span className="flex-1">模型选择</span>
                  <span className="ml-2 text-[11px] text-muted-foreground truncate max-w-[80px]">{currentModelLabel}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuRadioGroup value={model} onValueChange={handleSelectModel}>
                    {AGENT_MODELS.map((m) => (
                      <DropdownMenuRadioItem key={m.value} value={m.value}>
                        {m.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  {modelHint && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="py-1 text-[11px] font-normal text-muted-foreground">
                        {modelHint}
                      </DropdownMenuLabel>
                    </>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : (
              <DropdownMenuLabel className="flex items-center gap-2 font-normal text-xs text-muted-foreground">
                <Cpu className="h-4 w-4 shrink-0" />
                <span className="truncate">默认模型：{currentModelLabel}</span>
              </DropdownMenuLabel>
            )}
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
            <button data-testid="user-menu" className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                  {userName.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
                <p className="text-[11px] text-sidebar-foreground/60 truncate">{userRole}</p>
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
            <DropdownMenuItem onSelect={() => { void signOut(); }}>
              <LogOut className="h-4 w-4 mr-2" />
              切换账号
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onSelect={() => { void signOut(); }}>
              <LogOut className="h-4 w-4 mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
