'use client';

import { useState } from 'react';
import {
  Square,
  Plus,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigPanelWrapper } from '../../config-panel-wrapper';
import type { WorkflowNode } from '../../../types';

// Accent color for End node
const ACCENT_COLOR = '#6B7280';

// Local interface
interface OutputMapping {
  id: string;
  name: string;
  variable: string;
}

interface EndConfigData {
  outputs?: Array<{ name: string; variable: string }>;
}

interface EndConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<EndConfigData>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
}

// Mock available variables
const AVAILABLE_VARIABLES = [
  'llm1.text',
  'code1.result',
  'http1.body',
  'knowledge1.result',
  'sys.query',
];

export function EndConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
}: EndConfigPanelV2Props) {
  const config = (node.data as unknown as EndConfigData) || {};

  // Local state
  const [outputs, setOutputs] = useState<OutputMapping[]>(
    config.outputs?.map((o, i) => ({ id: `o_${i}`, name: o.name, variable: o.variable })) || []
  );

  const handleSave = () => {
    onUpdate({
      outputs: outputs.map(o => ({ name: o.name, variable: o.variable })),
    });
    onSave?.();
  };

  const addOutput = () => {
    setOutputs([...outputs, { id: `o_${Date.now()}`, name: '', variable: '' }]);
  };

  const updateOutput = (id: string, updates: Partial<OutputMapping>) => {
    setOutputs(outputs.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const removeOutput = (id: string) => {
    setOutputs(outputs.filter(o => o.id !== id));
  };

  const Content = (
    <div className="space-y-6">
      {/* Description */}
      <p className="text-sm text-muted-foreground">
        定义工作流的最终输出，可在运行结果中查看
      </p>

      {/* Output Mappings */}
      <div className="space-y-3">
        {outputs.map((output) => (
          <div key={output.id} className="flex items-center gap-2">
            <Input
              value={output.name}
              onChange={(e) => updateOutput(output.id, { name: e.target.value })}
              placeholder="输出名称"
              className="w-28 h-9"
            />
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Select
              value={output.variable}
              onValueChange={(variable) => updateOutput(output.id, { variable })}
            >
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="选择变量引用" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_VARIABLES.map((v) => (
                  <SelectItem key={v} value={v} className="font-mono text-sm">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeOutput(output.id)}
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addOutput}
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
      title="结束"
      typeBadge="End"
      icon={<Square className="h-4 w-4" />}
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
