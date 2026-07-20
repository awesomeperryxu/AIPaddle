'use client';

import { useState } from 'react';
import { X, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Keyboard shortcut item
interface ShortcutItem {
  keys: string[];
  description: string;
}

// Shortcut group
interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

// All shortcut groups
const EDIT_SHORTCUTS: ShortcutItem[] = [
  { keys: ['⌘', 'Z'], description: '撤销' },
  { keys: ['⌘', 'Y'], description: '重做' },
  { keys: ['⌘', 'C'], description: '复制节点' },
  { keys: ['⌘', 'V'], description: '粘贴节点' },
  { keys: ['⌘', 'D'], description: '复制节点（原地）' },
  { keys: ['Del'], description: '删除选中' },
  { keys: ['⌘', 'A'], description: '全选' },
  { keys: ['Esc'], description: '取消选择' },
];

const VIEW_SHORTCUTS: ShortcutItem[] = [
  { keys: ['⌘', '1'], description: '适应画布' },
  { keys: ['Shift', '1'], description: '缩放 100%' },
  { keys: ['Shift', '5'], description: '缩放 50%' },
  { keys: ['⌘', '+'], description: '放大' },
  { keys: ['⌘', '-'], description: '缩小' },
  { keys: ['F'], description: '聚焦节点' },
  { keys: ['Space', '拖拽'], description: '平移画布' },
];

const CONTROL_SHORTCUTS: ShortcutItem[] = [
  { keys: ['V'], description: '指针模式' },
  { keys: ['H'], description: '手型模式' },
  { keys: ['C'], description: '评论模式' },
];

const WORKFLOW_SHORTCUTS: ShortcutItem[] = [
  { keys: ['⌘', 'S'], description: '保存草稿' },
  { keys: ['⌘', 'Enter'], description: '运行工作流' },
  { keys: ['⌘', '⇧', 'P'], description: '发布工作流' },
  { keys: ['⌘', 'O'], description: '自动整理' },
  { keys: ['⌘', '⇧', 'H'], description: '版本历史' },
  { keys: ['⌘', '/'], description: '显示帮助' },
];

// Key chip component
function KeyChip({ keyName }: { keyName: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 border border-border bg-muted rounded text-[10px] font-mono shadow-sm">
      {keyName}
    </kbd>
  );
}

// Shortcut row component
function ShortcutRow({ shortcut }: { shortcut: ShortcutItem }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, index) => (
          <span key={index} className="flex items-center">
            <KeyChip keyName={key} />
            {index < shortcut.keys.length - 1 && (
              <span className="mx-0.5 text-xs text-muted-foreground">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// Shortcut section component
function ShortcutSection({ title, shortcuts }: { title: string; shortcuts: ShortcutItem[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="space-y-0.5">
        {shortcuts.map((shortcut, index) => (
          <ShortcutRow key={index} shortcut={shortcut} />
        ))}
      </div>
    </div>
  );
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[560px] max-h-[80vh] overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-muted-foreground" />
            <DialogTitle>键盘快捷键</DialogTitle>
          </div>
        </DialogHeader>

        {/* Content - 2 column grid */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-2 gap-8">
            {/* Left column */}
            <div className="space-y-6">
              <ShortcutSection title="编辑操作" shortcuts={EDIT_SHORTCUTS} />
              <ShortcutSection title="控制模式" shortcuts={CONTROL_SHORTCUTS} />
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <ShortcutSection title="视图操作" shortcuts={VIEW_SHORTCUTS} />
              <ShortcutSection title="工作流操作" shortcuts={WORKFLOW_SHORTCUTS} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Demo component
export function KeyboardShortcutsModalDemo() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setIsOpen(true)}>
        <Keyboard className="h-4 w-4 mr-2" />
        打开快捷键帮助
      </Button>
      <KeyboardShortcutsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
