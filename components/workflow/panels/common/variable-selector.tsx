'use client';

import { useState, useMemo } from 'react';
import { Check, ChevronDown, ChevronRight, Variable, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import type { ValueSelector, VarType } from '../../types';
import type { WorkflowNode } from '../../types';
import { nodeRegistry } from '../../nodes';
import { BlockEnum } from '../../types';

// Simple variable definition for config panels - compatible with VariableDefinition
interface SimpleVariable {
  key?: string;  // VariableDefinition uses key
  name?: string; // Alternative name field
  type: VarType | string;
  description?: string;
  label?: string;
}

// Get display name from variable
function getVariableName(v: SimpleVariable): string {
  return v.name || v.key || v.label || '';
}

export interface VariableSelectorProps {
  // Full mode - with nodes
  value?: ValueSelector;
  onChange?: (value: ValueSelector) => void;
  availableNodes?: WorkflowNode[];
  currentNodeId?: string;
  // Simple mode - with pre-processed variables (supports VariableDefinition)
  variables?: SimpleVariable[];
  onSelect?: (variable: SimpleVariable) => void;
  // Common props
  filterTypes?: VarType[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface NodeVariable {
  key: string;
  type: VarType;
  children?: NodeVariable[];
}

// Mock function to get output variables for a node
// In real implementation, this would analyze the node's config
function getNodeOutputVariables(node: WorkflowNode): NodeVariable[] {
  const { type, data } = node;
  
  switch (type) {
    case BlockEnum.Start:
      return (data as { variables?: { key: string; type: VarType }[] })?.variables?.map(v => ({
        key: v.key,
        type: v.type,
      })) || [];
    
    case BlockEnum.LLM:
      return [
        { key: 'text', type: 'string' as VarType },
        { key: 'usage', type: 'object' as VarType, children: [
          { key: 'prompt_tokens', type: 'number' as VarType },
          { key: 'completion_tokens', type: 'number' as VarType },
          { key: 'total_tokens', type: 'number' as VarType },
        ]},
      ];
    
    case BlockEnum.Code:
      return (data as { outputs?: { key: string; type: VarType }[] })?.outputs?.map(o => ({
        key: o.key,
        type: o.type,
      })) || [];
    
    case BlockEnum.HttpRequest:
      return [
        { key: 'body', type: 'string' as VarType },
        { key: 'status_code', type: 'number' as VarType },
        { key: 'headers', type: 'object' as VarType },
      ];
    
    case BlockEnum.KnowledgeRetrieval:
      return [
        { key: 'result', type: 'array[object]' as VarType },
      ];
    
    case BlockEnum.Iteration:
      return [
        { key: 'item', type: 'any' as VarType },
        { key: 'index', type: 'number' as VarType },
      ];
    
    default:
      return [
        { key: 'output', type: 'string' as VarType },
      ];
  }
}

export function VariableSelector({
  value,
  onChange,
  availableNodes = [],
  currentNodeId = '',
  variables,
  onSelect,
  filterTypes,
  placeholder = '选择变量',
  disabled = false,
  className,
}: VariableSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Simple mode - using pre-processed variables
  const isSimpleMode = !!variables && !!onSelect;

  // Filter nodes that come before the current node (upstream)
  const upstreamNodes = useMemo(() => {
    if (isSimpleMode) return [];
    // In a real implementation, we'd topologically sort and filter
    return availableNodes.filter(node => node.id !== currentNodeId);
  }, [availableNodes, currentNodeId, isSimpleMode]);

  // Get the selected variable display
  const selectedDisplay = useMemo(() => {
    if (!value || value.length === 0) return null;
    
    const [nodeId, ...path] = value;
    const node = availableNodes.find(n => n.id === nodeId);
    if (!node) return null;
    
    const nodeName = node.title || nodeRegistry[node.type]?.label || nodeId;
    return {
      nodeName,
      varPath: path.join('.'),
    };
  }, [value, availableNodes]);

  const toggleNodeExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleSelect = (nodeId: string, varPath: string[]) => {
    if (onChange) {
      onChange([nodeId, ...varPath]);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onChange) {
      onChange([]);
    }
  };

  const renderVariables = (
    nodeId: string,
    variables: NodeVariable[],
    path: string[] = [],
    depth: number = 0
  ) => {
    return variables.map((variable) => {
      const currentPath = [...path, variable.key];
      const isSelected = value && 
        value[0] === nodeId && 
        currentPath.join('.') === value.slice(1).join('.');
      
      const matchesFilter = !filterTypes || filterTypes.includes(variable.type);
      const matchesSearch = !search || 
        variable.key.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch && !variable.children?.length) return null;

      return (
        <div key={currentPath.join('.')} className="w-full">
          <button
            type="button"
            onClick={() => matchesFilter && handleSelect(nodeId, currentPath)}
            disabled={!matchesFilter}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent rounded-md transition-colors',
              isSelected && 'bg-accent',
              !matchesFilter && 'opacity-50 cursor-not-allowed',
              depth > 0 && 'ml-4'
            )}
          >
            <Variable className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 text-left truncate">{variable.key}</span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
              {variable.type}
            </Badge>
            {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
          {variable.children && renderVariables(nodeId, variable.children, currentPath, depth + 1)}
        </div>
      );
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selectedDisplay && 'text-muted-foreground',
            className
          )}
        >
          {selectedDisplay ? (
            <span className="flex items-center gap-1.5 truncate">
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 shrink-0">
                {selectedDisplay.nodeName}
              </Badge>
              <span className="truncate">{selectedDisplay.varPath}</span>
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {selectedDisplay && (
              <X 
                className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-pointer" 
                onClick={handleClear}
              />
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="搜索变量..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <ScrollArea className="h-64">
          <div className="p-2 space-y-1">
            {isSimpleMode ? (
              // Simple mode - flat list of variables
              <>
                {(!variables || variables.length === 0) ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    没有可用的变量
                  </div>
                ) : (
                  variables
                    .filter(v => !search || getVariableName(v).toLowerCase().includes(search.toLowerCase()))
                    .map((variable) => (
                      <button
                        key={getVariableName(variable)}
                        type="button"
                        onClick={() => {
                          onSelect?.(variable);
                          setOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent rounded-md transition-colors"
                      >
                        <Variable className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 text-left truncate">{getVariableName(variable)}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {variable.type}
                        </Badge>
                      </button>
                    ))
                )}
              </>
            ) : (
              // Full mode - node-based tree
              <>
                {upstreamNodes.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    没有可用的上游节点
                  </div>
                ) : (
                  upstreamNodes.map((node) => {
                    const nodeConfig = nodeRegistry[node.type];
                    const Icon = nodeConfig?.icon;
                    const isExpanded = expandedNodes.has(node.id);
                    const nodeVariables = getNodeOutputVariables(node);

                    return (
                      <div key={node.id} className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => toggleNodeExpand(node.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          {Icon && (
                            <Icon 
                              className="h-4 w-4" 
                              style={{ color: nodeConfig.color }} 
                            />
                          )}
                          <span className="truncate">{node.title}</span>
                          <Badge variant="outline" className="ml-auto text-[10px]">
                            {nodeVariables.length}
                          </Badge>
                        </button>
                        {isExpanded && nodeVariables.length > 0 && (
                          <div className="ml-4 pl-2 border-l">
                            {renderVariables(node.id, nodeVariables)}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
