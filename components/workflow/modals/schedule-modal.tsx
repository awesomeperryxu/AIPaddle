'use client';

import { useState } from 'react';
import { Cron } from 'croner';
import { Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WorkflowSchedule } from '@/lib/workflow/graph-adapter';

// 定时设置弹窗（WF-2b）。
// 🔴 定时**不做成画布节点**：用户明确要求「定时任务要和流程内容解耦」——
// 「什么时候跑」是工作流的运行属性，画布只画「跑什么」。
// 因此入口挂在 header「运行 ▾」里，配置落在 graph.schedule 元数据上。

const PRESETS = [
  { value: '0 * * * *', label: '每小时' },
  { value: '0 8 * * *', label: '每天 8:00' },
  { value: '0 9 * * *', label: '每天 9:00' },
  { value: '0 9 * * 1', label: '每周一 9:00' },
  { value: '0 9 1 * *', label: '每月 1 日 9:00' },
];

const TIMEZONES = [
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (UTC+8)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
];

const DEFAULT: WorkflowSchedule = { enabled: false, cron: '0 9 * * *', timezone: 'Asia/Shanghai' };

/** 用 croner 真算下次执行时间——手搓估算在「每周一」「每月 1 日」这类表达式上是错的 */
function describeNextRun(cron: string, timezone: string): { text: string; valid: boolean } {
  if (!cron.trim()) return { text: '请填写 cron 表达式', valid: false };
  try {
    const next = new Cron(cron, { timezone }).nextRun();
    return next
      ? { text: next.toLocaleString('zh-CN', { timeZone: timezone }), valid: true }
      : { text: '该表达式不会再触发', valid: false };
  } catch {
    return { text: 'cron 表达式不合法', valid: false };
  }
}

interface ScheduleModalProps {
  open: boolean;
  schedule?: WorkflowSchedule;
  onClose: () => void;
  onSave: (schedule: WorkflowSchedule | undefined) => void;
}

export function ScheduleModal({ open, schedule, onClose, onSave }: ScheduleModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* 表单条件挂载：每次打开都是新实例，草稿自然回到外部最新值，
            不必在 effect 里同步 setState（React 编译器会判定为级联渲染） */}
        {open && <ScheduleForm initial={schedule ?? DEFAULT} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function ScheduleForm({
  initial,
  onClose,
  onSave,
}: {
  initial: WorkflowSchedule;
  onClose: () => void;
  onSave: (schedule: WorkflowSchedule | undefined) => void;
}) {
  const [draft, setDraft] = useState<WorkflowSchedule>(initial);

  const next = describeNextRun(draft.cron, draft.timezone);
  const presetHit = PRESETS.find((p) => p.value === draft.cron)?.value ?? 'custom';

  return (
    <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            定时设置
          </DialogTitle>
          <DialogDescription className="text-xs">
            决定这条工作流「什么时候跑」，与流程内容无关，不占画布节点。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="schedule-enabled" className="text-sm font-medium">启用定时</Label>
            <Switch
              id="schedule-enabled"
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">执行频率</Label>
            <Select
              value={presetHit}
              onValueChange={(v) => v !== 'custom' && setDraft({ ...draft, cron: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
                <SelectItem value="custom">自定义 cron</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-cron" className="text-sm font-medium">Cron 表达式</Label>
            <Input
              id="schedule-cron"
              value={draft.cron}
              onChange={(e) => setDraft({ ...draft, cron: e.target.value })}
              placeholder="0 8 * * *"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">五段式：分 时 日 月 周，例「0 8 * * *」= 每天 8:00</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">时区</Label>
            <Select value={draft.timezone} onValueChange={(v) => setDraft({ ...draft, timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">下次执行时间</Label>
            <p className={next.valid ? 'text-sm text-foreground' : 'text-sm text-destructive'}>{next.text}</p>
          </div>

          {/* 说明真实边界：配置已随流程保存，但到点自动跑的调度服务还没接 */}
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            定时配置会随流程保存，用于运行时读取与人工核对；到点自动触发的调度服务尚未接入
            （WF-2 后续任务），现阶段请用「运行」手动执行。
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => { onSave(undefined); onClose(); }}>
            清除定时
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" disabled={!next.valid} onClick={() => { onSave(draft); onClose(); }}>
            保存
          </Button>
        </DialogFooter>
    </>
  );
}
