'use client';

import { useState } from 'react';
import {
  X,
  History,
  MoreHorizontal,
  RotateCcw,
  Download,
  Copy,
  Trash2,
  Check,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Types
interface Version {
  id: string;
  number: number;
  description: string;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string;
    avatar?: string;
  };
  isResolved?: boolean;
}

interface VersionHistoryPanelProps {
  versions?: Version[];
  isLoading?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onRestore?: (versionId: string) => void;
  onExport?: (versionId: string) => void;
  onCopyId?: (versionId: string) => void;
  onDelete?: (versionId: string) => void;
  onUpdateDescription?: (versionId: string, description: string) => void;
  currentUserId?: string;
}

// Helper to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}

export function VersionHistoryPanel({
  versions = [],
  isLoading = false,
  isOpen,
  onClose,
  onRestore,
  onExport,
  onCopyId,
  onDelete,
  onUpdateDescription,
  currentUserId,
}: VersionHistoryPanelProps) {
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [showResolved, setShowResolved] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter versions
  const filteredVersions = versions.filter((v) => {
    if (filter === 'mine' && v.createdBy.id !== currentUserId) return false;
    if (!showResolved && v.isResolved) return false;
    return true;
  });

  const handleStartEdit = (version: Version) => {
    setEditingId(version.id);
    setEditValue(version.description);
  };

  const handleSaveEdit = (versionId: string) => {
    onUpdateDescription?.(versionId, editValue);
    setEditingId(null);
  };

  const handleCopyId = (versionId: string) => {
    onCopyId?.(versionId);
    setCopiedId(versionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRestoreClick = (version: Version) => {
    setSelectedVersion(version);
    setRestoreDialogOpen(true);
  };

  const handleDeleteClick = (version: Version) => {
    setSelectedVersion(version);
    setDeleteDialogOpen(true);
  };

  const confirmRestore = () => {
    if (selectedVersion) {
      onRestore?.(selectedVersion.id);
    }
    setRestoreDialogOpen(false);
    setSelectedVersion(null);
  };

  const confirmDelete = () => {
    if (selectedVersion) {
      onDelete?.(selectedVersion.id);
    }
    setDeleteDialogOpen(false);
    setSelectedVersion(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-semibold">版本历史</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 p-3 border-b">
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                filter === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted'
              )}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('mine')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors border-l',
                filter === 'mine'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted'
              )}
            >
              仅我的
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResolved(!showResolved)}
            className="ml-auto text-xs h-8"
          >
            <Filter className="h-3 w-3 mr-1" />
            {showResolved ? '隐藏已解决' : '显示已解决'}
          </Button>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            // Loading skeleton
            <div className="p-3 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : filteredVersions.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <History className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">暂无版本记录</p>
            </div>
          ) : (
            // Version items
            filteredVersions.map((version) => (
              <div
                key={version.id}
                className="p-3 border-b hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Version badge + description */}
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs shrink-0">
                        v{version.number}
                      </Badge>
                      {editingId === version.id ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(version.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(version.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="h-6 text-xs"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="text-sm truncate cursor-pointer hover:text-primary"
                          onClick={() => handleStartEdit(version)}
                        >
                          {version.description || '无描述'}
                        </span>
                      )}
                    </div>

                    {/* Creator info */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={version.createdBy.avatar} />
                        <AvatarFallback className="text-[8px]">
                          {version.createdBy.name.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{version.createdBy.name}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(version.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleRestoreClick(version)}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        恢复此版本
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onExport?.(version.id)}>
                        <Download className="h-4 w-4 mr-2" />
                        导出 DSL
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopyId(version.id)}>
                        {copiedId === version.id ? (
                          <Check className="h-4 w-4 mr-2 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 mr-2" />
                        )}
                        复制版本 ID
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(version)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认恢复到此版本？</AlertDialogTitle>
            <AlertDialogDescription>
              当前未保存的更改将丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>确认恢复</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除此版本？</AlertDialogTitle>
            <AlertDialogDescription>此操作不可撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Demo component with mock data
export function VersionHistoryPanelDemo() {
  const [isOpen, setIsOpen] = useState(true);

  const mockVersions: Version[] = [
    {
      id: 'v12',
      number: 12,
      description: '添加了 Agent 节点支持',
      createdAt: new Date(Date.now() - 2 * 3600000),
      createdBy: { id: 'user1', name: '张三', avatar: '' },
    },
    {
      id: 'v11',
      number: 11,
      description: '修复了循环节点的 bug',
      createdAt: new Date(Date.now() - 5 * 3600000),
      createdBy: { id: 'user2', name: '李四', avatar: '' },
      isResolved: true,
    },
    {
      id: 'v10',
      number: 10,
      description: '优化了 LLM 节点性能',
      createdAt: new Date(Date.now() - 24 * 3600000),
      createdBy: { id: 'user1', name: '张三', avatar: '' },
    },
    {
      id: 'v9',
      number: 9,
      description: '添加了知识库检索功能',
      createdAt: new Date(Date.now() - 3 * 24 * 3600000),
      createdBy: { id: 'user3', name: '王五', avatar: '' },
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <Button onClick={() => setIsOpen(true)}>打开版本历史</Button>
      <VersionHistoryPanel
        versions={mockVersions}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentUserId="user1"
        onRestore={(id) => console.log('Restore:', id)}
        onExport={(id) => console.log('Export:', id)}
        onCopyId={(id) => navigator.clipboard.writeText(id)}
        onDelete={(id) => console.log('Delete:', id)}
        onUpdateDescription={(id, desc) => console.log('Update:', id, desc)}
      />
    </div>
  );
}
