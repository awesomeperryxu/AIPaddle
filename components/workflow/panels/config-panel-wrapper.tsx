'use client';

import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ConfigPanelTab {
  id: string;
  label: string;
  content: ReactNode;
}

export interface ConfigPanelWrapperProps {
  /** Panel title */
  title: string;
  /** Type badge text */
  typeBadge: string;
  /** Header icon component */
  icon: ReactNode;
  /** Accent color for header (hex) */
  accentColor: string;
  /** Whether the panel is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Save handler */
  onSave?: () => void;
  /** Reset handler */
  onReset?: () => void;
  /** Tab configuration - if not provided, renders children directly */
  tabs?: ConfigPanelTab[];
  /** Default active tab id */
  defaultTab?: string;
  /** Children (used when no tabs) */
  children?: ReactNode;
  /** Show footer buttons */
  showFooter?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * ConfigPanelWrapper - 380px wide right drawer for node configuration
 * 
 * Features:
 * - Header with node icon, title, type badge, and close button
 * - Optional tab bar with underline activation
 * - Scrollable content area
 * - Footer with reset and save buttons
 */
export function ConfigPanelWrapper({
  title,
  typeBadge,
  icon,
  accentColor,
  isOpen,
  onClose,
  onSave,
  onReset,
  tabs,
  defaultTab,
  children,
  showFooter = true,
  className,
}: ConfigPanelWrapperProps) {
  if (!isOpen) return null;

  // Generate lighter background color from accent
  const headerBgStyle = {
    backgroundColor: `${accentColor}15`,
    borderLeftColor: accentColor,
  };

  // Design spec: 380px width, white background, left border with shadow-xl
  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-full w-[380px] bg-card border-l border-gray-200 shadow-xl z-50 flex flex-col',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-l-4"
        style={headerBgStyle}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        <span className="font-medium text-sm flex-1">{title}</span>
        <Badge
          variant="outline"
          className="text-xs font-mono"
          style={{ borderColor: accentColor, color: accentColor }}
        >
          {typeBadge}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content with optional tabs */}
      {tabs && tabs.length > 0 ? (
        <Tabs defaultValue={defaultTab || tabs[0].id} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-10">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="relative rounded-none border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className="flex-1 mt-0 min-h-0"
            >
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4 text-xs">
                  {tab.content}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4 text-xs">
            {children}
          </div>
        </ScrollArea>
      )}

      {/* Footer - design spec: h-8 flex-1, left reset (outline), right save (primary) */}
      {showFooter && (
        <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/30">
          {onReset && (
            <Button variant="outline" className="h-8 flex-1" onClick={onReset}>
              重置
            </Button>
          )}
          {onSave && (
            <Button className="h-8 flex-1" onClick={onSave}>
              保存
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * RetryConfig - Reusable retry configuration component
 */
export interface RetryConfigProps {
  retryCount: number;
  retryInterval: number;
  onRetryCountChange: (value: number) => void;
  onRetryIntervalChange: (value: number) => void;
}

export function RetryConfig({
  retryCount,
  retryInterval,
  onRetryCountChange,
  onRetryIntervalChange,
}: RetryConfigProps) {
  return (
    <div className="space-y-4">
      {/* Retry Count */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">重试次数</span>
          <span className="text-sm font-mono w-12 text-right">{retryCount}</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={retryCount}
          onChange={(e) => onRetryCountChange(Number(e.target.value))}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1</span>
          <span>10</span>
        </div>
      </div>

      {/* Retry Interval */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">重试间隔</span>
          <span className="text-sm font-mono w-16 text-right">{retryInterval}ms</span>
        </div>
        <input
          type="range"
          min={100}
          max={5000}
          step={100}
          value={retryInterval}
          onChange={(e) => onRetryIntervalChange(Number(e.target.value))}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>100ms</span>
          <span>5000ms</span>
        </div>
      </div>
    </div>
  );
}

/**
 * ErrorHandleConfig - Reusable error handling configuration
 */
export type ErrorHandleMode = 'none' | 'fail-branch' | 'default-value';

export interface ErrorHandleConfigProps {
  mode: ErrorHandleMode;
  defaultValue?: string;
  onModeChange: (mode: ErrorHandleMode) => void;
  onDefaultValueChange?: (value: string) => void;
}

export function ErrorHandleConfig({
  mode,
  defaultValue = '',
  onModeChange,
  onDefaultValueChange,
}: ErrorHandleConfigProps) {
  const options: { value: ErrorHandleMode; label: string; description: string }[] = [
    { value: 'none', label: '无处理', description: '直接抛出错误' },
    { value: 'fail-branch', label: '失败分支', description: '走失败输出端口' },
    { value: 'default-value', label: '默认值', description: '返回预设默认值' },
  ];

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium">错误处理</span>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
              mode === option.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/30'
            )}
          >
            <input
              type="radio"
              name="error-handle"
              value={option.value}
              checked={mode === option.value}
              onChange={() => onModeChange(option.value)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="text-sm font-medium">{option.label}</div>
              <div className="text-xs text-muted-foreground">{option.description}</div>
            </div>
          </label>
        ))}
      </div>

      {mode === 'default-value' && onDefaultValueChange && (
        <div className="space-y-2 pl-6">
          <span className="text-sm text-muted-foreground">默认返回值</span>
          <textarea
            value={defaultValue}
            onChange={(e) => onDefaultValueChange(e.target.value)}
            placeholder='{"result": ""}'
            className="w-full min-h-[60px] p-2 text-sm font-mono rounded-md border bg-muted/50 resize-none"
          />
        </div>
      )}
    </div>
  );
}

/**
 * VariableChip - Colored chip for displaying variables in prompts
 */
export interface VariableChipProps {
  name: string;
  onClick?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function VariableChip({ name, onClick, onDelete, className }: VariableChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono cursor-pointer',
        'bg-violet-100 text-violet-700 border border-violet-200',
        'dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700',
        className
      )}
      onClick={onClick}
    >
      {'{{'}
      {name}
      {'}}'}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1 hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
