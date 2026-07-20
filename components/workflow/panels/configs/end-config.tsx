'use client';

import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { VariableSelector } from '../common/variable-selector';
import type { WorkflowNode, EndNodeConfig, ValueSelector } from '../../types';

interface EndNodeConfigPanelProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<EndNodeConfig>) => void;
  appType?: 'workflow' | 'chatflow';
}

function generateId(): string {
  return `out-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface OutputItem {
  id?: string;
  key: string;
  value: ValueSelector;
}

export function EndNodeConfigPanel({
  node,
  allNodes,
  onUpdate,
  appType = 'workflow',
}: EndNodeConfigPanelProps) {
  const config = node.data as EndNodeConfig;
  const outputs = (config.outputs || []) as OutputItem[];

  const addOutput = () => {
    const newOutput: OutputItem = {
      id: generateId(),
      key: `output_${outputs.length + 1}`,
      value: [],
    };
    onUpdate({ outputs: [...outputs, newOutput] });
  };

  const updateOutput = (index: number, output: OutputItem) => {
    const newOutputs = [...outputs];
    newOutputs[index] = output;
    onUpdate({ outputs: newOutputs });
  };

  const deleteOutput = (index: number) => {
    const newOutputs = [...outputs];
    newOutputs.splice(index, 1);
    onUpdate({ outputs: newOutputs });
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="text-sm text-muted-foreground">
        定义工作流的最终输出。选择需要返回的变量并设置输出名称。
      </div>

      {/* Output Variables */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">输出变量</Label>
          <Button variant="outline" size="sm" onClick={addOutput}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            添加输出
          </Button>
        </div>

        {outputs.length === 0 ? (
          <div className="text-center py-8 border rounded-lg border-dashed">
            <p className="text-sm text-muted-foreground">暂无输出变量</p>
            <p className="text-xs text-muted-foreground mt-1">
              添加输出变量以定义工作流返回的数据
            </p>
            <Button variant="link" size="sm" onClick={addOutput} className="mt-2">
              添加第一个输出
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {outputs.map((output, index) => (
              <div
                key={output.id || index}
                className="flex items-start gap-2 p-3 border rounded-lg bg-background group"
              >
                <div className="pt-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                
                <div className="flex-1 space-y-3">
                  {/* Output Key */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">输出名称</Label>
                    <Input
                      value={output.key}
                      onChange={(e) => updateOutput(index, { ...output, key: e.target.value })}
                      placeholder="输出变量名"
                      className="h-8 text-sm font-mono"
                    />
                  </div>

                  {/* Value Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">引用变量</Label>
                    <VariableSelector
                      value={output.value}
                      onChange={(value) => updateOutput(index, { ...output, value })}
                      availableNodes={allNodes}
                      currentNodeId={node.id}
                      placeholder="选择要输出的变量"
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteOutput(index)}
                  className="h-8 w-8 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
        <p className="font-medium">提示</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>输出变量将作为工作流的最终返回值</li>
          <li>API 调用时，这些变量将包含在响应中</li>
          <li>可以引用任何上游节点的输出变量</li>
        </ul>
      </div>
    </div>
  );
}
