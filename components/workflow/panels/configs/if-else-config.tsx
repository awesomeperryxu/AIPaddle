'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ConditionEditor } from '../common/condition-editor';
import { LogicalOperator, ComparisonOperator } from '../../types';
import type { WorkflowNode, IfElseNodeConfig, IfElseCase, ConditionGroup } from '../../types';

interface IfElseNodeConfigPanelProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<IfElseNodeConfig>) => void;
  appType?: 'workflow' | 'chatflow';
}

function generateId(): string {
  return `case-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateConditionId(): string {
  return `cond-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create empty condition
function createEmptyCondition() {
  return {
    id: generateConditionId(),
    variable: [],
    operator: ComparisonOperator.Is,
    value: '',
  };
}

// Create empty condition group
function createEmptyConditionGroup(): ConditionGroup {
  return {
    id: generateId(),
    logicalOperator: LogicalOperator.And,
    conditions: [createEmptyCondition()],
  };
}

interface CasePanelProps {
  caseItem: IfElseCase;
  caseIndex: number;
  label: string;
  color: string;
  onUpdate: (caseItem: IfElseCase) => void;
  onDelete?: () => void;
  availableNodes: WorkflowNode[];
  currentNodeId: string;
  canDelete?: boolean;
}

function CasePanel({
  caseItem,
  caseIndex,
  label,
  color,
  onUpdate,
  onDelete,
  availableNodes,
  currentNodeId,
  canDelete = false,
}: CasePanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-pointer',
          color
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <GitBranch className="h-4 w-4" />
        <Badge variant="outline" className="font-mono text-xs bg-background">
          {label}
        </Badge>
        <div className="flex-1" />
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
        <div className="p-3">
          <ConditionEditor
            conditions={caseItem.conditions as ConditionGroup[]}
            onChange={(conditions) => onUpdate({ ...caseItem, conditions })}
            availableNodes={availableNodes}
            currentNodeId={currentNodeId}
          />
        </div>
      )}
    </div>
  );
}

export function IfElseNodeConfigPanel({
  node,
  allNodes,
  onUpdate,
  appType = 'workflow',
}: IfElseNodeConfigPanelProps) {
  const config = node.data as IfElseNodeConfig;
  const cases = config.cases || [];

  // Get IF case (always first, or create if missing)
  const ifCase = cases.find(c => c.caseId === 'if-true') || {
    id: generateId(),
    caseId: 'if-true',
    logicalOperator: LogicalOperator.And,
    conditions: [createEmptyConditionGroup()],
  };

  // Get ELIF cases
  const elifCases = cases.filter(c => c.caseId.startsWith('elif-'));

  // ELSE is implicit (no conditions needed)

  const updateCase = (caseItem: IfElseCase) => {
    const newCases = cases.map(c => 
      c.caseId === caseItem.caseId ? caseItem : c
    );
    // If case doesn't exist, add it
    if (!cases.find(c => c.caseId === caseItem.caseId)) {
      newCases.unshift(caseItem);
    }
    onUpdate({ cases: newCases });
  };

  const addElifCase = () => {
    const newElifCase: IfElseCase = {
      id: generateId(),
      caseId: `elif-${elifCases.length + 1}`,
      logicalOperator: LogicalOperator.And,
      conditions: [createEmptyConditionGroup()],
    };
    
    // Insert before ELSE (at the end of elif cases)
    const ifCaseIndex = cases.findIndex(c => c.caseId === 'if-true');
    const newCases = [...cases];
    if (ifCaseIndex >= 0) {
      newCases.splice(ifCaseIndex + 1 + elifCases.length, 0, newElifCase);
    } else {
      newCases.push(newElifCase);
    }
    
    onUpdate({ cases: newCases });
  };

  const deleteElifCase = (caseId: string) => {
    const newCases = cases.filter(c => c.caseId !== caseId);
    // Re-number remaining elif cases
    let elifIndex = 1;
    newCases.forEach(c => {
      if (c.caseId.startsWith('elif-')) {
        c.caseId = `elif-${elifIndex}`;
        elifIndex++;
      }
    });
    onUpdate({ cases: newCases });
  };

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="text-sm text-muted-foreground">
        根据条件判断执行不同的分支。条件从上到下依次判断，执行第一个满足条件的分支。
      </div>

      {/* IF Branch */}
      <CasePanel
        caseItem={ifCase}
        caseIndex={0}
        label="IF"
        color="bg-green-50 text-green-700"
        onUpdate={updateCase}
        availableNodes={allNodes}
        currentNodeId={node.id}
        canDelete={false}
      />

      {/* ELIF Branches */}
      {elifCases.map((elifCase, index) => (
        <CasePanel
          key={elifCase.id}
          caseItem={elifCase}
          caseIndex={index + 1}
          label={`ELIF ${index + 1}`}
          color="bg-blue-50 text-blue-700"
          onUpdate={updateCase}
          onDelete={() => deleteElifCase(elifCase.caseId)}
          availableNodes={allNodes}
          currentNodeId={node.id}
          canDelete={true}
        />
      ))}

      {/* Add ELIF Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={addElifCase}
        className="w-full border-dashed"
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        添加 ELIF 分支
      </Button>

      {/* ELSE Branch (implicit) */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-700">
          <GitBranch className="h-4 w-4" />
          <Badge variant="outline" className="font-mono text-xs bg-background">
            ELSE
          </Badge>
          <span className="text-xs text-muted-foreground">
            （当以上条件都不满足时执行）
          </span>
        </div>
      </div>

      {/* Output Ports Info */}
      <Separator />
      <div className="space-y-2">
        <Label className="text-sm font-medium">输出端口</Label>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>IF - 条件满足时</span>
          </div>
          {elifCases.map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>ELIF {index + 1} - 第 {index + 2} 个条件满足时</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
            <span>ELSE - 所有条件都不满足时</span>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
        <p className="font-medium">提示</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>条件从上到下依次判断</li>
          <li>只会执行第一个满足条件的分支</li>
          <li>每个分支可以有多个条件组</li>
          <li>条件组内使用 AND/OR 逻辑</li>
        </ul>
      </div>
    </div>
  );
}
