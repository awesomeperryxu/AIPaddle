'use client';

import { useState, useEffect } from 'react';
import {
  Webhook,
  Clock,
  Copy,
  Check,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

// Accent color for Trigger nodes
const ACCENT_COLOR = '#F97316';

// Cron field labels
const CRON_FIELDS = ['分钟', '小时', '日', '月', '星期'];

// Schedule presets
const SCHEDULE_PRESETS = [
  { value: 'every_minute', label: '每分钟', cron: '* * * * *' },
  { value: 'every_hour', label: '每小时', cron: '0 * * * *' },
  { value: 'daily_9am', label: '每天9:00', cron: '0 9 * * *' },
  { value: 'weekly_monday', label: '每周一9:00', cron: '0 9 * * 1' },
  { value: 'monthly_first', label: '每月1日9:00', cron: '0 9 1 * *' },
  { value: 'custom', label: '自定义', cron: '' },
];

// Timezone options
const TIMEZONES = [
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
  { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
];

// ============ Webhook Trigger Panel ============

interface WebhookTriggerConfigData {
  webhook_url?: string;
}

interface TriggerWebhookConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<WebhookTriggerConfigData>) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function TriggerWebhookConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  isOpen,
}: TriggerWebhookConfigPanelV2Props) {
  const config = (node.data as unknown as WebhookTriggerConfigData) || {};
  const [copied, setCopied] = useState(false);
  
  // Generate webhook URL based on node id
  const webhookUrl = config.webhook_url || `https://api.example.com/webhook/${node.id}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
  };

  useEffect(() => {
    if (copied) {
      const timer = globalThis.setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const outputVariables = [
    { name: 'body', type: 'object', description: '请求体' },
    { name: 'headers', type: 'object', description: '请求头' },
    { name: 'query', type: 'object', description: '查询参数' },
  ];

  const Content = (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
        <p className="text-sm text-orange-700 dark:text-orange-300">
          通过 HTTP POST 请求触发此工作流
        </p>
      </div>

      {/* Webhook URL */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Webhook URL</Label>
        <div className="flex gap-2">
          <Input
            value={webhookUrl}
            readOnly
            className="flex-1 font-mono text-sm bg-muted"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="h-9 w-9"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Request Method */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">请求方法</Label>
        <Input value="POST" readOnly className="bg-muted font-mono" />
      </div>

      {/* Output Variables */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">输出变量</Label>
        <div className="space-y-2">
          {outputVariables.map((v) => (
            <div
              key={v.name}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">{v.name}</Badge>
                <span className="text-xs text-muted-foreground">({v.type})</span>
              </div>
              <span className="text-xs text-muted-foreground">{v.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Test Button */}
      <Button variant="outline" className="w-full">
        <Send className="h-4 w-4 mr-2" />
        发送测试请求
      </Button>
    </div>
  );

  return (
    <ConfigPanelWrapper
      title="Webhook 触发"
      typeBadge="Trigger"
      icon={<Webhook className="h-4 w-4" />}
      accentColor={ACCENT_COLOR}
      isOpen={isOpen}
      onClose={onClose}
      showFooter={false}
    >
      {Content}
    </ConfigPanelWrapper>
  );
}

// ============ Schedule Trigger Panel ============

interface ScheduleTriggerConfigData {
  schedule_preset?: string;
  cron?: string;
  timezone?: string;
}

interface TriggerScheduleConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<ScheduleTriggerConfigData>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
}

export function TriggerScheduleConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
}: TriggerScheduleConfigPanelV2Props) {
  const config = (node.data as unknown as ScheduleTriggerConfigData) || {};

  // Local state
  const [schedulePreset, setSchedulePreset] = useState(config.schedule_preset || 'daily_9am');
  const [customCron, setCustomCron] = useState(config.cron || '0 9 * * *');
  const [timezone, setTimezone] = useState(config.timezone || 'Asia/Shanghai');

  // Get current cron expression
  const currentCron = schedulePreset === 'custom'
    ? customCron
    : SCHEDULE_PRESETS.find(p => p.value === schedulePreset)?.cron || '';

  // Parse cron parts for display
  const cronParts = currentCron.split(' ');

  // Calculate next execution time (simplified)
  const getNextExecution = () => {
    const now = new Date();
    // This is a simplified calculation - in production, use a proper cron parser
    if (schedulePreset === 'every_minute') {
      now.setMinutes(now.getMinutes() + 1);
      now.setSeconds(0);
    } else if (schedulePreset === 'every_hour') {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
      now.setSeconds(0);
    } else {
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
    }
    return now.toLocaleString('zh-CN', { timeZone: timezone });
  };

  const handleSave = () => {
    onUpdate({
      schedule_preset: schedulePreset,
      cron: currentCron,
      timezone,
    });
    onSave?.();
  };

  const Content = (
    <div className="space-y-6">
      {/* Schedule Frequency */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">执行频率</Label>
        <Select value={schedulePreset} onValueChange={setSchedulePreset}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCHEDULE_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Custom Cron (only when custom is selected) */}
      {schedulePreset === 'custom' && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Cron 表达式</Label>
          <Input
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="* * * * *"
            className="font-mono"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            {CRON_FIELDS.map((field, i) => (
              <span key={field} className="text-center">
                <span className="font-mono block">{cronParts[i] || '*'}</span>
                <span>{field}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current Cron Expression */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">当前 Cron 表达式</Label>
        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg font-mono text-sm">
          {currentCron}
        </div>
      </div>

      {/* Timezone */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">时区</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Next Execution Time */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">下次执行时间</Label>
        <Input
          value={getNextExecution()}
          readOnly
          className="bg-muted"
        />
      </div>
    </div>
  );

  return (
    <ConfigPanelWrapper
      title="定时触发"
      typeBadge="Schedule"
      icon={<Clock className="h-4 w-4" />}
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
