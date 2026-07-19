'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Copy,
  Clipboard,
  Trash2,
  EyeOff,
  Eye,
  ScrollText,
} from 'lucide-react';

// Node running status types
export type NodeStatus = 'not-start' | 'waiting' | 'running' | 'succeeded' | 'failed' | 'retry';

export interface NodeCardProps {
  title: string;
  type: string;
  typeLabel?: string;
  accentColor: string;
  icon: React.ReactNode;
  status?: NodeStatus;
  disabled?: boolean;
  selected?: boolean;
  chatflowOnly?: boolean;
  children: React.ReactNode;
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onToggleDisable?: () => void;
  onViewLogs?: () => void;
  className?: string;
}

// Status ring component
function StatusRing({ status }: { status: NodeStatus }) {
  const statusStyles: Record<NodeStatus, string> = {
    'not-start': 'bg-muted-foreground/30',
    'waiting': 'bg-muted-foreground/50',
    'running': 'bg-blue-500 animate-spin',
    'succeeded': 'bg-emerald-500',
    'failed': 'bg-red-500',
    'retry': 'bg-orange-500 animate-spin',
  };

  const ringStyles: Record<NodeStatus, string> = {
    'not-start': '',
    'waiting': 'ring-2 ring-muted-foreground/30',
    'running': 'ring-2 ring-blue-500/30',
    'succeeded': 'ring-2 ring-emerald-500/30',
    'failed': 'ring-2 ring-red-500/30',
    'retry': 'ring-2 ring-orange-500/30',
  };

  return (
    <div
      className={cn(
        'absolute -left-1 -top-1 h-3 w-3 rounded-full',
        statusStyles[status],
        ringStyles[status]
      )}
    />
  );
}

export function NodeCard({
  title,
  type,
  typeLabel,
  accentColor,
  icon,
  status,
  disabled = false,
  selected = false,
  chatflowOnly = false,
  children,
  onCopy,
  onPaste,
  onDelete,
  onToggleDisable,
  onViewLogs,
  className,
}: NodeCardProps) {
  const hasRunLogs = status && ['succeeded', 'failed'].includes(status);

  const cardContent = (
    <div
      className={cn(
        'group relative w-[240px] min-h-[80px] rounded-xl border bg-card shadow-sm transition-all',
        selected && 'ring-2 ring-primary shadow-md',
        disabled && 'opacity-50',
        className
      )}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: accentColor,
      }}
    >
      {/* Status ring */}
      {status && status !== 'not-start' && <StatusRing status={status} />}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-tr-xl border-b"
        style={{
          backgroundColor: `${accentColor}10`,
        }}
      >
        {/* Icon */}
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
          style={{ backgroundColor: accentColor }}
        >
          <span className="text-white [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        </div>

        {/* Title */}
        <span className="flex-1 truncate text-sm font-medium text-foreground">
          {title}
        </span>

        {/* Type badge / Chatflow badge */}
        {chatflowOnly ? (
          <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
            Chatflow
          </span>
        ) : typeLabel ? (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {typeLabel}
          </span>
        ) : null}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 text-xs text-muted-foreground">
        {children}
      </div>

      {/* Disabled overlay */}
      {disabled && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/50">
          <EyeOff className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
    </div>
  );

  // If no context menu handlers, return card without context menu
  if (!onCopy && !onPaste && !onDelete && !onToggleDisable) {
    return cardContent;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{cardContent}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {onCopy && (
          <ContextMenuItem onClick={onCopy}>
            <Copy className="mr-2 h-4 w-4" />
            复制节点
          </ContextMenuItem>
        )}
        {onPaste && (
          <ContextMenuItem onClick={onPaste}>
            <Clipboard className="mr-2 h-4 w-4" />
            粘贴节点
          </ContextMenuItem>
        )}
        {(onCopy || onPaste) && (onDelete || onToggleDisable) && (
          <ContextMenuSeparator />
        )}
        {onToggleDisable && (
          <ContextMenuItem onClick={onToggleDisable}>
            {disabled ? (
              <>
                <Eye className="mr-2 h-4 w-4" />
                启用节点
              </>
            ) : (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                禁用节点
              </>
            )}
          </ContextMenuItem>
        )}
        {onDelete && (
          <ContextMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除节点
          </ContextMenuItem>
        )}
        {hasRunLogs && onViewLogs && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onViewLogs}>
              <ScrollText className="mr-2 h-4 w-4" />
              查看运行日志
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Utility components for node card content
export function NodeBadge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'success' | 'warning' | 'error' | 'method-get' | 'method-post' | 'method-put' | 'method-delete';
  className?: string;
}) {
  const variantStyles: Record<string, string> = {
    default: 'bg-muted text-muted-foreground',
    outline: 'border border-border bg-background text-foreground',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
    'method-get': 'bg-emerald-100 text-emerald-700',
    'method-post': 'bg-blue-100 text-blue-700',
    'method-put': 'bg-amber-100 text-amber-700',
    'method-delete': 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function NodePreview({
  children,
  lines = 1,
  mono = false,
  dark = false,
  className,
}: {
  children: React.ReactNode;
  lines?: 1 | 2;
  mono?: boolean;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'truncate text-xs',
        lines === 2 && 'line-clamp-2 whitespace-normal',
        mono && 'font-mono',
        dark ? 'rounded bg-slate-800 px-2 py-1 text-emerald-400' : 'text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  );
}

export function NodeVariableList({
  variables,
  maxShow = 3,
}: {
  variables: { name: string; type: string }[];
  maxShow?: number;
}) {
  const shown = variables.slice(0, maxShow);
  const remaining = variables.length - maxShow;

  return (
    <div className="flex flex-col gap-1">
      {shown.map((v, i) => (
        <div key={i} className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-foreground">{v.name}</span>
          <NodeBadge>{v.type}</NodeBadge>
        </div>
      ))}
      {remaining > 0 && (
        <div className="text-muted-foreground">+{remaining} 个变量</div>
      )}
    </div>
  );
}
