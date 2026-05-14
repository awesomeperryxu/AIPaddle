'use client';

import { useState } from 'react';
import {
  MousePointer2,
  Hand,
  MessageSquare,
  Undo2,
  Redo2,
  LayoutGrid,
  Minus,
  Plus,
  Maximize2,
  Variable,
  Keyboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Control modes
export type ControlMode = 'pointer' | 'hand' | 'comment';

export interface WorkflowOperatorProps {
  // Control mode
  mode?: ControlMode;
  onModeChange?: (mode: ControlMode) => void;
  // Edit operations
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onAutoLayout?: () => void;
  // Zoom
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onFitView?: () => void;
  // Panels
  onToggleVariableInspect?: () => void;
  onOpenShortcuts?: () => void;
  variableInspectOpen?: boolean;
}

// Operator button component
function OperatorButton({
  icon: Icon,
  label,
  shortcut,
  active,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'h-8 w-8 flex items-center justify-center rounded-lg transition-colors',
            active
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut && (
          <kbd className="border border-border bg-muted rounded px-1.5 py-0.5 text-[10px] font-mono shadow-sm">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// Separator component
function OperatorSeparator() {
  return <div className="h-5 w-px bg-border" />;
}

export function WorkflowOperator({
  mode = 'pointer',
  onModeChange,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onAutoLayout,
  zoom = 100,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitView,
  onToggleVariableInspect,
  onOpenShortcuts,
  variableInspectOpen = false,
}: WorkflowOperatorProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 px-3 py-2 bg-background border rounded-xl shadow-md">
          {/* Control Mode Buttons */}
          <OperatorButton
            icon={MousePointer2}
            label="指针模式"
            shortcut="V"
            active={mode === 'pointer'}
            onClick={() => onModeChange?.('pointer')}
          />
          <OperatorButton
            icon={Hand}
            label="手型模式"
            shortcut="H"
            active={mode === 'hand'}
            onClick={() => onModeChange?.('hand')}
          />
          <OperatorButton
            icon={MessageSquare}
            label="评论模式"
            shortcut="C"
            active={mode === 'comment'}
            onClick={() => onModeChange?.('comment')}
          />

          <OperatorSeparator />

          {/* Edit Operations */}
          <OperatorButton
            icon={Undo2}
            label="撤销"
            shortcut="⌘Z"
            disabled={!canUndo}
            onClick={onUndo}
          />
          <OperatorButton
            icon={Redo2}
            label="重做"
            shortcut="⌘Y"
            disabled={!canRedo}
            onClick={onRedo}
          />
          <OperatorButton
            icon={LayoutGrid}
            label="自动整理布局"
            shortcut="⌘O"
            onClick={onAutoLayout}
          />

          <OperatorSeparator />

          {/* Zoom Controls */}
          <OperatorButton
            icon={Minus}
            label="缩小"
            onClick={onZoomOut}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onZoomReset}
                className="h-8 min-w-[48px] px-2 flex items-center justify-center rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                {zoom}%
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span>点击重置为 100%</span>
            </TooltipContent>
          </Tooltip>
          <OperatorButton
            icon={Plus}
            label="放大"
            onClick={onZoomIn}
          />
          <OperatorButton
            icon={Maximize2}
            label="适应画布"
            shortcut="⌘1"
            onClick={onFitView}
          />

          <OperatorSeparator />

          {/* Panel Toggles */}
          <OperatorButton
            icon={Variable}
            label="变量检查"
            active={variableInspectOpen}
            onClick={onToggleVariableInspect}
          />
          <OperatorButton
            icon={Keyboard}
            label="快捷键帮助"
            shortcut="⌘/"
            onClick={onOpenShortcuts}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

// Demo component
export function WorkflowOperatorDemo() {
  const [mode, setMode] = useState<ControlMode>('pointer');
  const [zoom, setZoom] = useState(100);
  const [variableInspectOpen, setVariableInspectOpen] = useState(false);

  return (
    <div className="relative h-[200px] bg-muted/30 rounded-lg border">
      <WorkflowOperator
        mode={mode}
        onModeChange={setMode}
        canUndo={true}
        canRedo={false}
        onUndo={() => console.log('Undo')}
        onRedo={() => console.log('Redo')}
        onAutoLayout={() => console.log('Auto layout')}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(200, z + 10))}
        onZoomOut={() => setZoom((z) => Math.max(10, z - 10))}
        onZoomReset={() => setZoom(100)}
        onFitView={() => console.log('Fit view')}
        variableInspectOpen={variableInspectOpen}
        onToggleVariableInspect={() => setVariableInspectOpen(!variableInspectOpen)}
        onOpenShortcuts={() => console.log('Open shortcuts')}
      />
    </div>
  );
}
