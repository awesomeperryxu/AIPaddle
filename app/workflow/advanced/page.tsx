'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChecklistModalDemo } from '@/components/workflow/modals/checklist-modal';
import { CommentsPanelDemo } from '@/components/workflow/panels/comments-panel';
import { NoteNodeEditorDemo } from '@/components/workflow/nodes/note-node-editor';

export default function AdvancedComponentsPage() {
  const [activeDemo, setActiveDemo] = useState<'checklist' | 'comments' | 'note'>('checklist');

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold mb-4">高级功能组件</h1>
        <div className="flex gap-2">
          <Button
            variant={activeDemo === 'checklist' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveDemo('checklist')}
          >
            发布前检查弹窗
          </Button>
          <Button
            variant={activeDemo === 'comments' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveDemo('comments')}
          >
            评论面板
          </Button>
          <Button
            variant={activeDemo === 'note' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveDemo('note')}
          >
            便利贴编辑器
          </Button>
        </div>
      </div>

      {/* Demo Content */}
      <div className="flex-1">
        {activeDemo === 'checklist' && <ChecklistModalDemo />}
        {activeDemo === 'comments' && <CommentsPanelDemo />}
        {activeDemo === 'note' && <NoteNodeEditorDemo />}
      </div>
    </div>
  );
}
