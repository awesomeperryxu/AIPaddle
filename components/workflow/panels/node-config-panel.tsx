'use client';

import { useMemo } from 'react';
import { X, RotateCcw, Save, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { nodeRegistry } from '../nodes';
import type { WorkflowNode, NodeConfig, BlockEnum, VarType } from '../types';

// Import config components
import { StartNodeConfigPanel } from './configs/start-config';
import { EndNodeConfigPanel } from './configs/end-config';
import { LLMNodeConfigPanel } from './configs/llm-config';
import { CodeNodeConfigPanel } from './configs/code-config';
import { IfElseNodeConfigPanel } from './configs/if-else-config';
import { HttpNodeConfigPanel } from './configs/http-config';
import { IterationNodeConfigPanel } from './configs/iteration-config';
import { KnowledgeRetrievalConfigPanel } from './configs/knowledge-retrieval-config';
import { AgentNodeConfigPanel } from './configs/agent-config';
import { QuestionClassifierConfigPanel } from './configs/question-classifier-config';
import { ParameterExtractorConfigPanel } from './configs/parameter-extractor-config';
import { TemplateTransformConfigPanel } from './configs/template-transform-config';
import { VariableAssignerConfigPanel } from './configs/variable-assigner-config';
import { AnswerNodeConfigPanel } from './configs/answer-config';

interface NodeConfigPanelProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onClose: () => void;
  onUpdate: (nodeId: string, data: Partial<NodeConfig>) => void;
  onTitleChange: (nodeId: string, title: string) => void;
  onDescriptionChange?: (nodeId: string, description: string) => void;
  appType?: 'workflow' | 'chatflow';
  className?: string;
}

interface OutputVariable {
  key: string;
  type: VarType;
  description?: string;
}

// Get output variables for a node type
function getNodeOutputVariables(node: WorkflowNode): OutputVariable[] {
  const { type, data } = node;
  
  switch (type) {
    case 'start':
      return (data as { variables?: { key: string; type: VarType; description?: string }[] })?.variables?.map(v => ({
        key: v.key,
        type: v.type,
        description: v.description,
      })) || [];
    
    case 'llm':
      return [
        { key: 'text', type: 'string' as VarType, description: 'LLM 生成的文本' },
        { key: 'usage', type: 'object' as VarType, description: 'Token 使用统计' },
      ];
    
    case 'code':
      return (data as { outputs?: { key: string; type: VarType }[] })?.outputs?.map(o => ({
        key: o.key,
        type: o.type,
      })) || [];
    
    case 'http-request':
      return [
        { key: 'body', type: 'string' as VarType, description: '响应体' },
        { key: 'status_code', type: 'number' as VarType, description: 'HTTP 状态码' },
        { key: 'headers', type: 'object' as VarType, description: '响应头' },
      ];
    
    case 'knowledge-retrieval':
      return [
        { key: 'result', type: 'array[object]' as VarType, description: '检索结果' },
      ];
    
    case 'iteration':
      return [
        { key: 'output', type: 'array' as VarType, description: '迭代输出数组' },
      ];

    case 'question-classifier':
      return [
        { key: 'class_name', type: 'string' as VarType, description: '分类名称' },
      ];

    case 'parameter-extractor':
      const params = (data as { parameters?: { name: string; type: VarType }[] })?.parameters || [];
      return params.map(p => ({
        key: p.name,
        type: p.type,
        description: `提取的参数: ${p.name}`,
      }));

    case 'template-transform':
      return [
        { key: 'output', type: 'string' as VarType, description: '转换后的文本' },
      ];

    case 'agent':
      return [
        { key: 'text', type: 'string' as VarType, description: 'Agent 最终输出' },
        { key: 'files', type: 'array' as VarType, description: '生成的文件' },
      ];
    
    default:
      return [
        { key: 'output', type: 'string' as VarType, description: '输出' },
      ];
  }
}

// Get input dependencies for a node
function getNodeInputVariables(node: WorkflowNode): { nodeId: string; varKey: string }[] {
  const inputs: { nodeId: string; varKey: string }[] = [];
  const data = node.data as Record<string, unknown>;
  
  // Check common variable selector patterns
  const checkSelector = (selector: unknown) => {
    if (Array.isArray(selector) && selector.length >= 2) {
      inputs.push({ nodeId: selector[0] as string, varKey: selector.slice(1).join('.') });
    }
  };
  
  // Check for query_variable, iterator_selector, etc.
  if (data.query_variable) checkSelector(data.query_variable);
  if (data.iterator_selector) checkSelector(data.iterator_selector);
  if (data.variable) checkSelector(data.variable);
  
  // Check variables array
  if (Array.isArray(data.variables)) {
    data.variables.forEach((v: { value?: unknown }) => {
      if (v.value) checkSelector(v.value);
    });
  }
  
  return inputs;
}

export function NodeConfigPanel({
  node,
  allNodes,
  onClose,
  onUpdate,
  onTitleChange,
  onDescriptionChange,
  appType = 'workflow',
  className,
}: NodeConfigPanelProps) {
  const nodeConfig = nodeRegistry[node.type as BlockEnum];
  const Icon = nodeConfig?.icon;

  const outputVariables = useMemo(() => getNodeOutputVariables(node), [node]);
  const inputVariables = useMemo(() => getNodeInputVariables(node), [node]);

  // Render the appropriate config component based on node type
  const renderConfigContent = () => {
    const commonProps = {
      node,
      allNodes,
      onUpdate: (data: Partial<NodeConfig>) => onUpdate(node.id, data),
      appType,
    };

    switch (node.type) {
      case 'start':
        return <StartNodeConfigPanel {...commonProps} />;
      case 'end':
        return <EndNodeConfigPanel {...commonProps} />;
      case 'llm':
        return <LLMNodeConfigPanel {...commonProps} />;
      case 'code':
        return <CodeNodeConfigPanel {...commonProps} />;
      case 'if-else':
        return <IfElseNodeConfigPanel {...commonProps} />;
      case 'http-request':
        return <HttpNodeConfigPanel {...commonProps} />;
      case 'iteration':
        return <IterationNodeConfigPanel {...commonProps} />;
      case 'knowledge-retrieval':
        return <KnowledgeRetrievalConfigPanel {...commonProps} />;
      case 'agent':
        return <AgentNodeConfigPanel {...commonProps} />;
      case 'question-classifier':
        return <QuestionClassifierConfigPanel {...commonProps} />;
      case 'parameter-extractor':
        return <ParameterExtractorConfigPanel {...commonProps} />;
      case 'template-transform':
        return <TemplateTransformConfigPanel {...commonProps} />;
      case 'variable-assigner':
        return <VariableAssignerConfigPanel {...commonProps} />;
      case 'answer':
        return <AnswerNodeConfigPanel {...commonProps} />;
      default:
        return (
          <div className="p-4 text-center text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2" />
            <p>该节点类型的配置面板正在开发中</p>
            <p className="text-sm mt-1">节点类型: {node.type}</p>
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background border-l',
        className
      )}
      style={{ width: 400 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          {Icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: nodeConfig?.bgColor }}
            >
              <Icon className="h-4 w-4" style={{ color: nodeConfig?.color }} />
            </div>
          )}
          <div>
            <input
              type="text"
              value={node.title}
              onChange={(e) => onTitleChange(node.id, e.target.value)}
              className="font-medium text-sm bg-transparent border-none outline-none focus:ring-1 focus:ring-primary rounded px-1 -ml-1"
            />
            <Badge variant="secondary" className="text-[10px] mt-0.5">
              {nodeConfig?.label}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="params" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b px-4 h-10 bg-transparent">
          <TabsTrigger value="params" className="text-sm">
            参数配置
          </TabsTrigger>
          <TabsTrigger value="inputs" className="text-sm">
            输入变量
            {inputVariables.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1">
                {inputVariables.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outputs" className="text-sm">
            输出变量
            {outputVariables.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1">
                {outputVariables.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Params Tab */}
        <TabsContent value="params" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {renderConfigContent()}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Inputs Tab */}
        <TabsContent value="inputs" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {inputVariables.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">该节点没有引用其他节点的变量</p>
                </div>
              ) : (
                inputVariables.map((input, index) => {
                  const sourceNode = allNodes.find(n => n.id === input.nodeId);
                  const sourceConfig = sourceNode ? nodeRegistry[sourceNode.type as BlockEnum] : null;
                  const SourceIcon = sourceConfig?.icon;
                  
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                    >
                      {SourceIcon && (
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                          style={{ backgroundColor: sourceConfig?.bgColor }}
                        >
                          <SourceIcon
                            className="h-3.5 w-3.5"
                            style={{ color: sourceConfig?.color }}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {sourceNode?.title || input.nodeId}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {input.varKey}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Outputs Tab */}
        <TabsContent value="outputs" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {outputVariables.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">该节点没有输出变量</p>
                </div>
              ) : (
                outputVariables.map((output, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-medium">
                          {output.key}
                        </code>
                        <Badge variant="outline" className="text-[10px]">
                          {output.type}
                        </Badge>
                      </div>
                      {output.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {output.description}
                        </p>
                      )}
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(`{{${node.id}.${output.key}}}`);
                            }}
                          >
                            <span className="text-xs">复制</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>复制变量引用</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
        <Button variant="outline" size="sm">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          重置
        </Button>
        <Button size="sm">
          <Save className="h-3.5 w-3.5 mr-1.5" />
          保存
        </Button>
      </div>
    </div>
  );
}
