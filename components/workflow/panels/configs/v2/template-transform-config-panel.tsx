'use client';

import { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigPanelWrapper } from '../../config-panel-wrapper';
import type { WorkflowNode } from '../../../types';

// Accent color for TemplateTransform node
const ACCENT_COLOR = '#F59E0B';

// Local interface
interface InputVariable {
  id: string;
  name: string;
  variable: string;
}

interface TemplateTransformConfigData {
  input_variables?: Array<{ name: string; variable: string }>;
  template?: string;
}

interface TemplateTransformConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<TemplateTransformConfigData>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
}

// Mock available variables
const AVAILABLE_VARIABLES = [
  'sys.query',
  'llm1.text',
  'code1.result',
  'http1.body',
];

export function TemplateTransformConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
}: TemplateTransformConfigPanelV2Props) {
  const config = (node.data as unknown as TemplateTransformConfigData) || {};

  // Local state
  const [inputVariables, setInputVariables] = useState<InputVariable[]>(
    config.input_variables?.map((v, i) => ({ id: `v_${i}`, name: v.name, variable: v.variable })) || []
  );
  const [template, setTemplate] = useState(config.template || '');

  const handleSave = () => {
    onUpdate({
      input_variables: inputVariables.map(v => ({ name: v.name, variable: v.variable })),
      template,
    });
    onSave?.();
  };

  const addInputVariable = () => {
    setInputVariables([...inputVariables, { id: `v_${Date.now()}`, name: '', variable: '' }]);
  };

  const updateInputVariable = (id: string, updates: Partial<InputVariable>) => {
    setInputVariables(inputVariables.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const removeInputVariable = (id: string) => {
    setInputVariables(inputVariables.filter(v => v.id !== id));
  };

  const Content = (
    <div className="space-y-6">
      {/* Input Variables */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">输入变量</Label>
        
        {inputVariables.map((variable) => (
          <div key={variable.id} className="flex items-center gap-2">
            <Input
              value={variable.name}
              onChange={(e) => updateInputVariable(variable.id, { name: e.target.value })}
              placeholder="变量名"
              className="w-24 h-9 font-mono"
            />
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Select
              value={variable.variable}
              onValueChange={(v) => updateInputVariable(variable.id, { variable: v })}
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
              onClick={() => removeInputVariable(variable.id)}
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addInputVariable}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          添加
        </Button>
      </div>

      {/* Jinja2 Template Editor */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Jinja2 模板</Label>
        <Textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder={`{{ name }} 你好！

{% if items %}
{% for item in items %}
- {{ item }}
{% endfor %}
{% endif %}`}
          className="min-h-[160px] font-mono text-sm resize-y"
        />
        <p className="text-xs text-muted-foreground">
          {"支持 Jinja2 语法：{{var}} 变量、{% if %}...{% endif %} 条件"}
        </p>
      </div>

      {/* Output Variable (Read-only) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">输出变量</Label>
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Badge variant="secondary" className="font-mono">output</Badge>
          <span className="text-xs text-muted-foreground">(string)</span>
        </div>
      </div>
    </div>
  );

  return (
    <ConfigPanelWrapper
      title="模板转换"
      typeBadge="Jinja2"
      icon={<FileText className="h-4 w-4" />}
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
