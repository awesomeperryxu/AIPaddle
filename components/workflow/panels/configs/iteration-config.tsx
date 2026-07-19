'use client';

import { useState } from 'react';
import { ChevronDown, Info, Repeat, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { VariableSelector } from '../common/variable-selector';
import { ErrorHandleMode, VarType } from '../../types';
import type { WorkflowNode, IterationNodeConfig, ValueSelector } from '../../types';

interface IterationNodeConfigPanelProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<IterationNodeConfig>) => void;
  appType?: 'workflow' | 'chatflow';
}

export function IterationNodeConfigPanel({
  node,
  allNodes,
  onUpdate,
  appType = 'workflow',
}: IterationNodeConfigPanelProps) {
  const config = node.data as IterationNodeConfig;
  const iteratorSelector = config.iterator_selector || [];
  const parallelMode = config.parallel_mode || false;
  const maxParallelism = config.max_parallelism || 10;
  const errorHandleMode = config.error_handle_mode || ErrorHandleMode.None;
  
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateIteratorSelector = (selector: ValueSelector) => {
    onUpdate({ iterator_selector: selector });
  };

  const toggleParallelMode = (enabled: boolean) => {
    onUpdate({ parallel_mode: enabled });
  };

  const updateMaxParallelism = (value: number) => {
    onUpdate({ max_parallelism: value });
  };

  const updateErrorHandleMode = (mode: ErrorHandleMode) => {
    onUpdate({ error_handle_mode: mode });
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
        <Repeat className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p>迭代节点用于遍历数组，对每个元素执行相同的操作。</p>
          <p className="mt-1">在迭代内部，可以通过内置变量访问当前元素：</p>
          <ul className="mt-1 space-y-0.5">
            <li><code className="font-mono text-xs bg-muted px-1 rounded">item</code> - 当前迭代元素</li>
            <li><code className="font-mono text-xs bg-muted px-1 rounded">index</code> - 当前索引（从0开始）</li>
          </ul>
        </div>
      </div>

      {/* Input Array */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">输入数组</Label>
        <VariableSelector
          value={iteratorSelector}
          onChange={updateIteratorSelector}
          availableNodes={allNodes}
          currentNodeId={node.id}
          placeholder="选择要迭代的数组变量"
          filterTypes={['array', 'array[string]', 'array[number]', 'array[object]'] as VarType[]}
        />
        <p className="text-xs text-muted-foreground">
          选择一个数组类型的变量作为迭代输入
        </p>
      </div>

      <Separator />

      {/* Parallel Mode */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <div>
              <Label className="text-sm font-medium">并行执行</Label>
              <p className="text-xs text-muted-foreground">同时处理多个元素</p>
            </div>
          </div>
          <Switch checked={parallelMode} onCheckedChange={toggleParallelMode} />
        </div>

        {parallelMode && (
          <div className="p-3 rounded-lg bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">最大并行数</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={maxParallelism}
                onChange={(e) => updateMaxParallelism(parseInt(e.target.value) || 10)}
                className="w-20 h-8 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              同时执行的最大迭代数量。较高的值可加快处理速度，但会增加资源消耗。
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* Advanced Settings */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between px-0">
            <span className="text-sm font-medium">高级设置</span>
            <ChevronDown className={cn(
              'h-4 w-4 transition-transform',
              showAdvanced && 'rotate-180'
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {/* Error Handling */}
          <div className="space-y-2">
            <Label className="text-xs">错误处理</Label>
            <Select value={errorHandleMode} onValueChange={updateErrorHandleMode}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ErrorHandleMode.None}>
                  <div className="flex flex-col">
                    <span>终止执行</span>
                    <span className="text-xs text-muted-foreground">遇到错误时停止整个迭代</span>
                  </div>
                </SelectItem>
                <SelectItem value={ErrorHandleMode.Continue}>
                  <div className="flex flex-col">
                    <span>继续执行</span>
                    <span className="text-xs text-muted-foreground">跳过错误项，继续处理其他元素</span>
                  </div>
                </SelectItem>
                <SelectItem value={ErrorHandleMode.DefaultValue}>
                  <div className="flex flex-col">
                    <span>使用默认值</span>
                    <span className="text-xs text-muted-foreground">错误时返回默认值</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Output Info */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">输出</Label>
        <div className="p-3 rounded-lg bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">output</code>
              <Badge variant="outline" className="text-[10px]">Array</Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            所有迭代结果的数组。每个元素对应一次迭代的输出。
          </p>
        </div>
      </div>

      {/* Usage Tips */}
      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
            <p className="font-medium">使用提示</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>迭代内部可以添加任意数量的节点</li>
              <li>迭代内部节点只能访问当前迭代的变量</li>
              <li>使用迭代内的 End 节点定义每次迭代的输出</li>
              <li>并行模式下，元素处理顺序不保证</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
