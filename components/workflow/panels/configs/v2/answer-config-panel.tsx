'use client';

import { useState, useRef } from 'react';
import {
  MessageSquare,
  Plus,
  Variable,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ConfigPanelWrapper } from '../../config-panel-wrapper';
import type { WorkflowNode } from '../../../types';

// Accent color for Answer node
const ACCENT_COLOR = '#2970FF';

// Available variables for insertion
const AVAILABLE_VARS = [
  { name: 'sys.query', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { name: 'llm1.text', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { name: 'node1.output', color: 'bg-green-100 text-green-700 border-green-200' },
];

// Local interface
interface AnswerConfigData {
  content?: string;
  file_variable?: string;
}

interface AnswerConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<AnswerConfigData>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
}

export function AnswerConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
}: AnswerConfigPanelV2Props) {
  const config = (node.data as unknown as AnswerConfigData) || {};
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Local state
  const [content, setContent] = useState(config.content || '');
  const [fileVariable, setFileVariable] = useState(config.file_variable || '');

  const handleSave = () => {
    onUpdate({
      content,
      file_variable: fileVariable || undefined,
    });
    onSave?.();
  };

  const insertVariable = (varName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = content;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newContent = `${before}{{${varName}}}${after}`;
    
    setContent(newContent);
    
    // Set cursor position after the inserted variable
    setTimeout(() => {
      const newPos = start + varName.length + 4; // 4 = length of {{ and }}
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const Content = (
    <div className="space-y-6">
      {/* Reply Content Editor */}
      <div className="space-y-2">
        <label className="text-sm font-medium">回复内容</label>
        
        {/* Variable Toolbar */}
        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-t-md border border-b-0">
          <span className="text-xs text-muted-foreground">插入变量：</span>
          {AVAILABLE_VARS.map((v) => (
            <Badge
              key={v.name}
              variant="outline"
              className={cn(
                'cursor-pointer font-mono text-xs hover:opacity-80 transition-opacity',
                v.color
              )}
              onClick={() => insertVariable(v.name)}
            >
              {v.name}
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground"
          >
            <Plus className="h-3 w-3 mr-1" />
            更多
          </Button>
        </div>

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="输入回复内容，使用 {{变量名}} 插入变量..."
          className="min-h-[160px] rounded-t-none font-mono text-sm resize-y"
        />
        
        <p className="text-xs text-muted-foreground">
          支持 Markdown 格式，使用 {"{{变量名}}"} 引用变量
        </p>
      </div>

      {/* File Variable (Optional) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">文件变量（可选）</label>
        <div
          className={cn(
            'flex items-center justify-center p-6 rounded-lg border-2 border-dashed transition-colors',
            fileVariable
              ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20'
              : 'border-gray-200 dark:border-gray-800'
          )}
        >
          {fileVariable ? (
            <div className="flex items-center gap-2">
              <Variable className="h-4 w-4 text-blue-600" />
              <span className="font-mono text-sm">{fileVariable}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFileVariable('')}
                className="h-6 text-xs"
              >
                移除
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm">
              选择变量
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <ConfigPanelWrapper
      title="回复"
      typeBadge="Chatflow"
      icon={<MessageSquare className="h-4 w-4" />}
      accentColor={ACCENT_COLOR}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      onReset={onReset}
    >
      {Content}
    </ConfigPanelWrapper>
  );
}
