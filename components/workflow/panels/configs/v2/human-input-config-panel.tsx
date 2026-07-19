'use client';

import { useState } from 'react';
import {
  UserCheck,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ConfigPanelWrapper } from '../../config-panel-wrapper';
import type { WorkflowNode } from '../../../types';

// Accent color for HumanInput node
const ACCENT_COLOR = '#2970FF';

// Local interface
interface InputField {
  id: string;
  label: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required: boolean;
}

interface HumanInputConfigData {
  prompt?: string;
  timeout?: number;
  fields?: Array<{ label: string; name: string; type: string; required: boolean }>;
  notification_method?: 'email' | 'webhook';
  notification_config?: { email?: string; webhook_url?: string };
}

interface HumanInputConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<HumanInputConfigData>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
}

export function HumanInputConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
}: HumanInputConfigPanelV2Props) {
  const config = (node.data as unknown as HumanInputConfigData) || {};

  // Local state
  const [prompt, setPrompt] = useState(config.prompt || '');
  const [timeout, setTimeout] = useState(config.timeout || 0);
  const [fields, setFields] = useState<InputField[]>(
    config.fields?.map((f, i) => ({
      id: `f_${i}`,
      label: f.label,
      name: f.name,
      type: f.type as InputField['type'],
      required: f.required,
    })) || []
  );
  const [notificationMethod, setNotificationMethod] = useState<'email' | 'webhook'>(
    config.notification_method || 'email'
  );
  const [email, setEmail] = useState(config.notification_config?.email || '');
  const [webhookUrl, setWebhookUrl] = useState(config.notification_config?.webhook_url || '');

  const handleSave = () => {
    onUpdate({
      prompt,
      timeout,
      fields: fields.map(f => ({ label: f.label, name: f.name, type: f.type, required: f.required })),
      notification_method: notificationMethod,
      notification_config: {
        email: notificationMethod === 'email' ? email : undefined,
        webhook_url: notificationMethod === 'webhook' ? webhookUrl : undefined,
      },
    });
    onSave?.();
  };

  const addField = () => {
    setFields([...fields, {
      id: `f_${Date.now()}`,
      label: '',
      name: '',
      type: 'string',
      required: false,
    }]);
  };

  const updateField = (id: string, updates: Partial<InputField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const Content = (
    <div className="space-y-6">
      {/* Prompt */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">提示内容</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="请输入提示内容，支持 {{变量}} 插值..."
          className="min-h-[100px] text-sm"
        />
      </div>

      {/* Timeout */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">超时时间（秒）</Label>
        <Input
          type="number"
          value={timeout}
          onChange={(e) => setTimeout(parseInt(e.target.value) || 0)}
          min={0}
          placeholder="0 = 不限时"
          className="h-9"
        />
        <p className="text-xs text-muted-foreground">0 表示不限时</p>
      </div>

      {/* Input Fields */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">输入字段</Label>
        
        {fields.map((field) => (
          <div key={field.id} className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={field.label}
                onChange={(e) => updateField(field.id, { label: e.target.value })}
                placeholder="字段标签"
                className="flex-1 h-8"
              />
              <Select
                value={field.type}
                onValueChange={(type: InputField['type']) => updateField(field.id, { type })}
              >
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeField(field.id)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Input
                value={field.name}
                onChange={(e) => updateField(field.id, { name: e.target.value })}
                placeholder="字段名（用于输出）"
                className="flex-1 h-8 font-mono"
              />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">必填</Label>
                <Switch
                  checked={field.required}
                  onCheckedChange={(required) => updateField(field.id, { required })}
                />
              </div>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addField}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          添加字段
        </Button>
      </div>

      {/* Notification Method */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">通知方式</Label>
        <div className="flex rounded-lg border bg-muted p-1">
          <button
            type="button"
            onClick={() => setNotificationMethod('email')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              notificationMethod === 'email'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            邮件
          </button>
          <button
            type="button"
            onClick={() => setNotificationMethod('webhook')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              notificationMethod === 'webhook'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Webhook
          </button>
        </div>

        {notificationMethod === 'email' ? (
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="通知邮箱"
            className="h-9"
          />
        ) : (
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="Webhook URL"
            className="h-9 font-mono"
          />
        )}
      </div>
    </div>
  );

  return (
    <ConfigPanelWrapper
      title="人工输入"
      typeBadge="Human"
      icon={<UserCheck className="h-4 w-4" />}
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
