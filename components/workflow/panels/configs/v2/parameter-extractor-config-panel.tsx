'use client';

import { useState } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { ConfigPanelWrapper } from '../../config-panel-wrapper';
import { VariableSelector } from '../../common/variable-selector';
import type { WorkflowNode } from '../../../types';

// Accent color for ParameterExtractor node
const ACCENT_COLOR = '#F59E0B';

// Local interface
interface Parameter {
  id: string;
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface ParameterExtractorConfigData {
  input_variable?: string;
  model?: string;
  parameters?: Array<{ name: string; type: string; description: string; required: boolean }>;
  custom_instruction?: string;
}

interface ParameterExtractorConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<ParameterExtractorConfigData>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
}

export function ParameterExtractorConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
}: ParameterExtractorConfigPanelV2Props) {
  const config = (node.data as unknown as ParameterExtractorConfigData) || {};

  // Local state
  const [inputVariable, setInputVariable] = useState(config.input_variable || '');
  const [model, setModel] = useState(config.model || 'gpt-4o');
  const [parameters, setParameters] = useState<Parameter[]>(
    config.parameters?.map((p, i) => ({
      id: `p_${i}`,
      name: p.name,
      type: p.type,
      description: p.description,
      required: p.required,
    })) || []
  );
  const [customInstruction, setCustomInstruction] = useState(config.custom_instruction || '');
  const [instructionOpen, setInstructionOpen] = useState(false);

  const handleSave = () => {
    onUpdate({
      input_variable: inputVariable,
      model,
      parameters: parameters.map(p => ({
        name: p.name,
        type: p.type,
        description: p.description,
        required: p.required,
      })),
      custom_instruction: customInstruction || undefined,
    });
    onSave?.();
  };

  const addParameter = () => {
    setParameters([...parameters, {
      id: `p_${Date.now()}`,
      name: '',
      type: 'string',
      description: '',
      required: false,
    }]);
  };

  const updateParameter = (id: string, updates: Partial<Parameter>) => {
    setParameters(parameters.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeParameter = (id: string) => {
    setParameters(parameters.filter(p => p.id !== id));
  };

  const Content = (
    <div className="space-y-6">
      {/* Input Variable */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">输入文本变量</Label>
        <VariableSelector
          variables={[
            { key: 'sys.query', type: 'string', label: 'sys.query' },
            { key: 'llm1.text', type: 'string', label: 'llm1.text' },
          ]}
          onSelect={(v) => setInputVariable(v.key || '')}
        />
        {inputVariable && (
          <Badge variant="secondary" className="font-mono text-xs">
            {inputVariable}
          </Badge>
        )}
      </div>

      {/* Model */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">模型</Label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger>
            <SelectValue placeholder="选择模型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
            <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
            <SelectItem value="claude-sonnet-4.6">Claude Sonnet 4.6</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Parameters */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">参数列表</Label>
        
        {parameters.map((param) => (
          <div key={param.id} className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={param.name}
                onChange={(e) => updateParameter(param.id, { name: e.target.value })}
                placeholder="参数名"
                className="flex-1 h-8"
              />
              <Select
                value={param.type}
                onValueChange={(type) => updateParameter(param.id, { type })}
              >
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="array">Array</SelectItem>
                  <SelectItem value="object">Object</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeParameter(param.id)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={param.description}
              onChange={(e) => updateParameter(param.id, { description: e.target.value })}
              placeholder="参数描述"
              className="h-8 text-sm"
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">必填</Label>
              <Switch
                checked={param.required}
                onCheckedChange={(required) => updateParameter(param.id, { required })}
              />
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addParameter}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          添加参数
        </Button>
      </div>

      {/* Custom Instruction */}
      <Collapsible open={instructionOpen} onOpenChange={setInstructionOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
            <span className="text-sm font-medium">自定义指令</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${instructionOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Textarea
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            placeholder="输入自定义提取指令（可选）..."
            className="min-h-[100px] text-sm"
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  return (
    <ConfigPanelWrapper
      title="参数提取"
      typeBadge="Extractor"
      icon={<Sliders className="h-4 w-4" />}
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
