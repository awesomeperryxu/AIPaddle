'use client';

import { useState } from 'react';
import {
  MessageSquare,
  X,
  Filter,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Types
interface Comment {
  id: string;
  author: {
    name: string;
    avatar?: string;
  };
  content: string;
  timestamp: Date;
  isResolved: boolean;
  replyCount: number;
}

interface CommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  comments: Comment[];
  currentUserId?: string;
  activeCommentId?: string;
  onCommentClick: (commentId: string) => void;
  onToggleResolved: (commentId: string) => void;
  onViewReplies: (commentId: string) => void;
}

// Helper to get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
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

export function CommentsPanel({
  isOpen,
  onClose,
  comments,
  activeCommentId,
  onCommentClick,
  onToggleResolved,
  onViewReplies,
}: CommentsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [showResolved, setShowResolved] = useState(false);

  if (!isOpen) return null;

  const unresolvedCount = comments.filter((c) => !c.isResolved).length;

  const filteredComments = comments.filter((comment) => {
    if (!showResolved && comment.isResolved) return false;
    // For demo, 'mine' filter shows first 2 comments
    if (filter === 'mine') {
      return comments.indexOf(comment) < 2;
    }
    return true;
  });

  return (
    <div className="w-[320px] h-full bg-background border-l shadow-xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3 flex-shrink-0">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <span className="font-medium flex-1">评论</span>
        {unresolvedCount > 0 && (
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {unresolvedCount}
          </Badge>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="px-4 py-2 border-b flex items-center gap-2 flex-shrink-0">
        <div className="flex gap-1">
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter('all')}
          >
            全部
          </Button>
          <Button
            variant={filter === 'mine' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter('mine')}
          >
            我的
          </Button>
        </div>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 text-xs gap-1',
            showResolved && 'bg-green-100 text-green-700 hover:bg-green-100'
          )}
          onClick={() => setShowResolved(!showResolved)}
        >
          <Filter className="h-3 w-3" />
          已解决
        </Button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto divide-y">
        {filteredComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">暂无评论</p>
          </div>
        ) : (
          filteredComments.map((comment) => (
            <div
              key={comment.id}
              className={cn(
                'p-3 cursor-pointer hover:bg-muted/50 transition-colors',
                activeCommentId === comment.id && 'border-l-2 border-l-primary bg-primary/5'
              )}
              onClick={() => onCommentClick(comment.id)}
            >
              {/* Author Row */}
              <div className="flex items-center gap-2 mb-2">
                {comment.author.avatar ? (
                  <img
                    src={comment.author.avatar}
                    alt={comment.author.name}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
                    {getInitials(comment.author.name)}
                  </div>
                )}
                <span className="text-sm font-medium flex-1 truncate">
                  {comment.author.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(comment.timestamp)}
                </span>
              </div>

              {/* Resolved Badge */}
              {comment.isResolved && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] mb-2">
                  已解决
                </Badge>
              )}

              {/* Content */}
              <p className="text-xs text-muted-foreground line-clamp-3">
                {comment.content}
              </p>

              {/* Actions */}
              <div className="flex items-center mt-2">
                {comment.replyCount > 0 && (
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewReplies(comment.id);
                    }}
                  >
                    {comment.replyCount} 条回复
                  </button>
                )}
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-6 px-2 text-[10px] gap-1',
                    comment.isResolved && 'text-green-600'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleResolved(comment.id);
                  }}
                >
                  <Check className="h-3 w-3" />
                  {comment.isResolved ? '取消解决' : '标记解决'}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Demo 数据提到模块级（避免在渲染期调用 Date.now/new Date，满足 react-hooks/purity）
const DEMO_NOW = Date.now();
const DEMO_COMMENTS: Comment[] = [
  {
    id: '1',
    author: { name: '张三' },
    content: '这个 LLM 节点的提示词需要优化一下，当前的回复不够准确，建议增加一些上下文约束。',
    timestamp: new Date(DEMO_NOW - 1000 * 60 * 5), // 5 mins ago
    isResolved: false,
    replyCount: 3,
  },
  {
    id: '2',
    author: { name: '李四' },
    content: '代码节点这里的错误处理需要加强，目前没有捕获异常的逻辑。',
    timestamp: new Date(DEMO_NOW - 1000 * 60 * 60 * 2), // 2 hours ago
    isResolved: false,
    replyCount: 1,
  },
  {
    id: '3',
    author: { name: '王五' },
    content: '已修复 HTTP 请求节点的超时问题，请复查。',
    timestamp: new Date(DEMO_NOW - 1000 * 60 * 60 * 24), // 1 day ago
    isResolved: true,
    replyCount: 0,
  },
  {
    id: '4',
    author: { name: '赵六' },
    content: '建议将这个分支逻辑拆分成两个独立的条件节点，更容易维护。',
    timestamp: new Date(DEMO_NOW - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    isResolved: false,
    replyCount: 5,
  },
];

// Demo component
export function CommentsPanelDemo() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeCommentId, setActiveCommentId] = useState<string | undefined>();
  const [comments, setComments] = useState<Comment[]>(DEMO_COMMENTS);

  const handleToggleResolved = (commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, isResolved: !c.isResolved } : c
      )
    );
  };

  return (
    <div className="h-screen flex">
      <div className="flex-1 bg-muted/30 flex items-center justify-center">
        <Button onClick={() => setIsOpen(true)}>打开评论面板</Button>
      </div>
      <CommentsPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        comments={comments}
        activeCommentId={activeCommentId}
        onCommentClick={setActiveCommentId}
        onToggleResolved={handleToggleResolved}
        onViewReplies={(id) => alert(`查看回复: ${id}`)}
      />
    </div>
  );
}
