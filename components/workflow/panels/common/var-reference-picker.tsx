'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface VarReferencePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variables?: Array<{
    value: string;
    label: string;
    group?: string;
  }>;
}

// 默认变量选项（存根数据）
const defaultVariables = [
  { value: 'sys.query', label: 'sys.query', group: '系统变量' },
  { value: 'sys.files', label: 'sys.files', group: '系统变量' },
  { value: 'sys.user_id', label: 'sys.user_id', group: '系统变量' },
  { value: 'sys.conversation_id', label: 'sys.conversation_id', group: '系统变量' },
  { value: 'node1.output', label: 'node1.output', group: '节点变量' },
  { value: 'node1.text', label: 'node1.text', group: '节点变量' },
  { value: 'conversation.var1', label: 'conversation.var1', group: '会话变量' },
  { value: 'conversation.history', label: 'conversation.history', group: '会话变量' },
];

/**
 * 变量选择器存根组件
 * 在配置面板中用于选择变量引用
 * 真实实现为两级弹出选择器
 */
export function VarReferencePicker({
  value,
  onChange,
  placeholder = '选择变量',
  disabled = false,
  className,
  variables = defaultVariables,
}: VarReferencePickerProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn('h-7 text-xs', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {variables.map((variable) => (
          <SelectItem 
            key={variable.value} 
            value={variable.value}
            className="text-xs"
          >
            {variable.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
