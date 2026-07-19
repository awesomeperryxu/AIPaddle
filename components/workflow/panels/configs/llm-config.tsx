'use client';

import { useState } from 'react';
import { Plus, Trash2, Eye, ChevronDown, ChevronRight, Variable, Braces } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModelSelector } from '../common/model-selector';
import { VariableSelector } from '../common/variable-selector';
import type { WorkflowNode, LLMNodeConfig, PromptTemplate, ModelConfig, ValueSelector } from '../../types';

interface LLMNodeConfigPanelProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<LLMNodeConfig>) => void;
  appType?: 'workflow' | 'chatflow';
}

function generateId(): string {
  return `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const defaultModel: ModelConfig = {
  provider: 'openai',
  name: 'gpt-4o',
  completion_params: {
    temperature: 0.7,
    max_tokens: 4096,
  },
};

interface PromptEditorProps {
  prompt: PromptTemplate;
  onChange: (prompt: PromptTemplate) => void;
  onDelete?: () => void;
  availableNodes: WorkflowNode[];
  currentNodeId: string;
  canDelete?: boolean;
}

function PromptEditor({
  prompt,
  onChange,
  onDelete,
  availableNodes,
  currentNodeId,
  canDelete = true,
}: PromptEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const roleLabels: Record<string, string> = {
    system: 'SYSTEM',
    user: 'USER',
    assistant: 'ASSISTANT',
  };

  const roleColors: Record<string, string> = {
    system: 'bg-purple-100 text-purple-700 border-purple-200',
    user: 'bg-blue-100 text-blue-700 border-blue-200',
    assistant: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-muted/50 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Badge variant="outline" className={cn('text-xs', roleColors[prompt.role])}>
          {roleLabels[prompt.role]}
        </Badge>
        <div className="flex-1 text-sm text-muted-foreground truncate">
          {prompt.text.slice(0, 50) || '空提示词'}
          {prompt.text.length > 50 && '...'}
        </div>
        {canDelete && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-6 w-6"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Role Selector */}
          <div className="flex items-center gap-2">
            <Label className="text-xs w-12">角色</Label>
            <Select
              value={prompt.role}
              onValueChange={(role: 'system' | 'user' | 'assistant') =>
                onChange({ ...prompt, role })
              }
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="assistant">Assistant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prompt Text */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">提示词内容</Label>
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                <Variable className="h-3 w-3 mr-1" />
                插入变量
              </Button>
            </div>
            <Textarea
              value={prompt.text}
              onChange={(e) => onChange({ ...prompt, text: e.target.value })}
              placeholder={
                prompt.role === 'system'
                  ? '你是一个有帮助的助手...'
                  : prompt.role === 'user'
                  ? '{{query}}'
                  : '回复示例...'
              }
              className="min-h-[120px] text-xs font-mono resize-none"
            />
            <p className="text-xs text-muted-foreground">
              使用 {'{{变量名}}'} 插入上游节点的变量
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function LLMNodeConfigPanel({
  node,
  allNodes,
  onUpdate,
  appType = 'workflow',
}: LLMNodeConfigPanelProps) {
  const config = node.data as LLMNodeConfig;
  const model = config.model || defaultModel;
  const prompts = config.prompts || [];
  
  const [showContext, setShowContext] = useState(config.context?.enabled || false);
  const [showMemory, setShowMemory] = useState(config.memory !== undefined);
  const [showVision, setShowVision] = useState(config.vision?.enabled || false);
  const [showStructuredOutput, setShowStructuredOutput] = useState(config.result_format?.type === 'json_schema');

  const updateModel = (newModel: ModelConfig) => {
    onUpdate({ model: newModel });
  };

  const updatePrompt = (index: number, prompt: PromptTemplate) => {
    const newPrompts = [...prompts];
    newPrompts[index] = prompt;
    onUpdate({ prompts: newPrompts });
  };

  const addPrompt = (role: 'system' | 'user' | 'assistant' = 'user') => {
    const newPrompt: PromptTemplate = {
      id: generateId(),
      role,
      text: '',
    };
    onUpdate({ prompts: [...prompts, newPrompt] });
  };

  const deletePrompt = (index: number) => {
    const newPrompts = [...prompts];
    newPrompts.splice(index, 1);
    onUpdate({ prompts: newPrompts });
  };

  const toggleContext = (enabled: boolean) => {
    setShowContext(enabled);
    onUpdate({
      context: enabled
        ? { enabled: true, variable_selector: [] }
        : { enabled: false },
    });
  };

  const updateContextVariable = (variable_selector: ValueSelector) => {
    onUpdate({
      context: { ...config.context, enabled: true, variable_selector },
    });
  };

  const toggleVision = (enabled: boolean) => {
    setShowVision(enabled);
    onUpdate({
      vision: enabled
        ? { enabled: true, configs: { variable_selector: [], detail: 'auto' } }
        : { enabled: false },
    });
  };

  const toggleStructuredOutput = (enabled: boolean) => {
    setShowStructuredOutput(enabled);
    onUpdate({
      result_format: enabled
        ? { type: 'json_schema', json_schema: {} }
        : { type: 'text' },
    });
  };

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">模型选择</Label>
        <ModelSelector
          value={model}
          onChange={updateModel}
          showParameters={true}
        />
      </div>

      <Separator />

      {/* Prompts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">提示词</Label>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => addPrompt('system')}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              System
            </Button>
            <Button variant="outline" size="sm" onClick={() => addPrompt('user')}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              User
            </Button>
          </div>
        </div>

        {prompts.length === 0 ? (
          <div className="text-center py-6 border rounded-lg border-dashed">
            <p className="text-sm text-muted-foreground">添加提示词</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => addPrompt('system')}>
                System
              </Button>
              <Button variant="outline" size="sm" onClick={() => addPrompt('user')}>
                User
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {prompts.map((prompt, index) => (
              <PromptEditor
                key={prompt.id || index}
                prompt={prompt}
                onChange={(p) => updatePrompt(index, p)}
                onDelete={() => deletePrompt(index)}
                availableNodes={allNodes}
                currentNodeId={node.id}
                canDelete={prompts.length > 1}
              />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Context (Knowledge) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">上下文</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              引入知识检索结果作为上下文
            </p>
          </div>
          <Switch checked={showContext} onCheckedChange={toggleContext} />
        </div>

        {showContext && (
          <VariableSelector
            value={config.context?.variable_selector || []}
            onChange={updateContextVariable}
            availableNodes={allNodes}
            currentNodeId={node.id}
            placeholder="选择上下文变量"
          />
        )}
      </div>

      {/* Memory (Chatflow only) */}
      {appType === 'chatflow' && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">对话记忆</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  启用多轮对话记忆
                </p>
              </div>
              <Switch checked={showMemory} onCheckedChange={setShowMemory} />
            </div>

            {showMemory && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">记忆窗口</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={config.memory?.window?.size || 10}
                    onChange={(e) =>
                      onUpdate({
                        memory: {
                          ...config.memory,
                          window: { enabled: true, size: parseInt(e.target.value) },
                        },
                      })
                    }
                    className="w-20 h-8 text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  保留最近 N 轮对话历史
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Vision */}
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">视觉能力</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              启用图像理解功能
            </p>
          </div>
          <Switch checked={showVision} onCheckedChange={toggleVision} />
        </div>

        {showVision && (
          <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <VariableSelector
              value={config.vision?.configs?.variable_selector || []}
              onChange={(variable_selector) =>
                onUpdate({
                  vision: {
                    enabled: true,
                    configs: { ...config.vision?.configs, variable_selector },
                  },
                })
              }
              availableNodes={allNodes}
              currentNodeId={node.id}
              placeholder="选择图像变量"
              filterTypes={['file', 'files'] as any}
            />
            <Select
              value={config.vision?.configs?.detail || 'auto'}
              onValueChange={(value: string) =>
                onUpdate({
                  vision: {
                    enabled: true,
                    configs: { 
                      variable_selector: config.vision?.configs?.variable_selector || [],
                      detail: value as 'low' | 'high' | 'auto',
                    },
                  },
                })
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="图像精度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">自动</SelectItem>
                <SelectItem value="low">低精度</SelectItem>
                <SelectItem value="high">高精度</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Structured Output */}
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">结构化输出</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              使用 JSON Schema 约束输出格式
            </p>
          </div>
          <Switch
            checked={showStructuredOutput}
            onCheckedChange={toggleStructuredOutput}
          />
        </div>

        {showStructuredOutput && (
          <div className="space-y-2">
            <Textarea
              value={
                config.result_format?.json_schema
                  ? JSON.stringify(config.result_format.json_schema, null, 2)
                  : ''
              }
              onChange={(e) => {
                try {
                  const schema = JSON.parse(e.target.value);
                  onUpdate({
                    result_format: { type: 'json_schema', json_schema: schema },
                  });
                } catch {
                  // Invalid JSON, don't update
                }
              }}
              placeholder={`{
  "type": "object",
  "properties": {
    "result": { "type": "string" }
  }
}`}
              className="min-h-[120px] text-sm font-mono resize-none"
            />
            <p className="text-xs text-muted-foreground">
              输入有效的 JSON Schema 来约束输出格式
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
