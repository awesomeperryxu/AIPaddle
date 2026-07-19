'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, RefreshCw, ChevronDown, ChevronRight, Variable } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Variable type
interface InspectedVariable {
  id: string;
  name: string;
  sourceNode: string;
  sourceNodeId: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  value: unknown;
}

interface VariableInspectPanelProps {
  isOpen: boolean;
  onClose: () => void;
  variables?: InspectedVariable[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

// Type badge colors
const TYPE_COLORS: Record<string, string> = {
  string: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  number: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  boolean: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  object: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  array: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

// Format value for display
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > 60 ? str.slice(0, 60) + '...' : str;
  }
  return String(value);
}

// Variable row component
function VariableRow({ variable }: { variable: InspectedVariable }) {
  const [expanded, setExpanded] = useState(false);
  const isExpandable = variable.type === 'object' || variable.type === 'array';

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => isExpandable && setExpanded(!expanded)}
        className={cn(
          'w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors',
          isExpandable && 'cursor-pointer'
        )}
      >
        {/* Expand icon */}
        <div className="w-4 h-4 flex items-center justify-center">
          {isExpandable && (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          )}
        </div>

        {/* Variable name */}
        <span className="font-mono text-sm text-foreground min-w-[120px]">
          {variable.name}
        </span>

        {/* Source node */}
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {variable.sourceNode}
        </Badge>

        {/* Type */}
        <Badge className={cn('text-[10px] px-1.5 py-0', TYPE_COLORS[variable.type])}>
          {variable.type}
        </Badge>

        {/* Value (truncated) */}
        <span className="flex-1 font-mono text-xs text-muted-foreground truncate">
          {formatValue(variable.value)}
        </span>
      </button>

      {/* Expanded JSON view */}
      {expanded && isExpandable && (
        <div className="px-4 py-3 bg-muted/30 border-t border-border">
          <pre className="font-mono text-xs text-foreground overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(variable.value, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function VariableInspectPanel({
  isOpen,
  onClose,
  variables = [],
  onRefresh,
  isLoading = false,
}: VariableInspectPanelProps) {
  const [height, setHeight] = useState(240);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Handle drag to resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [height]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.min(480, Math.max(120, startHeight.current + delta));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-16 left-4 right-4 z-40 bg-background border-t shadow-lg rounded-t-lg overflow-hidden"
      style={{ height }}
    >
      {/* Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-3 flex items-center justify-center cursor-ns-resize hover:bg-muted/50 transition-colors"
      >
        <div className="w-8 h-1 rounded-full bg-border" />
      </div>

      {/* Header */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Variable className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">变量检查</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto" style={{ height: height - 52 }}>
        {variables.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Variable className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">运行工作流后可在此查看变量值</p>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="px-4 py-2 flex items-center gap-3 bg-muted/30 border-b border-border text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <div className="w-4" />
              <div className="min-w-[120px]">变量名</div>
              <div className="w-20">来源节点</div>
              <div className="w-16">类型</div>
              <div className="flex-1">当前值</div>
            </div>
            {/* Variable rows */}
            {variables.map((variable) => (
              <VariableRow key={variable.id} variable={variable} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Demo component with sample data
export function VariableInspectPanelDemo() {
  const [isOpen, setIsOpen] = useState(true);

  const sampleVariables: InspectedVariable[] = [
    {
      id: '1',
      name: 'user_input',
      sourceNode: 'Start',
      sourceNodeId: 'start-1',
      type: 'string',
      value: '你好，请帮我分析一下这个问题',
    },
    {
      id: '2',
      name: 'llm_response',
      sourceNode: 'LLM-1',
      sourceNodeId: 'llm-1',
      type: 'string',
      value: '好的，我来帮您分析这个问题。首先...',
    },
    {
      id: '3',
      name: 'extracted_params',
      sourceNode: 'Extractor',
      sourceNodeId: 'extractor-1',
      type: 'object',
      value: {
        topic: '数据分析',
        urgency: 'high',
        keywords: ['分析', '问题', '数据'],
      },
    },
    {
      id: '4',
      name: 'search_results',
      sourceNode: 'Knowledge',
      sourceNodeId: 'knowledge-1',
      type: 'array',
      value: [
        { title: '数据分析入门', score: 0.95 },
        { title: '问题解决方法论', score: 0.87 },
      ],
    },
    {
      id: '5',
      name: 'is_valid',
      sourceNode: 'IfElse',
      sourceNodeId: 'ifelse-1',
      type: 'boolean',
      value: true,
    },
    {
      id: '6',
      name: 'token_count',
      sourceNode: 'LLM-1',
      sourceNodeId: 'llm-1',
      type: 'number',
      value: 1250,
    },
  ];

  return (
    <div className="relative h-[400px] bg-muted/30 rounded-lg border">
      <div className="absolute top-4 left-4">
        <Button onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? 'Hide Panel' : 'Show Panel'}
        </Button>
      </div>
      <VariableInspectPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        variables={sampleVariables}
        onRefresh={() => console.log('Refresh')}
      />
    </div>
  );
}
