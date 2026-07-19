'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  X,
  ArrowRight,
  CheckCircle2,
  Puzzle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Types
type Severity = 'error' | 'warning';

interface NodeIssue {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  severity: Severity;
  message: string;
}

interface PluginIssue {
  id: string;
  pluginName: string;
  version: string;
  message: string;
}

interface ChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: () => void;
  onGoToNode: (nodeId: string) => void;
  onUpdatePlugin: (pluginName: string) => void;
  nodeIssues: NodeIssue[];
  pluginIssues: PluginIssue[];
}

export function ChecklistModal({
  isOpen,
  onClose,
  onPublish,
  onGoToNode,
  onUpdatePlugin,
  nodeIssues,
  pluginIssues,
}: ChecklistModalProps) {
  const errorCount = nodeIssues.filter(i => i.severity === 'error').length + pluginIssues.length;
  const warningCount = nodeIssues.filter(i => i.severity === 'warning').length;
  const hasErrors = errorCount > 0;
  const allPassed = nodeIssues.length === 0 && pluginIssues.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[480px] max-h-[80vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold">发布前检查</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              {errorCount > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">
                  {errorCount} 个错误
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                  {warningCount} 个警告
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* All Passed State */}
          {allPassed && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">所有检查通过</p>
                <p className="text-sm text-green-700 mt-0.5">工作流可以安全发布</p>
              </div>
            </div>
          )}

          {/* Node Issues */}
          {nodeIssues.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">节点问题</h3>
              <div className="space-y-2">
                {nodeIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={cn(
                      'p-3 rounded-lg border flex items-start gap-3',
                      issue.severity === 'error'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-yellow-50 border-yellow-200'
                    )}
                  >
                    <AlertTriangle
                      className={cn(
                        'h-4 w-4 flex-shrink-0 mt-0.5',
                        issue.severity === 'error' ? 'text-red-600' : 'text-yellow-600'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'font-medium text-sm',
                          issue.severity === 'error' ? 'text-red-900' : 'text-yellow-900'
                        )}>
                          {issue.nodeName}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {issue.nodeType}
                        </Badge>
                      </div>
                      <p className={cn(
                        'text-xs mt-1',
                        issue.severity === 'error' ? 'text-red-700' : 'text-yellow-700'
                      )}>
                        {issue.message}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs flex-shrink-0"
                      onClick={() => onGoToNode(issue.nodeId)}
                    >
                      转到
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plugin Issues */}
          {pluginIssues.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">插件问题</h3>
              <div className="space-y-2">
                {pluginIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3"
                  >
                    <Puzzle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-red-900">
                          {issue.pluginName}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          v{issue.version}
                        </Badge>
                      </div>
                      <p className="text-xs text-red-700 mt-1">{issue.message}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs flex-shrink-0"
                      onClick={() => onUpdatePlugin(issue.pluginName)}
                    >
                      更新
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 pt-3 border-t flex-shrink-0">
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              取消
            </Button>
            <Button
              className="flex-1"
              disabled={hasErrors}
              onClick={onPublish}
            >
              {hasErrors ? `修复 ${errorCount} 个问题后发布` : '发布工作流'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Demo component
export function ChecklistModalDemo() {
  const [isOpen, setIsOpen] = useState(true);
  const [scenario, setScenario] = useState<'errors' | 'warnings' | 'passed'>('errors');

  const nodeIssuesWithErrors: NodeIssue[] = [
    {
      id: '1',
      nodeId: 'llm-1',
      nodeName: 'LLM 节点',
      nodeType: 'LLM',
      severity: 'error',
      message: '未选择模型，请配置 AI 模型',
    },
    {
      id: '2',
      nodeId: 'http-1',
      nodeName: 'HTTP 请求',
      nodeType: 'HTTP',
      severity: 'error',
      message: 'URL 不能为空',
    },
    {
      id: '3',
      nodeId: 'code-1',
      nodeName: '代码执行',
      nodeType: 'Code',
      severity: 'warning',
      message: '代码中存在未使用的变量',
    },
  ];

  const pluginIssuesWithErrors: PluginIssue[] = [
    {
      id: '1',
      pluginName: 'OpenAI GPT',
      version: '1.2.0',
      message: '插件版本过旧，建议更新到 2.0.0',
    },
  ];

  const warningOnlyIssues: NodeIssue[] = [
    {
      id: '1',
      nodeId: 'code-1',
      nodeName: '代码执行',
      nodeType: 'Code',
      severity: 'warning',
      message: '代码中存在未使用的变量',
    },
  ];

  const getIssues = () => {
    switch (scenario) {
      case 'errors':
        return { nodeIssues: nodeIssuesWithErrors, pluginIssues: pluginIssuesWithErrors };
      case 'warnings':
        return { nodeIssues: warningOnlyIssues, pluginIssues: [] };
      case 'passed':
        return { nodeIssues: [], pluginIssues: [] };
    }
  };

  const { nodeIssues, pluginIssues } = getIssues();

  return (
    <div className="p-8">
      <div className="flex gap-2 mb-4">
        <Button
          variant={scenario === 'errors' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setScenario('errors'); setIsOpen(true); }}
        >
          有错误
        </Button>
        <Button
          variant={scenario === 'warnings' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setScenario('warnings'); setIsOpen(true); }}
        >
          仅警告
        </Button>
        <Button
          variant={scenario === 'passed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setScenario('passed'); setIsOpen(true); }}
        >
          全部通过
        </Button>
      </div>

      <ChecklistModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onPublish={() => alert('发布成功！')}
        onGoToNode={(nodeId) => alert(`转到节点: ${nodeId}`)}
        onUpdatePlugin={(name) => alert(`更新插件: ${name}`)}
        nodeIssues={nodeIssues}
        pluginIssues={pluginIssues}
      />
    </div>
  );
}
