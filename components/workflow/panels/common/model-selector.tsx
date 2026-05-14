'use client';

import { useState, useMemo } from 'react';
import { Check, ChevronDown, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ModelConfig, ModelProvider } from '../../types';

interface ModelSelectorProps {
  value: ModelConfig;
  onChange: (value: ModelConfig) => void;
  disabled?: boolean;
  showParameters?: boolean;
  className?: string;
}

interface ModelOption {
  provider: ModelProvider;
  providerName: string;
  models: {
    name: string;
    displayName: string;
    contextWindow?: number;
    maxOutput?: number;
  }[];
  icon?: string;
}

// Available model providers and models
const modelOptions: ModelOption[] = [
  {
    provider: 'openai',
    providerName: 'OpenAI',
    models: [
      { name: 'gpt-5', displayName: 'GPT-5', contextWindow: 256000, maxOutput: 32768 },
      { name: 'gpt-5-mini', displayName: 'GPT-5 Mini', contextWindow: 128000, maxOutput: 16384 },
      { name: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000, maxOutput: 16384 },
      { name: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextWindow: 128000, maxOutput: 16384 },
      { name: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', contextWindow: 128000, maxOutput: 4096 },
      { name: 'o3', displayName: 'O3', contextWindow: 128000, maxOutput: 32768 },
      { name: 'o3-mini', displayName: 'O3 Mini', contextWindow: 128000, maxOutput: 32768 },
    ],
  },
  {
    provider: 'anthropic',
    providerName: 'Anthropic',
    models: [
      { name: 'claude-opus-4.6', displayName: 'Claude Opus 4.6', contextWindow: 200000, maxOutput: 8192 },
      { name: 'claude-sonnet-4', displayName: 'Claude Sonnet 4', contextWindow: 200000, maxOutput: 8192 },
      { name: 'claude-3-5-sonnet', displayName: 'Claude 3.5 Sonnet', contextWindow: 200000, maxOutput: 8192 },
      { name: 'claude-3-haiku', displayName: 'Claude 3 Haiku', contextWindow: 200000, maxOutput: 4096 },
    ],
  },
  {
    provider: 'google',
    providerName: 'Google',
    models: [
      { name: 'gemini-3-flash', displayName: 'Gemini 3 Flash', contextWindow: 1000000, maxOutput: 8192 },
      { name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', contextWindow: 1000000, maxOutput: 8192 },
      { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', contextWindow: 1000000, maxOutput: 8192 },
    ],
  },
  {
    provider: 'deepseek',
    providerName: 'DeepSeek',
    models: [
      { name: 'deepseek-chat', displayName: 'DeepSeek Chat', contextWindow: 64000, maxOutput: 4096 },
      { name: 'deepseek-coder', displayName: 'DeepSeek Coder', contextWindow: 64000, maxOutput: 4096 },
    ],
  },
  {
    provider: 'qwen',
    providerName: '通义千问',
    models: [
      { name: 'qwen-max', displayName: 'Qwen Max', contextWindow: 32000, maxOutput: 4096 },
      { name: 'qwen-plus', displayName: 'Qwen Plus', contextWindow: 32000, maxOutput: 4096 },
      { name: 'qwen-turbo', displayName: 'Qwen Turbo', contextWindow: 32000, maxOutput: 4096 },
    ],
  },
  {
    provider: 'zhipu',
    providerName: '智谱 AI',
    models: [
      { name: 'glm-4', displayName: 'GLM-4', contextWindow: 128000, maxOutput: 4096 },
      { name: 'glm-4-flash', displayName: 'GLM-4 Flash', contextWindow: 128000, maxOutput: 4096 },
    ],
  },
];

export function ModelSelector({
  value,
  onChange,
  disabled = false,
  showParameters = true,
  className,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);

  const selectedModel = useMemo(() => {
    for (const provider of modelOptions) {
      const model = provider.models.find(m => m.name === value.name);
      if (model) {
        return { provider, model };
      }
    }
    return null;
  }, [value.name]);

  const handleSelectModel = (provider: ModelProvider, modelName: string) => {
    onChange({
      ...value,
      provider,
      name: modelName,
    });
    setOpen(false);
  };

  const handleParamChange = (key: string, val: number) => {
    onChange({
      ...value,
      completion_params: {
        ...value.completion_params,
        [key]: val,
      },
    });
  };

  const params = value.completion_params || {};

  return (
    <div className={cn('space-y-3', className)}>
      {/* Model Selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full h-7 justify-between text-xs"
          >
            {selectedModel ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] px-1 h-4">
                  {selectedModel.provider.providerName}
                </Badge>
                <span>{selectedModel.model.displayName}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">选择模型</span>
            )}
            <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <ScrollArea className="h-80">
            <div className="p-2 space-y-2">
              {modelOptions.map((provider) => (
                <div key={provider.provider}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {provider.providerName}
                  </div>
                  <div className="space-y-0.5">
                    {provider.models.map((model) => {
                      const isSelected = value.name === model.name;
                      return (
                        <button
                          key={model.name}
                          type="button"
                          onClick={() => handleSelectModel(provider.provider, model.name)}
                          className={cn(
                            'w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md transition-colors',
                            isSelected ? 'bg-accent' : 'hover:bg-muted'
                          )}
                        >
                          <span>{model.displayName}</span>
                          <div className="flex items-center gap-2">
                            {model.contextWindow && (
                              <span className="text-xs text-muted-foreground">
                                {(model.contextWindow / 1000).toFixed(0)}K
                              </span>
                            )}
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Model Parameters */}
      {showParameters && (
        <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between px-2">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                <span>模型参数</span>
              </div>
              <ChevronDown className={cn(
                'h-4 w-4 transition-transform',
                paramsOpen && 'rotate-180'
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Temperature</Label>
                <Input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={params.temperature ?? 0.7}
                  onChange={(e) => handleParamChange('temperature', parseFloat(e.target.value))}
                  className="w-16 h-7 text-xs"
                />
              </div>
              <Slider
                value={[params.temperature ?? 0.7]}
                onValueChange={([val]) => handleParamChange('temperature', val)}
                min={0}
                max={2}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                控制输出的随机性。较高值使输出更随机，较低值更确定。
              </p>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Max Tokens</Label>
                <Input
                  type="number"
                  min={1}
                  max={32768}
                  value={params.max_tokens ?? 4096}
                  onChange={(e) => handleParamChange('max_tokens', parseInt(e.target.value))}
                  className="w-20 h-7 text-xs"
                />
              </div>
              <Slider
                value={[params.max_tokens ?? 4096]}
                onValueChange={([val]) => handleParamChange('max_tokens', val)}
                min={1}
                max={32768}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                生成回复的最大 token 数量。
              </p>
            </div>

            {/* Top P */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Top P</Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={params.top_p ?? 1}
                  onChange={(e) => handleParamChange('top_p', parseFloat(e.target.value))}
                  className="w-16 h-7 text-xs"
                />
              </div>
              <Slider
                value={[params.top_p ?? 1]}
                onValueChange={([val]) => handleParamChange('top_p', val)}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                核采样参数。与 temperature 一起控制采样策略。
              </p>
            </div>

            {/* Frequency Penalty */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Frequency Penalty</Label>
                <Input
                  type="number"
                  min={-2}
                  max={2}
                  step={0.1}
                  value={params.frequency_penalty ?? 0}
                  onChange={(e) => handleParamChange('frequency_penalty', parseFloat(e.target.value))}
                  className="w-16 h-7 text-sm"
                />
              </div>
              <Slider
                value={[params.frequency_penalty ?? 0]}
                onValueChange={([val]) => handleParamChange('frequency_penalty', val)}
                min={-2}
                max={2}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Presence Penalty */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Presence Penalty</Label>
                <Input
                  type="number"
                  min={-2}
                  max={2}
                  step={0.1}
                  value={params.presence_penalty ?? 0}
                  onChange={(e) => handleParamChange('presence_penalty', parseFloat(e.target.value))}
                  className="w-16 h-7 text-sm"
                />
              </div>
              <Slider
                value={[params.presence_penalty ?? 0]}
                onValueChange={([val]) => handleParamChange('presence_penalty', val)}
                min={-2}
                max={2}
                step={0.1}
                className="w-full"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
