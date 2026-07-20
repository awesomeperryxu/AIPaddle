'use client';

import { useState, useMemo } from 'react';
import { Sparkles, ChevronDown, ChevronRight, Variable, Plus, Trash2 } from 'lucide-react';
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
import { Slider } from '@/components/ui/slider';
import {
  ConfigPanelWrapper,
  RetryConfig,
  ErrorHandleConfig,
  type ErrorHandleMode,
} from '../../config-panel-wrapper';
import type { WorkflowNode, LLMNodeConfig, ValueSelector } from '../../../types';

// Accent color for LLM node
const ACCENT_COLOR = '#7C3AED';

// Model options
const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI', icon: '🟢' },
  { value: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', provider: 'Anthropic', icon: '🟠' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'Google', icon: '🔵' },
  { value: 'qwen-max', label: 'Qwen-Max', provider: 'Alibaba', icon: '🟣' },
];

interface LLMConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<LLMNodeConfig>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
  appType?: 'workflow' | 'chatflow';
}

interface InputVariable {
  name: string;
  sourceNode: string;
  type: string;
}

interface OutputVariable {
  name: string;
  type: string;
  description: string;
}

// Parse variables from prompt text
function parseVariables(text: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  return matches;
}

// Highlight variables in text
function HighlightedPrompt({ text, onInsertVariable }: { text: string; onInsertVariable?: () => void }) {
  const parts = text.split(/(\{\{\w+\}\})/g);
  
  return (
    <div className="relative">
      <div className="absolute top-2 right-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={onInsertVariable}
        >
          <Variable className="h-3 w-3 mr-1" />
          插入变量
        </Button>
      </div>
      <div className="whitespace-pre-wrap font-mono text-sm p-3 bg-muted/30 rounded-md min-h-[80px]">
        {parts.map((part, i) => {
          if (/^\{\{\w+\}\}$/.test(part)) {
            const varName = part.slice(2, -2);
            return (
              <span
                key={i}
                className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-xs font-mono bg-violet-100 text-violet-700 border border-violet-200"
              >
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    </div>
  );
}

export function LLMConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
  appType = 'workflow',
}: LLMConfigPanelV2Props) {
  const config = (node.data || {}) as LLMNodeConfig;
  
  // Local state
  const [model, setModel] = useState(config.model?.name || 'gpt-4o');
  const [systemPrompt, setSystemPrompt] = useState(
    config.prompts?.find(p => p.role === 'system')?.text || ''
  );
  const [userPrompt, setUserPrompt] = useState(
    config.prompts?.find(p => p.role === 'user')?.text || '{{query}}'
  );
  const [temperature, setTemperature] = useState(config.model?.completion_params?.temperature || 0.7);
  const [maxTokens, setMaxTokens] = useState(config.model?.completion_params?.max_tokens || 4096);
  const [topP, setTopP] = useState(config.model?.completion_params?.top_p || 0.9);
  const [memoryEnabled, setMemoryEnabled] = useState(config.memory?.window?.enabled || false);
  const [memorySize, setMemorySize] = useState(config.memory?.window?.size || 10);
  const [visionEnabled, setVisionEnabled] = useState(config.vision?.enabled || false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(3);
  const [retryInterval, setRetryInterval] = useState(1000);
  const [errorMode, setErrorMode] = useState<ErrorHandleMode>('none');
  const [errorDefaultValue, setErrorDefaultValue] = useState('');

  // Collect input variables from prompts
  const inputVariables = useMemo<InputVariable[]>(() => {
    const vars = new Set<string>();
    parseVariables(systemPrompt).forEach(v => vars.add(v));
    parseVariables(userPrompt).forEach(v => vars.add(v));
    return Array.from(vars).map(name => ({
      name,
      sourceNode: 'Start',
      type: 'string',
    }));
  }, [systemPrompt, userPrompt]);

  // Output variables (fixed for LLM)
  const outputVariables: OutputVariable[] = [
    { name: 'text', type: 'string', description: 'LLM 输出文本' },
    { name: 'usage', type: 'object', description: 'Token 使用量' },
    { name: 'finish_reason', type: 'string', description: '结束原因' },
  ];

  // Get selected model info
  const selectedModel = MODEL_OPTIONS.find(m => m.value === model);

  // Parameter Config Tab Content
  const ParamsTabContent = (
    <div className="space-y-5">
      {/* Model Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">模型选择</Label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {selectedModel && (
                <span className="flex items-center gap-2">
                  <span>{selectedModel.icon}</span>
                  <span>{selectedModel.label}</span>
                  <Badge variant="outline" className="text-[10px] ml-2">
                    {selectedModel.provider}
                  </Badge>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-2">
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                  <Badge variant="outline" className="text-[10px] ml-2">
                    {opt.provider}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">系统提示词</Label>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="你是一个有帮助的AI助手..."
          className="min-h-[120px] font-mono text-sm resize-none"
        />
        <p className="text-xs text-muted-foreground">
          使用 {'{{变量名}}'} 插入变量，变量将显示为彩色标签
        </p>
      </div>

      {/* User Prompt */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">用户提示词</Label>
        <Textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="{{query}}"
          className="min-h-[80px] font-mono text-sm resize-none"
        />
      </div>

      {/* Parameter Settings (Collapsible) */}
      <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-0 hover:bg-transparent"
          >
            <span className="font-medium text-sm">参数设置</span>
            {paramsOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Temperature</Label>
              <Input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-20 h-8 text-sm text-right"
              />
            </div>
            <Slider
              value={[temperature]}
              onValueChange={([v]) => setTemperature(v)}
              min={0}
              max={2}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>精确</span>
              <span>创意</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Max Tokens</Label>
              <Input
                type="number"
                min={100}
                max={8000}
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-24 h-8 text-sm text-right"
              />
            </div>
            <Slider
              value={[maxTokens]}
              onValueChange={([v]) => setMaxTokens(v)}
              min={100}
              max={8000}
              step={100}
              className="w-full"
            />
          </div>

          {/* Top P */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Top P</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
                className="w-20 h-8 text-sm text-right"
              />
            </div>
            <Slider
              value={[topP]}
              onValueChange={([v]) => setTopP(v)}
              min={0}
              max={1}
              step={0.01}
              className="w-full"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Memory (Chatflow only) */}
      {appType === 'chatflow' && (
        <div className="space-y-3 p-3 border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">对话记忆</Label>
              <p className="text-xs text-muted-foreground">启用多轮对话历史</p>
            </div>
            <Switch checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
          </div>
          {memoryEnabled && (
            <div className="flex items-center gap-3">
              <Label className="text-sm whitespace-nowrap">历史消息数量</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={memorySize}
                onChange={(e) => setMemorySize(parseInt(e.target.value))}
                className="w-20 h-8 text-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* Vision */}
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <Label className="text-sm font-medium">视觉能力</Label>
          <p className="text-xs text-muted-foreground">支持图片输入</p>
        </div>
        <Switch checked={visionEnabled} onCheckedChange={setVisionEnabled} />
      </div>

      {/* Advanced Settings (Collapsible) */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-0 hover:bg-transparent"
          >
            <span className="font-medium text-sm">高级设置</span>
            {advancedOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          <div className="p-3 border rounded-lg space-y-4">
            <Label className="text-sm font-medium">重试配置</Label>
            <RetryConfig
              retryCount={retryCount}
              retryInterval={retryInterval}
              onRetryCountChange={setRetryCount}
              onRetryIntervalChange={setRetryInterval}
            />
          </div>
          <div className="p-3 border rounded-lg">
            <ErrorHandleConfig
              mode={errorMode}
              defaultValue={errorDefaultValue}
              onModeChange={setErrorMode}
              onDefaultValueChange={setErrorDefaultValue}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  // Input Variables Tab Content
  const InputVarsTabContent = (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        以下变量从提示词中自动检测
      </p>
      {inputVariables.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          暂无引用变量
        </div>
      ) : (
        <div className="space-y-2">
          {inputVariables.map((v) => (
            <div
              key={v.name}
              className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <Variable className="h-4 w-4 text-violet-500" />
                <span className="font-mono text-sm">{v.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {v.sourceNode}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {v.type}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Output Variables Tab Content
  const OutputVarsTabContent = (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        LLM 节点固定输出以下变量
      </p>
      <div className="space-y-2">
        {outputVariables.map((v) => (
          <div
            key={v.name}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{v.name}</span>
              <Badge variant="outline" className="text-xs">
                {v.type}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">{v.description}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const tabs = [
    { id: 'params', label: '参数配置', content: ParamsTabContent },
    { id: 'inputs', label: '输入变量', content: InputVarsTabContent },
    { id: 'outputs', label: '输出变量', content: OutputVarsTabContent },
  ];

  return (
    <ConfigPanelWrapper
      title="LLM"
      typeBadge="LLM"
      icon={<Sparkles className="h-4 w-4" />}
      accentColor={ACCENT_COLOR}
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
      onReset={onReset}
      tabs={tabs}
      defaultTab="params"
    />
  );
}
