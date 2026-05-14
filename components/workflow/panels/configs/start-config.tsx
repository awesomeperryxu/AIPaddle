'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import type { WorkflowNode, StartNodeConfig, VariableDefinition, VarType } from '../../types';

interface StartNodeConfigPanelProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<StartNodeConfig>) => void;
  appType?: 'workflow' | 'chatflow';
}

// Available variable types
const varTypes: { value: VarType; label: string }[] = [
  { value: VarType.String, label: '字符串' },
  { value: VarType.Number, label: '数字' },
  { value: VarType.Boolean, label: '布尔值' },
  { value: VarType.Object, label: '对象' },
  { value: VarType.ArrayString, label: '字符串数组' },
  { value: VarType.ArrayNumber, label: '数字数组' },
  { value: VarType.ArrayObject, label: '对象数组' },
  { value: VarType.File, label: '单文件' },
  { value: VarType.Files, label: '多文件' },
];

// System variables (read-only)
const systemVariables: VariableDefinition[] = [
  { key: 'sys.user_id', type: VarType.String, description: '当前用户ID' },
  { key: 'sys.conversation_id', type: VarType.String, description: '会话ID (Chatflow)' },
  { key: 'sys.app_id', type: VarType.String, description: '应用ID' },
  { key: 'sys.workflow_run_id', type: VarType.String, description: '运行ID' },
];

function generateId(): string {
  return `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface VariableItemProps {
  variable: VariableDefinition & { id?: string };
  onChange: (variable: VariableDefinition & { id?: string }) => void;
  onDelete: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function VariableItem({
  variable,
  onChange,
  onDelete,
  isExpanded,
  onToggleExpand,
}: VariableItemProps) {
  return (
    <div className="border rounded-lg bg-background">
      {/* Header */}
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="flex-1 flex items-center gap-2">
          <code className="text-sm font-mono font-medium">{variable.key || '未命名'}</code>
          <Badge variant="outline" className="text-[10px]">
            {varTypes.find(t => t.value === variable.type)?.label || variable.type}
          </Badge>
          {variable.required && (
            <Badge variant="destructive" className="text-[10px]">必填</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="h-7 w-7"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t">
          <div className="grid grid-cols-2 gap-3 pt-3">
            {/* Variable Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">变量名</Label>
              <Input
                value={variable.key}
                onChange={(e) => onChange({ ...variable, key: e.target.value })}
                placeholder="变量名称"
                className="h-8 text-sm font-mono"
              />
            </div>

            {/* Variable Type */}
            <div className="space-y-1.5">
              <Label className="text-xs">类型</Label>
              <Select
                value={variable.type}
                onValueChange={(value: VarType) => onChange({ ...variable, type: value })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {varTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-xs">显示名称</Label>
            <Input
              value={variable.label || ''}
              onChange={(e) => onChange({ ...variable, label: e.target.value })}
              placeholder="用户可见的名称"
              className="h-8 text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs">描述</Label>
            <Textarea
              value={variable.description || ''}
              onChange={(e) => onChange({ ...variable, description: e.target.value })}
              placeholder="变量说明..."
              className="min-h-[60px] text-sm resize-none"
            />
          </div>

          {/* Required & Default Value */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={variable.required || false}
                onCheckedChange={(checked) => onChange({ ...variable, required: checked })}
              />
              <Label className="text-xs">必填</Label>
            </div>
          </div>

          {/* Default Value */}
          {!variable.required && (
            <div className="space-y-1.5">
              <Label className="text-xs">默认值</Label>
              <Input
                value={
                  typeof variable.defaultValue === 'string'
                    ? variable.defaultValue
                    : JSON.stringify(variable.defaultValue ?? '')
                }
                onChange={(e) => onChange({ ...variable, defaultValue: e.target.value })}
                placeholder="默认值"
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* Max Length (for strings) */}
          {variable.type === 'string' && (
            <div className="space-y-1.5">
              <Label className="text-xs">最大长度</Label>
              <Input
                type="number"
                value={variable.maxLength || ''}
                onChange={(e) => 
                  onChange({ ...variable, maxLength: parseInt(e.target.value) || undefined })
                }
                placeholder="不限制"
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* Options (for select type) */}
          {variable.options && (
            <div className="space-y-1.5">
              <Label className="text-xs">选项（每行一个）</Label>
              <Textarea
                value={variable.options.map(o => o.value).join('\n')}
                onChange={(e) => 
                  onChange({
                    ...variable,
                    options: e.target.value.split('\n').map(v => ({ value: v.trim(), label: v.trim() })),
                  })
                }
                placeholder="选项值..."
                className="min-h-[60px] text-sm resize-none font-mono"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StartNodeConfigPanel({
  node,
  allNodes,
  onUpdate,
  appType = 'workflow',
}: StartNodeConfigPanelProps) {
  const config = node.data as StartNodeConfig;
  const variables = config.variables || [];
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showSystemVars, setShowSystemVars] = useState(false);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const addVariable = () => {
    const newVar: VariableDefinition & { id: string } = {
      id: generateId(),
      key: `var_${variables.length + 1}`,
      type: 'string' as VarType,
      required: false,
    };
    const newExpandedIds = new Set(expandedIds);
    newExpandedIds.add(newVar.id);
    setExpandedIds(newExpandedIds);
    onUpdate({ variables: [...variables, newVar] });
  };

  const updateVariable = (index: number, variable: VariableDefinition) => {
    const newVariables = [...variables];
    newVariables[index] = variable;
    onUpdate({ variables: newVariables });
  };

  const deleteVariable = (index: number) => {
    const newVariables = [...variables];
    newVariables.splice(index, 1);
    onUpdate({ variables: newVariables });
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="text-sm text-muted-foreground">
        定义工作流的输入变量。这些变量将在运行时由用户提供或通过 API 传入。
      </div>

      {/* User Variables */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">输入变量</Label>
          <Button variant="outline" size="sm" onClick={addVariable}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            添加变量
          </Button>
        </div>

        {variables.length === 0 ? (
          <div className="text-center py-8 border rounded-lg border-dashed">
            <p className="text-sm text-muted-foreground">暂无输入变量</p>
            <Button variant="link" size="sm" onClick={addVariable} className="mt-1">
              添加第一个变量
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {variables.map((variable, index) => (
              <VariableItem
                key={(variable as { id?: string }).id || index}
                variable={variable as VariableDefinition & { id?: string }}
                onChange={(v) => updateVariable(index, v)}
                onDelete={() => deleteVariable(index)}
                isExpanded={expandedIds.has((variable as { id?: string }).id || `idx-${index}`)}
                onToggleExpand={() => toggleExpanded((variable as { id?: string }).id || `idx-${index}`)}
              />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* System Variables */}
      <Collapsible open={showSystemVars} onOpenChange={setShowSystemVars}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between px-0">
            <span className="text-sm font-medium">系统变量</span>
            <ChevronDown className={cn(
              'h-4 w-4 transition-transform',
              showSystemVars && 'rotate-180'
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <p className="text-xs text-muted-foreground mb-3">
            系统自动提供的变量，在所有节点中可用。
          </p>
          {systemVariables
            .filter(v => appType === 'chatflow' || !v.key.includes('conversation'))
            .map((variable) => (
            <div
              key={variable.key}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono">{variable.key}</code>
                <Badge variant="outline" className="text-[10px]">
                  {variable.type}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">{variable.description}</span>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
