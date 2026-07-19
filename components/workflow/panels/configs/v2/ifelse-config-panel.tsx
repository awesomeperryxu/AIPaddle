'use client';

import { useState } from 'react';
import { GitBranch, GripVertical, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigPanelWrapper } from '../../config-panel-wrapper';
import type { WorkflowNode, IfElseNodeConfig } from '../../../types';

// Accent color for IfElse node
const ACCENT_COLOR = '#3B82F6';

// Operators
const OPERATORS = [
  { value: 'contains', label: '包含' },
  { value: 'not_contains', label: '不包含' },
  { value: 'eq', label: '等于' },
  { value: 'neq', label: '不等于' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'gte', label: '大于等于' },
  { value: 'lte', label: '小于等于' },
  { value: 'is_empty', label: '为空' },
  { value: 'is_not_empty', label: '不为空' },
  { value: 'starts_with', label: '以...开头' },
  { value: 'ends_with', label: '以...结尾' },
];

// Available variables (mock data)
const AVAILABLE_VARS = [
  { value: 'start.query', label: 'Start / query' },
  { value: 'start.user_id', label: 'Start / user_id' },
  { value: 'llm_1.text', label: 'LLM / text' },
  { value: 'code_1.output', label: 'Code / output' },
];

interface Condition {
  id: string;
  variable: string;
  operator: string;
  value: string;
}

interface ConditionGroup {
  id: string;
  type: 'IF' | 'ELIF';
  logicalOperator: 'AND' | 'OR';
  conditions: Condition[];
}

interface IfElseConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<IfElseNodeConfig>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
  appType?: 'workflow' | 'chatflow';
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Condition Row Component
function ConditionRow({
  condition,
  onUpdate,
  onDelete,
  canDelete,
}: {
  condition: Condition;
  onUpdate: (condition: Condition) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const needsValue = !['is_empty', 'is_not_empty'].includes(condition.operator);

  return (
    <div className="flex items-center gap-2">
      {/* Variable Select */}
      <Select
        value={condition.variable}
        onValueChange={(variable) => onUpdate({ ...condition, variable })}
      >
        <SelectTrigger className="w-28 h-8 text-sm">
          <SelectValue placeholder="变量" />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_VARS.map((v) => (
            <SelectItem key={v.value} value={v.value}>
              {v.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator Select */}
      <Select
        value={condition.operator}
        onValueChange={(operator) => onUpdate({ ...condition, operator })}
      >
        <SelectTrigger className="w-20 h-8 text-sm">
          <SelectValue placeholder="运算符" />
        </SelectTrigger>
        <SelectContent>
          {OPERATORS.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value Input */}
      {needsValue && (
        <Input
          value={condition.value}
          onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
          placeholder="值"
          className="flex-1 h-8 text-sm"
        />
      )}

      {/* Delete Button */}
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// Condition Group Component
function ConditionGroupPanel({
  group,
  onUpdate,
  onDelete,
  canDelete,
}: {
  group: ConditionGroup;
  onUpdate: (group: ConditionGroup) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const addCondition = () => {
    onUpdate({
      ...group,
      conditions: [
        ...group.conditions,
        { id: generateId(), variable: '', operator: 'eq', value: '' },
      ],
    });
  };

  const updateCondition = (id: string, condition: Condition) => {
    onUpdate({
      ...group,
      conditions: group.conditions.map((c) => (c.id === id ? condition : c)),
    });
  };

  const deleteCondition = (id: string) => {
    onUpdate({
      ...group,
      conditions: group.conditions.filter((c) => c.id !== id),
    });
  };

  const toggleLogicalOperator = () => {
    onUpdate({
      ...group,
      logicalOperator: group.logicalOperator === 'AND' ? 'OR' : 'AND',
    });
  };

  const badgeColor =
    group.type === 'IF'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : 'bg-amber-100 text-amber-700 border-amber-200';

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Group Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <Badge variant="outline" className={cn('text-xs font-mono', badgeColor)}>
          {group.type}
        </Badge>
        <button
          type="button"
          onClick={toggleLogicalOperator}
          className={cn(
            'px-2 py-0.5 text-xs font-mono rounded border transition-colors',
            group.logicalOperator === 'AND'
              ? 'bg-violet-100 text-violet-700 border-violet-200'
              : 'bg-orange-100 text-orange-700 border-orange-200'
          )}
        >
          {group.logicalOperator}
        </button>
        <div className="flex-1" />
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Conditions */}
      <div className="p-3 space-y-2">
        {group.conditions.map((condition, index) => (
          <ConditionRow
            key={condition.id}
            condition={condition}
            onUpdate={(c) => updateCondition(condition.id, c)}
            onDelete={() => deleteCondition(condition.id)}
            canDelete={group.conditions.length > 1}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={addCondition}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          添加条件
        </Button>
      </div>
    </div>
  );
}

export function IfElseConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
  appType = 'workflow',
}: IfElseConfigPanelV2Props) {
  // Initialize state from config or defaults
  const [groups, setGroups] = useState<ConditionGroup[]>([
    {
      id: generateId(),
      type: 'IF',
      logicalOperator: 'AND',
      conditions: [{ id: generateId(), variable: '', operator: 'eq', value: '' }],
    },
  ]);

  // Add ELIF group
  const addElifGroup = () => {
    setGroups([
      ...groups,
      {
        id: generateId(),
        type: 'ELIF',
        logicalOperator: 'AND',
        conditions: [{ id: generateId(), variable: '', operator: 'eq', value: '' }],
      },
    ]);
  };

  // Update group
  const updateGroup = (id: string, group: ConditionGroup) => {
    setGroups(groups.map((g) => (g.id === id ? group : g)));
  };

  // Delete group
  const deleteGroup = (id: string) => {
    setGroups(groups.filter((g) => g.id !== id));
  };

  // Panel Content (no tabs for IfElse)
  const PanelContent = (
    <div className="space-y-4">
      {/* IF and ELIF Groups */}
      {groups.map((group, index) => (
        <ConditionGroupPanel
          key={group.id}
          group={group}
          onUpdate={(g) => updateGroup(group.id, g)}
          onDelete={() => deleteGroup(group.id)}
          canDelete={group.type === 'ELIF'}
        />
      ))}

      {/* ELSE Block (fixed) */}
      <div className="border-2 border-dashed rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-mono bg-gray-100 text-gray-600 border-gray-200"
          >
            ELSE
          </Badge>
          <span className="text-sm text-muted-foreground">
            其他情况走此分支
          </span>
        </div>
      </div>

      {/* Add ELIF Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={addElifGroup}
      >
        <Plus className="h-4 w-4 mr-2" />
        添加 ELIF 分支
      </Button>
    </div>
  );

  return (
    <ConfigPanelWrapper
      title="条件分支"
      typeBadge="IF/ELSE"
      icon={<GitBranch className="h-4 w-4" />}
      accentColor={ACCENT_COLOR}
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
      onReset={onReset}
      showFooter={true}
    >
      {PanelContent}
    </ConfigPanelWrapper>
  );
}
