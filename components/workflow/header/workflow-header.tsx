'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  Undo2,
  Redo2,
  Variable,
  MessageSquare,
  History,
  Download,
  Play,
  Upload,
  AlertTriangle,
  Info,
  ChevronDown,
  PlayCircle,
  StepForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OnlineUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface WorkflowHeaderProps {
  mode?: 'normal' | 'restoring' | 'view-history';
  title?: string;
  hasUnsavedChanges?: boolean;
  onlineUsers?: OnlineUser[];
  appType?: 'workflow' | 'chatflow';
  canUndo?: boolean;
  canRedo?: boolean;
  historyVersion?: string;
  onTitleChange?: (title: string) => void;
  onBack?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onRun?: () => void;
  onRunStep?: () => void;
  onPublish?: () => void;
  onVersionHistory?: () => void;
  onExportDsl?: () => void;
  onEnvVars?: () => void;
  onConversationVars?: () => void;
  onCancelRestore?: () => void;
  onConfirmRestore?: () => void;
  onRestoreVersion?: () => void;
  onExitHistory?: () => void;
}

export function WorkflowHeader({
  mode = 'normal',
  title = '未命名工作流',
  hasUnsavedChanges = false,
  onlineUsers = [],
  appType = 'workflow',
  canUndo = false,
  canRedo = false,
  historyVersion,
  onTitleChange,
  onBack,
  onUndo,
  onRedo,
  onRun,
  onRunStep,
  onPublish,
  onVersionHistory,
  onExportDsl,
  onEnvVars,
  onConversationVars,
  onCancelRestore,
  onConfirmRestore,
  onRestoreVersion,
  onExitHistory,
}: WorkflowHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = () => {
    if (mode === 'normal') {
      setIsEditingTitle(true);
    }
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (editedTitle.trim() && editedTitle !== title) {
      onTitleChange?.(editedTitle.trim());
    } else {
      setEditedTitle(title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    } else if (e.key === 'Escape') {
      setEditedTitle(title);
      setIsEditingTitle(false);
    }
  };

  // Render restoring mode
  if (mode === 'restoring') {
    return (
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">正在恢复版本...</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onCancelRestore}>
            取消恢复
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={onConfirmRestore}>
            确认恢复
          </Button>
        </div>
      </header>
    );
  }

  // Render view-history mode
  if (mode === 'view-history') {
    return (
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-blue-600">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">正在查看历史版本</span>
            {historyVersion && (
              <span className="text-xs text-muted-foreground">{historyVersion}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-8 text-xs" onClick={onRestoreVersion}>
            恢复此版本
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onExitHistory}>
            退出查看
          </Button>
        </div>
      </header>
    );
  }

  // Normal mode
  return (
    <TooltipProvider delayDuration={300}>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onBack}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            {isEditingTitle ? (
              <Input
                ref={inputRef}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                className="h-7 w-48 text-sm font-medium"
              />
            ) : (
              <button
                onClick={handleTitleClick}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                {title}
              </button>
            )}

            {/* Unsaved indicator */}
            {hasUnsavedChanges && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">有未保存的更改</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Center Section - Undo/Redo */}
        <div className="flex items-center gap-1">
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

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Online Users */}
          {onlineUsers.length > 0 && (
            <div className="flex items-center -space-x-2 mr-2">
              {onlineUsers.slice(0, 3).map((user) => (
                <Tooltip key={user.id}>
                  <TooltipTrigger asChild>
                    <Avatar className="h-7 w-7 border-2 border-white">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                        {user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{user.name}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
              {onlineUsers.length > 3 && (
                <div className="h-7 w-7 rounded-full bg-muted border-2 border-white flex items-center justify-center">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    +{onlineUsers.length - 3}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Environment Variables */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEnvVars}
              >
                <Variable className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">环境变量</p>
            </TooltipContent>
          </Tooltip>

          {/* Conversation Variables (Chatflow only) */}
          {appType === 'chatflow' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onConversationVars}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">对话变量</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Version History */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onVersionHistory}
              >
                <History className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">版本历史</p>
            </TooltipContent>
          </Tooltip>

          {/* Export DSL（4.4.12） */}
          {onExportDsl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onExportDsl}>
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">导出 DSL</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Run Button with Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                运行
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onRunStep} className="text-xs">
                <StepForward className="h-4 w-4 mr-2" />
                单步运行
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onRun} className="text-xs">
                <PlayCircle className="h-4 w-4 mr-2" />
                完整运行
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Publish Button */}
          <Button size="sm" className="h-8 text-xs" onClick={onPublish}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            发布
          </Button>
        </div>
      </header>
    </TooltipProvider>
  );
}
