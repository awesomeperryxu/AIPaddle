'use client';

import { Plus, Trash2, GripVertical } from 'lucide-react';
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
import { VariableSelector } from './variable-selector';
import {
  ComparisonOperator,
  LogicalOperator,
  type Condition,
  type ConditionGroup,
  type ValueSelector,
  type WorkflowNode,
} from '../../types';

interface ConditionEditorProps {
  conditions: ConditionGroup[];
  onChange: (conditions: ConditionGroup[]) => void;
  availableNodes: WorkflowNode[];
  currentNodeId: string;
  disabled?: boolean;
  className?: string;
}

interface SingleConditionProps {
  condition: Condition;
  onChange: (condition: Condition) => void;
  onDelete: () => void;
  availableNodes: WorkflowNode[];
  currentNodeId: string;
  disabled?: boolean;
  isFirst?: boolean;
}

// Operator display names
const operatorLabels: Record<ComparisonOperator, string> = {
  [ComparisonOperator.Contains]: '包含',
  [ComparisonOperator.NotContains]: '不包含',
  [ComparisonOperator.StartsWith]: '开头是',
  [ComparisonOperator.EndsWith]: '结尾是',
  [ComparisonOperator.Is]: '等于',
  [ComparisonOperator.IsNot]: '不等于',
  [ComparisonOperator.Empty]: '为空',
  [ComparisonOperator.NotEmpty]: '不为空',
  [ComparisonOperator.Equals]: '=',
  [ComparisonOperator.NotEquals]: '!=',
  [ComparisonOperator.GreaterThan]: '>',
  [ComparisonOperator.GreaterThanOrEqual]: '>=',
  [ComparisonOperator.LessThan]: '<',
  [ComparisonOperator.LessThanOrEqual]: '<=',
  [ComparisonOperator.In]: '在列表中',
  [ComparisonOperator.NotIn]: '不在列表中',
  [ComparisonOperator.AllOf]: '包含全部',
  [ComparisonOperator.Exists]: '存在',
  [ComparisonOperator.NotExists]: '不存在',
};

// Operators that don't require a value
const noValueOperators = [
  ComparisonOperator.Empty,
  ComparisonOperator.NotEmpty,
  ComparisonOperator.Exists,
  ComparisonOperator.NotExists,
];

// Generate unique ID
function generateId(): string {
  return `cond-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function SingleCondition({
  condition,
  onChange,
  onDelete,
  availableNodes,
  currentNodeId,
  disabled,
  isFirst,
}: SingleConditionProps) {
  const requiresValue = !noValueOperators.includes(condition.operator);

  return (
    <div className="flex items-start gap-2 group">
      <div className="pt-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      
      <div className="flex-1 grid grid-cols-12 gap-2">
        {/* Variable Selector - spans 4 columns */}
        <div className="col-span-4">
          <VariableSelector
            value={condition.variable}
            onChange={(variable) => onChange({ ...condition, variable })}
            availableNodes={availableNodes}
            currentNodeId={currentNodeId}
            placeholder="选择变量"
            disabled={disabled}
          />
        </div>

        {/* Operator Selector - spans 3 columns */}
        <div className="col-span-3">
          <Select
            value={condition.operator}
            onValueChange={(operator: ComparisonOperator) => 
              onChange({ ...condition, operator })
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ComparisonOperator.Contains}>
                {operatorLabels[ComparisonOperator.Contains]}
              </SelectItem>
              <SelectItem value={ComparisonOperator.NotContains}>
                {operatorLabels[ComparisonOperator.NotContains]}
              </SelectItem>
              <SelectItem value={ComparisonOperator.Is}>
                {operatorLabels[ComparisonOperator.Is]}
              </SelectItem>
              <SelectItem value={ComparisonOperator.IsNot}>
                {operatorLabels[ComparisonOperator.IsNot]}
              </SelectItem>
              <SelectItem value={ComparisonOperator.Empty}>
                {operatorLabels[ComparisonOperator.Empty]}
              </SelectItem>
              <SelectItem value={ComparisonOperator.NotEmpty}>
                {operatorLabels[ComparisonOperator.NotEmpty]}
              </SelectItem>
              <SelectItem value={ComparisonOperator.StartsWith}>
                {operatorLabels[ComparisonOperator.StartsWith]}
              </SelectItem>
              <SelectItem value={ComparisonOperator.EndsWith}>
                {operatorLabels[ComparisonOperator.EndsWith]}
              </SelectItem>
              <SelectItem value={ComparisonOperator.GreaterThan}>
                {operatorLabels[ComparisonOperator.GreaterThan]}
              </SelectItem>
              <SelectItem value={ComparisonOperator.GreaterThanOrEqual}>
                {operatorLabels[ComparisonOperator.GreaterThanOrEqual]}
              </SelectItem>
              <SelectItem value={ComparisonOperator.LessThan}>
                {operatorLabels[ComparisonOperator.LessThan]}
              </SelectItem>
              <SelectItem value={ComparisonOperator.LessThanOrEqual}>
                {operatorLabels[ComparisonOperator.LessThanOrEqual]}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Value Input - spans 4 columns */}
        <div className="col-span-4">
          {requiresValue && (
            <Input
              value={typeof condition.value === 'string' ? condition.value : ''}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              placeholder="输入值..."
              disabled={disabled}
            />
          )}
        </div>

        {/* Delete Button - spans 1 column */}
        <div className="col-span-1 flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={disabled || isFirst}
            className="h-9 w-9"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ConditionEditor({
  conditions,
  onChange,
  availableNodes,
  currentNodeId,
  disabled = false,
  className,
}: ConditionEditorProps) {
  // Add a new condition group
  const addConditionGroup = () => {
    const newGroup: ConditionGroup = {
      id: generateId(),
      logicalOperator: LogicalOperator.And,
      conditions: [
        {
          id: generateId(),
          variable: [],
          operator: ComparisonOperator.Is,
          value: '',
        },
      ],
    };
    onChange([...conditions, newGroup]);
  };

  // Add a condition to a group
  const addConditionToGroup = (groupIndex: number) => {
    const newConditions = [...conditions];
    newConditions[groupIndex].conditions.push({
      id: generateId(),
      variable: [],
      operator: ComparisonOperator.Is,
      value: '',
    });
    onChange(newConditions);
  };

  // Update a condition
  const updateCondition = (
    groupIndex: number,
    conditionIndex: number,
    condition: Condition
  ) => {
    const newConditions = [...conditions];
    newConditions[groupIndex].conditions[conditionIndex] = condition;
    onChange(newConditions);
  };

  // Delete a condition
  const deleteCondition = (groupIndex: number, conditionIndex: number) => {
    const newConditions = [...conditions];
    const group = newConditions[groupIndex];
    
    if (group.conditions.length === 1) {
      // If this is the last condition in the group, remove the group
      if (conditions.length > 1) {
        newConditions.splice(groupIndex, 1);
      }
    } else {
      group.conditions.splice(conditionIndex, 1);
    }
    
    onChange(newConditions);
  };

  // Toggle logical operator for a group
  const toggleGroupOperator = (groupIndex: number) => {
    const newConditions = [...conditions];
    newConditions[groupIndex].logicalOperator =
      newConditions[groupIndex].logicalOperator === LogicalOperator.And
        ? LogicalOperator.Or
        : LogicalOperator.And;
    onChange(newConditions);
  };

  // Delete a group
  const deleteGroup = (groupIndex: number) => {
    if (conditions.length > 1) {
      const newConditions = [...conditions];
      newConditions.splice(groupIndex, 1);
      onChange(newConditions);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {conditions.map((group, groupIndex) => (
        <div
          key={group.id}
          className="border rounded-lg p-3 space-y-3 bg-muted/30"
        >
          {/* Group Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                条件组 {groupIndex + 1}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleGroupOperator(groupIndex)}
                disabled={disabled || group.conditions.length < 2}
                className="h-6 px-2 text-xs"
              >
                {group.logicalOperator === LogicalOperator.And ? 'AND' : 'OR'}
              </Button>
            </div>
            {conditions.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteGroup(groupIndex)}
                disabled={disabled}
                className="h-6 w-6"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Conditions in Group */}
          <div className="space-y-2">
            {group.conditions.map((condition, conditionIndex) => (
              <div key={condition.id}>
                {conditionIndex > 0 && (
                  <div className="flex items-center gap-2 py-1 ml-6">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground uppercase">
                      {group.logicalOperator}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <SingleCondition
                  condition={condition}
                  onChange={(c) => updateCondition(groupIndex, conditionIndex, c)}
                  onDelete={() => deleteCondition(groupIndex, conditionIndex)}
                  availableNodes={availableNodes}
                  currentNodeId={currentNodeId}
                  disabled={disabled}
                  isFirst={conditionIndex === 0 && group.conditions.length === 1}
                />
              </div>
            ))}
          </div>

          {/* Add Condition Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addConditionToGroup(groupIndex)}
            disabled={disabled}
            className="w-full border-dashed border"
          >
            <Plus className="h-4 w-4 mr-1" />
            添加条件
          </Button>
        </div>
      ))}

      {/* Add Condition Group Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={addConditionGroup}
        disabled={disabled}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-1" />
        添加条件组 (OR)
      </Button>
    </div>
  );
}
