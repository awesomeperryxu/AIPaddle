'use client';

import { useMemo } from 'react';
import { Cron } from 'croner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WorkflowNode, TriggerScheduleConfig } from '../../types';

// 定时触发节点配置（WF-2）。
// 🔴 此前 node-config-panel 没有接这个节点类型，点开只显示「配置面板正在开发中」——
// 于是 Copilot 生成的定时节点、或用户手动拖进来的定时节点，cron 都改不了。
//
// 字段与 Copilot 产出保持一致（cron / timezone / schedule_preset），
// 经 reactFlowToGraph 收进 node.data.config 落库。

const SCHEDULE_PRESETS = [
  { value: 'every_hour', label: '每小时', cron: '0 * * * *' },
  { value: 'daily_8am', label: '每天 8:00', cron: '0 8 * * *' },
  { value: 'daily_9am', label: '每天 9:00', cron: '0 9 * * *' },
  { value: 'weekly_monday', label: '每周一 9:00', cron: '0 9 * * 1' },
  { value: 'monthly_first', label: '每月 1 日 9:00', cron: '0 9 1 * *' },
  { value: 'custom', label: '自定义 cron', cron: '' },
];

const TIMEZONES = [
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (UTC+8)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
];

const CRON_FIELD_HINT = '五段式：分 时 日 月 周，例「0 8 * * *」= 每天 8:00';

interface ScheduleNodeConfigPanelProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<TriggerScheduleConfig>) => void;
  appType?: 'workflow' | 'chatflow';
}

/** 用 croner 真算下次执行时间——手搓的估算在「每周一」「每月1日」这类表达式上是错的 */
function describeNextRun(cron: string, timezone: string): string {
  if (!cron.trim()) return '请先填写 cron 表达式';
  try {
    const next = new Cron(cron, { timezone }).nextRun();
    return next ? next.toLocaleString('zh-CN', { timeZone: timezone }) : '该表达式不会再触发';
  } catch {
    return 'cron 表达式不合法';
  }
}

export function ScheduleNodeConfigPanel({ node, onUpdate }: ScheduleNodeConfigPanelProps) {
  const config = node.data as TriggerScheduleConfig;
  const cron = config.cron ?? '0 9 * * *';
  const timezone = config.timezone ?? 'Asia/Shanghai';
  // 预设以 cron 为准反推，避免「预设显示每天9点、实际 cron 是别的」这种不一致
  const preset = SCHEDULE_PRESETS.find((p) => p.cron && p.cron === cron)?.value ?? 'custom';

  const nextRun = useMemo(() => describeNextRun(cron, timezone), [cron, timezone]);

  const handlePreset = (value: string) => {
    const hit = SCHEDULE_PRESETS.find((p) => p.value === value);
    onUpdate({ schedule_preset: value, ...(hit?.cron ? { cron: hit.cron } : {}) });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium">执行频率</Label>
        <Select value={preset} onValueChange={handlePreset}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCHEDULE_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium" htmlFor="schedule-cron">Cron 表达式</Label>
        <Input
          id="schedule-cron"
          value={cron}
          onChange={(e) => onUpdate({ cron: e.target.value, schedule_preset: 'custom' })}
          placeholder="0 8 * * *"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">{CRON_FIELD_HINT}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">时区</Label>
        <Select value={timezone} onValueChange={(v) => onUpdate({ timezone: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">下次执行时间</Label>
        <Input value={nextRun} readOnly className="bg-muted" />
      </div>

      {/* 说明真实边界：画布上配好只是「流程定义」，真正到点自动跑还没接调度器 */}
      <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        定时配置目前保存在流程定义中，用于运行时读取与人工核对；
        到点自动触发的调度服务尚未接入（WF-2 后续任务），现阶段请用「运行」手动执行。
      </p>
    </div>
  );
}
