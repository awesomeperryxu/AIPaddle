'use client';

import { useState } from 'react';
import {
  HelpCircle,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ConfigPanelWrapper } from '../../config-panel-wrapper';
import { VariableSelector } from '../../common/variable-selector';
import type { WorkflowNode } from '../../../types';

// Accent color for QuestionClassifier node
const ACCENT_COLOR = '#F59E0B';

// Local interface
interface Category {
  id: string;
  name: string;
  description: string;
}

interface QuestionClassifierConfigData {
  query_variable?: string;
  model?: string;
  categories?: Array<{ name: string; description: string }>;
  custom_instruction?: string;
}

interface QuestionClassifierConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<QuestionClassifierConfigData>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
}

export function QuestionClassifierConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
}: QuestionClassifierConfigPanelV2Props) {
  const config = (node.data as unknown as QuestionClassifierConfigData) || {};

  // Local state
  const [queryVariable, setQueryVariable] = useState(config.query_variable || '');
  const [model, setModel] = useState(config.model || 'gpt-4o');
  const [categories, setCategories] = useState<Category[]>(
    config.categories?.map((c, i) => ({ id: `c_${i}`, name: c.name, description: c.description })) || [
      { id: 'c_0', name: '产品咨询', description: '关于产品功能、价格、使用方法的问题' },
      { id: 'c_1', name: '技术支持', description: '技术问题、Bug 反馈、系统故障' },
      { id: 'c_2', name: '其他', description: '无法归类到上述类别的问题' },
    ]
  );
  const [customInstruction, setCustomInstruction] = useState(config.custom_instruction || '');
  const [instructionOpen, setInstructionOpen] = useState(false);

  const handleSave = () => {
    onUpdate({
      query_variable: queryVariable,
      model,
      categories: categories.map(c => ({ name: c.name, description: c.description })),
      custom_instruction: customInstruction || undefined,
    });
    onSave?.();
  };

  const addCategory = () => {
    setCategories([...categories, { id: `c_${Date.now()}`, name: '', description: '' }]);
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setCategories(categories.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCategory = (id: string) => {
    if (categories.length > 1) {
      setCategories(categories.filter(c => c.id !== id));
    }
  };

  const Content = (
    <div className="space-y-6">
      {/* Query Variable */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">查询变量</Label>
        <VariableSelector
          variables={[
            { key: 'sys.query', type: 'string', label: 'sys.query' },
            { key: 'input.text', type: 'string', label: 'input.text' },
          ]}
          onSelect={(v) => setQueryVariable(v.key || '')}
        />
        {queryVariable && (
          <Badge variant="secondary" className="font-mono text-xs">
            {queryVariable}
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

      {/* Categories */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">分类列表</Label>
        
        {categories.map((category, index) => (
          <div key={category.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <Badge variant="outline" className="text-xs">
                {index + 1}
              </Badge>
              <Input
                value={category.name}
                onChange={(e) => updateCategory(category.id, { name: e.target.value })}
                placeholder="分类名称"
                className="flex-1 h-8"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeCategory(category.id)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                disabled={categories.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={category.description}
              onChange={(e) => updateCategory(category.id, { description: e.target.value })}
              placeholder="分类描述（可选）"
              className="h-8 text-sm"
            />
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addCategory}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          添加分类
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
            placeholder="输入自定义分类指令（可选）..."
            className="min-h-[100px] text-sm"
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  return (
    <ConfigPanelWrapper
      title="问题分类"
      typeBadge="Classifier"
      icon={<HelpCircle className="h-4 w-4" />}
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
