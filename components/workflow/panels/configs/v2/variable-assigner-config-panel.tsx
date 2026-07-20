'use client';

import { useState } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Trash2,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigPanelWrapper } from '../../config-panel-wrapper';
import type { WorkflowNode } from '../../../types';

// Accent color for VariableAssigner node
const ACCENT_COLOR = '#64748B';

// Local interface
interface AssignmentRule {
  id: string;
  target: string;
  source: string;
}

interface VariableAssignerConfigData {
  assignments?: Array<{ target: string; source: string }>;
}

interface VariableAssignerConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<VariableAssignerConfigData>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
}

// Mock target variables (conversation/env)
const TARGET_VARIABLES = [
  'conversation.user_name',
  'conversation.session_id',
  'conversation.history',
  'env.api_key',
  'env.base_url',
];

// Mock source variables
const SOURCE_VARIABLES = [
  'sys.query',
  'llm1.text',
  'code1.result',
  'http1.body',
  'extract1.name',
];

export function VariableAssignerConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
}: VariableAssignerConfigPanelV2Props) {
  const config = (node.data as unknown as VariableAssignerConfigData) || {};

  // Local state
  const [assignments, setAssignments] = useState<AssignmentRule[]>(
    config.assignments?.map((a, i) => ({ id: `a_${i}`, target: a.target, source: a.source })) || []
  );

  const handleSave = () => {
    onUpdate({
      assignments: assignments.map(a => ({ target: a.target, source: a.source })),
    });
    onSave?.();
  };

  const addAssignment = () => {
    setAssignments([...assignments, { id: `a_${Date.now()}`, target: '', source: '' }]);
  };

  const updateAssignment = (id: string, updates: Partial<AssignmentRule>) => {
    setAssignments(assignments.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const removeAssignment = (id: string) => {
    setAssignments(assignments.filter(a => a.id !== id));
  };

  const Content = (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          将源变量的值赋给目标变量（对话变量或环境变量）
        </p>
      </div>

      {/* Assignment Rules */}
      <div className="space-y-3">
        {assignments.map((assignment) => (
          <div key={assignment.id} className="flex items-center gap-2">
            <Select
              value={assignment.target}
              onValueChange={(target) => updateAssignment(assignment.id, { target })}
            >
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="目标变量" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_VARIABLES.map((v) => (
                  <SelectItem key={v} value={v} className="font-mono text-sm">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            
            <Select
              value={assignment.source}
              onValueChange={(source) => updateAssignment(assignment.id, { source })}
            >
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="源变量" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_VARIABLES.map((v) => (
                  <SelectItem key={v} value={v} className="font-mono text-sm">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeAssignment(assignment.id)}
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addAssignment}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          添加
        </Button>
      </div>
    </div>
  );

  return (
    <ConfigPanelWrapper
      title="变量赋值"
      typeBadge="Assigner"
      icon={<ArrowLeftRight className="h-4 w-4" />}
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
