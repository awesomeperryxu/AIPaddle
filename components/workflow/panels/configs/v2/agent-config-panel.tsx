'use client';

import { useState } from 'react';
import {
  Bot,
  Plus,
  Trash2,
  Check,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ConfigPanelWrapper, RetryConfig, ErrorHandleConfig } from '../../config-panel-wrapper';
import type { WorkflowNode } from '../../../types';

// Accent color for Agent node
const ACCENT_COLOR = '#6366F1';

// Available tools
const AVAILABLE_TOOLS = [
  { id: 'web_search', name: 'Web Search', description: '搜索互联网获取实时信息' },
  { id: 'calculator', name: 'Calculator', description: '执行数学计算' },
  { id: 'code_interpreter', name: 'Code Interpreter', description: '执行 Python 代码' },
  { id: 'file_reader', name: 'File Reader', description: '读取和解析文件内容' },
  { id: 'api_call', name: 'API Call', description: '调用外部 API 接口' },
  { id: 'database', name: 'Database', description: '查询数据库' },
];

// Local interface
interface AgentConfigData {
  strategy?: 'function_calling' | 'react';
  model?: string;
  tools?: string[];
  max_steps?: number;
  memory_enabled?: boolean;
  memory_window?: number;
  retry?: { enabled: boolean; max_retries: number; retry_interval: number };
  error_handling?: 'fail' | 'default' | 'continue';
  output_fields?: Array<{ id: string; name: string; type: string }>;
}

interface OutputField {
  id: string;
  name: string;
  type: string;
}

interface AgentConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<AgentConfigData>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
  appType?: 'workflow' | 'chatflow';
}

export function AgentConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
  appType = 'workflow',
}: AgentConfigPanelV2Props) {
  const config = (node.data as unknown as AgentConfigData) || {};

  // Local state
  const [strategy, setStrategy] = useState<'function_calling' | 'react'>(config.strategy || 'function_calling');
  const [model, setModel] = useState(config.model || 'gpt-4o');
  const [selectedTools, setSelectedTools] = useState<string[]>(config.tools || []);
  const [maxSteps, setMaxSteps] = useState(config.max_steps || 10);
  const [memoryEnabled, setMemoryEnabled] = useState(config.memory_enabled ?? false);
  const [memoryWindow, setMemoryWindow] = useState(config.memory_window || 10);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [retryConfig, setRetryConfig] = useState(config.retry || { enabled: false, max_retries: 3, retry_interval: 1000 });
  const [errorHandling, setErrorHandling] = useState(config.error_handling || 'fail');
  const [outputFields, setOutputFields] = useState<OutputField[]>(
    config.output_fields?.map((f, i) => ({ id: `f_${i}`, name: f.name, type: f.type })) || []
  );

  const handleSave = () => {
    onUpdate({
      strategy,
      model,
      tools: selectedTools,
      max_steps: maxSteps,
      memory_enabled: memoryEnabled,
      memory_window: memoryWindow,
      retry: retryConfig,
      error_handling: errorHandling,
      output_fields: outputFields.map(f => ({ id: f.id, name: f.name, type: f.type })),
    });
    onSave?.();
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev =>
      prev.includes(toolId)
        ? prev.filter(t => t !== toolId)
        : [...prev, toolId]
    );
  };

  const addOutputField = () => {
    setOutputFields([...outputFields, { id: `f_${Date.now()}`, name: '', type: 'string' }]);
  };

  const updateOutputField = (id: string, updates: Partial<OutputField>) => {
    setOutputFields(outputFields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeOutputField = (id: string) => {
    setOutputFields(outputFields.filter(f => f.id !== id));
  };

  const ParamsTabContent = (
    <div className="space-y-6">
      {/* Agent Strategy */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Agent 策略</Label>
        <div className="flex rounded-lg border bg-muted p-1">
          <button
            type="button"
            onClick={() => setStrategy('function_calling')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              strategy === 'function_calling'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Function Calling
          </button>
          <button
            type="button"
            onClick={() => setStrategy('react')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              strategy === 'react'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            ReAct
          </button>
        </div>
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
            <SelectItem value="claude-sonnet-4.6">Claude Sonnet 4.6</SelectItem>
            <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tools */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">工具</Label>
        <div className="space-y-2">
          {AVAILABLE_TOOLS.map((tool) => (
            <div
              key={tool.id}
              onClick={() => toggleTool(tool.id)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                selectedTools.includes(tool.id)
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20'
                  : 'hover:bg-muted'
              )}
            >
              <Checkbox
                checked={selectedTools.includes(tool.id)}
                onCheckedChange={() => toggleTool(tool.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{tool.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Max Steps */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">最大执行步数</Label>
          <span className="text-sm font-mono text-muted-foreground">{maxSteps}</span>
        </div>
        <Slider
          value={[maxSteps]}
          onValueChange={([v]) => setMaxSteps(v)}
          min={1}
          max={20}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1</span>
          <span>20</span>
        </div>
      </div>

      {/* Memory (Chatflow only) */}
      {appType === 'chatflow' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">记忆</Label>
            <Switch checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
          </div>
          {memoryEnabled && (
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              <Label className="text-xs text-muted-foreground">历史消息数量</Label>
              <Input
                type="number"
                value={memoryWindow}
                onChange={(e) => setMemoryWindow(parseInt(e.target.value) || 10)}
                min={1}
                max={100}
                className="h-8"
              />
            </div>
          )}
        </div>
      )}

      {/* Advanced Settings */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
            <span className="text-sm font-medium">高级设置</span>
            <span className="text-xs text-muted-foreground">{advancedOpen ? '收起' : '展开'}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          <RetryConfig
            retryCount={retryConfig.max_retries}
            retryInterval={retryConfig.retry_interval}
            onRetryCountChange={(v) => setRetryConfig({ ...retryConfig, max_retries: v })}
            onRetryIntervalChange={(v) => setRetryConfig({ ...retryConfig, retry_interval: v })}
          />
          <ErrorHandleConfig
            mode={errorHandling === 'fail' ? 'fail-branch' : errorHandling === 'default' ? 'default-value' : 'none'}
            onModeChange={(mode) => {
              if (mode === 'fail-branch') setErrorHandling('fail');
              else if (mode === 'default-value') setErrorHandling('default');
              else setErrorHandling('continue');
            }}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  const OutputTabContent = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">定义 Agent 执行后的输出字段</p>
      
      {outputFields.map((field) => (
        <div key={field.id} className="flex items-center gap-2">
          <Input
            value={field.name}
            onChange={(e) => updateOutputField(field.id, { name: e.target.value })}
            placeholder="字段名"
            className="flex-1 h-9"
          />
          <Select
            value={field.type}
            onValueChange={(type) => updateOutputField(field.id, { type })}
          >
            <SelectTrigger className="w-28 h-9">
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
            onClick={() => removeOutputField(field.id)}
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={addOutputField}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        添加输出字段
      </Button>
    </div>
  );

  const tabs = [
    { id: 'params', label: '参数配置', content: ParamsTabContent },
    { id: 'output', label: '输出变量', content: OutputTabContent },
  ];

  return (
    <ConfigPanelWrapper
      title="Agent"
      typeBadge="Agent"
      icon={<Bot className="h-4 w-4" />}
      accentColor={ACCENT_COLOR}
      tabs={tabs}
      defaultTab="params"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      onReset={onReset}
    />
  );
}
