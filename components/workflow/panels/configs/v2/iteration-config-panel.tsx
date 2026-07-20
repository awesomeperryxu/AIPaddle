'use client';

import { useState } from 'react';
import { RefreshCw, AlertCircle, SkipForward, Trash, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ConfigPanelWrapper } from '../../config-panel-wrapper';
import { VariableSelector } from '../../common/variable-selector';
import type { WorkflowNode } from '../../../types';

// Accent color for Iteration node
const ACCENT_COLOR = '#3B82F6';

// Local interface for Iteration config
interface IterationConfigData {
  input_array?: string;
  parallel?: {
    enabled: boolean;
    max_parallelism: number;
  };
  error_handling?: 'terminate' | 'continue' | 'remove';
  flatten_output?: boolean;
}

// Error handling strategies
const ERROR_STRATEGIES = [
  {
    value: 'terminate',
    label: '终止迭代',
    description: '遇到错误立即停止整个迭代',
    icon: AlertCircle,
  },
  {
    value: 'continue',
    label: '继续执行',
    description: '跳过错误项，继续处理其余项',
    icon: SkipForward,
  },
  {
    value: 'remove',
    label: '移除异常输出',
    description: '从输出数组中移除失败项',
    icon: Trash,
  },
] as const;

interface IterationConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<IterationConfigData>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
}

export function IterationConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
}: IterationConfigPanelV2Props) {
  const config = (node.data as unknown as IterationConfigData) || {};

  // Local state
  const [inputArray, setInputArray] = useState(config.input_array || '');
  const [parallelEnabled, setParallelEnabled] = useState(config.parallel?.enabled ?? false);
  const [maxParallel, setMaxParallel] = useState(config.parallel?.max_parallelism ?? 10);
  const [errorStrategy, setErrorStrategy] = useState(config.error_handling || 'terminate');
  const [flattenOutput, setFlattenOutput] = useState(config.flatten_output ?? false);

  const handleSave = () => {
    onUpdate({
      input_array: inputArray,
      parallel: {
        enabled: parallelEnabled,
        max_parallelism: maxParallel,
      },
      error_handling: errorStrategy as 'terminate' | 'continue' | 'remove',
      flatten_output: flattenOutput,
    });
    onSave?.();
  };

  // Single page content (no tabs)
  const content = (
    <div className="space-y-6 p-4">
      {/* Input Array Variable */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">输入数组变量</Label>
        <VariableSelector
          availableNodes={allNodes}
          currentNodeId={node.id}
          value={inputArray ? [inputArray] : undefined}
          onChange={(val) => setInputArray(val?.[0] || '')}
        />
        <p className="text-xs text-muted-foreground">
          迭代器将遍历此数组的每个元素
        </p>
      </div>

      {/* Parallel Execution */}
      <div className="space-y-4 p-4 border rounded-lg">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">并行执行</Label>
            <p className="text-xs text-muted-foreground">同时处理多个迭代项</p>
          </div>
          <Switch checked={parallelEnabled} onCheckedChange={setParallelEnabled} />
        </div>
        
        {parallelEnabled && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs text-muted-foreground">最大并行数</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[maxParallel]}
                onValueChange={([v]) => setMaxParallel(v)}
                min={1}
                max={100}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                value={maxParallel}
                onChange={e => setMaxParallel(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))}
                className="w-20"
                min={1}
                max={100}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error Handling Strategy */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">错误处理策略</Label>
        <div className="space-y-2">
          {ERROR_STRATEGIES.map(strategy => {
            const Icon = strategy.icon;
            const isSelected = errorStrategy === strategy.value;
            return (
              <button
                key={strategy.value}
                onClick={() => setErrorStrategy(strategy.value)}
                className={cn(
                  'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                )}
              >
                <div className={cn(
                  'mt-0.5 flex items-center justify-center w-4 h-4 rounded-full border-2',
                  isSelected ? 'border-primary' : 'border-muted-foreground/50'
                )}>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Icon className={cn(
                      'h-4 w-4',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )} />
                    <span className="text-sm font-medium">{strategy.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{strategy.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Flatten Output */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">展平输出</Label>
            <p className="text-xs text-muted-foreground">将嵌套数组展平为一维数组</p>
          </div>
        </div>
        <Switch checked={flattenOutput} onCheckedChange={setFlattenOutput} />
      </div>
    </div>
  );

  return (
    <ConfigPanelWrapper
      title="迭代"
      typeBadge="Iteration"
      icon={<RefreshCw className="h-4 w-4" />}
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
