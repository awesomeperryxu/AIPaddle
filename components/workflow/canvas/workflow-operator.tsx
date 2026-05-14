'use client';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  MousePointer2,
  Hand,
  Undo2,
  Redo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkflowOperatorProps {
  zoom: number;
  interactionMode: 'select' | 'pan';
  canUndo?: boolean;
  canRedo?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onInteractionModeChange?: (mode: 'select' | 'pan') => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function WorkflowOperator({
  zoom,
  interactionMode,
  canUndo = false,
  canRedo = false,
  onZoomIn,
  onZoomOut,
  onFitView,
  onInteractionModeChange,
  onUndo,
  onRedo,
}: WorkflowOperatorProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 bg-white rounded-xl border border-gray-200 shadow-lg">
        {/* Interaction Mode */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8',
                interactionMode === 'select' && 'bg-muted'
              )}
              onClick={() => onInteractionModeChange?.('select')}
            >
              <MousePointer2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">选择模式 (V)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8',
                interactionMode === 'pan' && 'bg-muted'
              )}
              onClick={() => onInteractionModeChange?.('pan')}
            >
              <Hand className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">拖拽模式 (H)</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Zoom Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">缩小 (Ctrl+-)</p>
          </TooltipContent>
        </Tooltip>

        <span className="text-xs font-medium text-muted-foreground w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onZoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">放大 (Ctrl++)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onFitView}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">适应画布 (Ctrl+1)</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Undo/Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!canUndo}
              onClick={onUndo}
            >
              <Undo2 className={cn('h-4 w-4', !canUndo && 'text-gray-300')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">撤销 (Ctrl+Z)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!canRedo}
              onClick={onRedo}
            >
              <Redo2 className={cn('h-4 w-4', !canRedo && 'text-gray-300')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">重做 (Ctrl+Shift+Z)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
