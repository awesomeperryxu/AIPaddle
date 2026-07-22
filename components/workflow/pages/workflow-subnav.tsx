'use client';

// 工作流编辑器内左侧应用子导航（对齐 Dify 应用下级页：编排/访问API/日志/监测[/标注]）。
import { cn } from '@/lib/utils';
import { Workflow, Code2, ScrollText, Activity, Tags } from 'lucide-react';

export type WorkflowTab = 'orchestrate' | 'api' | 'logs' | 'monitor' | 'annotations';

const TABS: { key: WorkflowTab; label: string; icon: typeof Workflow; chatflowOnly?: boolean }[] = [
  { key: 'orchestrate', label: '编排', icon: Workflow },
  { key: 'api', label: '访问 API', icon: Code2 },
  { key: 'logs', label: '日志', icon: ScrollText },
  { key: 'monitor', label: '监测', icon: Activity },
  { key: 'annotations', label: '标注', icon: Tags, chatflowOnly: true },
];

export function WorkflowSubNav({
  active,
  appType,
  onChange,
}: {
  active: WorkflowTab;
  appType: 'workflow' | 'chatflow';
  onChange: (tab: WorkflowTab) => void;
}) {
  const tabs = TABS.filter((t) => !t.chatflowOnly || appType === 'chatflow');
  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-muted/30 py-3">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            title={t.label}
            className={cn(
              'flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[10px] transition-colors',
              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
