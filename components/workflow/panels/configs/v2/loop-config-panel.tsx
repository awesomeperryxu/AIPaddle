'use client';

import { useState } from 'react';
import { Repeat, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigPanelWrapper } from '../../config-panel-wrapper';
import type { WorkflowNode } from '../../../types';

// Accent color for Loop node
const ACCENT_COLOR = '#8B5CF6';

// Variable types
const VARIABLE_TYPES = [
  { value: 'string', label: 'string' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'boolean' },
  { value: 'array', label: 'array' },
  { value: 'object', label: 'object' },
] as const;

// Comparison operators
const COMPARISON_OPERATORS = [
  { value: 'eq', label: '等于' },
  { value: 'ne', label: '不等于' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'gte', label: '大于等于' },
  { value: 'lte', label: '小于等于' },
] as const;

interface LoopVariable {
  id: string;
  name: string;
  type: string;
  initialValue: string;
}

interface ExitCondition {
  id: string;
  variable: string;
  operator: string;
  value: string;
}

interface LoopNodeConfig {
  variables: LoopVariable[];
  exit_logic: 'AND' | 'OR';
  exit_conditions: ExitCondition[];
  max_iterations: number;
}

interface LoopConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<LoopNodeConfig>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
}

export function LoopConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
}: LoopConfigPanelV2Props) {
  const config = (node.data || {}) as unknown as LoopNodeConfig;

  // Local state
  const [variables, setVariables] = useState<LoopVariable[]>(
    config.variables || []
  );
  const [exitLogic, setExitLogic] = useState<'AND' | 'OR'>(config.exit_logic || 'AND');
  const [exitConditions, setExitConditions] = useState<ExitCondition[]>(
    config.exit_conditions || []
  );
  const [maxIterations, setMaxIterations] = useState(config.max_iterations || 100);

  // Variable helpers
  const addVariable = () => {
    setVariables([
      ...variables,
      { id: `var_${Date.now()}`, name: '', type: 'string', initialValue: '' },
    ]);
  };

  const updateVariable = (id: string, updates: Partial<LoopVariable>) => {
    setVariables(variables.map(v => (v.id === id ? { ...v, ...updates } : v)));
  };

  const removeVariable = (id: string) => {
    setVariables(variables.filter(v => v.id !== id));
  };

  // Condition helpers
  const addCondition = () => {
    setExitConditions([
      ...exitConditions,
      { id: `cond_${Date.now()}`, variable: '', operator: 'eq', value: '' },
    ]);
  };

  const updateCondition = (id: string, updates: Partial<ExitCondition>) => {
    setExitConditions(exitConditions.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCondition = (id: string) => {
    setExitConditions(exitConditions.filter(c => c.id !== id));
  };

  const handleSave = () => {
    onUpdate({
      variables: variables.map(({ id, ...rest }) => ({ id, ...rest })),
      exit_logic: exitLogic,
      exit_conditions: exitConditions.map(({ id, ...rest }) => ({ id, ...rest })),
      max_iterations: maxIterations,
    });
    onSave?.();
  };

  // Single page content (no tabs)
  const content = (
    <div className="space-y-6 p-4">
      {/* Loop Variables */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">循环变量列表</Label>
        <div className="space-y-2">
          {variables.map(variable => (
            <div key={variable.id} className="flex items-center gap-2">
              <Input
                value={variable.name}
                onChange={e => updateVariable(variable.id, { name: e.target.value })}
                placeholder="变量名"
                className="w-24"
              />
              <Select
                value={variable.type}
                onValueChange={v => updateVariable(variable.id, { type: v })}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={variable.initialValue}
                onChange={e => updateVariable(variable.id, { initialValue: e.target.value })}
                placeholder="初始值"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeVariable(variable.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={addVariable} className="w-full">
          <Plus className="h-4 w-4 mr-1" />
          添加
        </Button>
      </div>

      {/* Exit Conditions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">退出条件</Label>
          <div className="flex rounded-md border p-0.5">
            <button
              onClick={() => setExitLogic('AND')}
              className={cn(
                'px-2 py-0.5 text-xs rounded',
                exitLogic === 'AND' ? 'bg-primary text-primary-foreground' : ''
              )}
            >
              AND
            </button>
            <button
              onClick={() => setExitLogic('OR')}
              className={cn(
                'px-2 py-0.5 text-xs rounded',
                exitLogic === 'OR' ? 'bg-primary text-primary-foreground' : ''
              )}
            >
              OR
            </button>
          </div>
        </div>
        
        <div className="space-y-2">
          {exitConditions.map(condition => (
            <div key={condition.id} className="flex items-center gap-2">
              <Select
                value={condition.variable}
                onValueChange={v => updateCondition(condition.id, { variable: v })}
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="变量" />
                </SelectTrigger>
                <SelectContent>
                  {variables.map(v => (
                    <SelectItem key={v.id} value={v.name || v.id}>
                      {v.name || `变量 ${v.id.slice(-4)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={condition.operator}
                onValueChange={v => updateCondition(condition.id, { operator: v })}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPARISON_OPERATORS.map(op => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={condition.value}
                onChange={e => updateCondition(condition.id, { value: e.target.value })}
                placeholder="值"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeCondition(condition.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        
        <Button variant="ghost" size="sm" onClick={addCondition} className="w-full">
          <Plus className="h-4 w-4 mr-1" />
          添加条件
        </Button>
      </div>

      {/* Max Iterations */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">最大循环次数</Label>
        <Input
          type="number"
          value={maxIterations}
          onChange={e => setMaxIterations(Math.max(1, Math.min(1000, parseInt(e.target.value) || 100)))}
          min={1}
          max={1000}
        />
        <p className="text-xs text-muted-foreground">
          防止无限循环，达到此次数后强制退出（1-1000）
        </p>
      </div>
    </div>
  );

  return (
    <ConfigPanelWrapper
      title="循环"
      typeBadge="Loop"
      icon={<Repeat className="h-4 w-4" />}
      accentColor={ACCENT_COLOR}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      onReset={onReset}
      showFooter={true}
    >
      {content}
    </ConfigPanelWrapper>
  );
}
