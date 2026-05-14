'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Plus, Trash2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ConfigPanelWrapper } from '../../config-panel-wrapper';
import { VariableSelector } from '../../common/variable-selector';
import type { WorkflowNode } from '../../../types';

// Accent color for Knowledge node
const ACCENT_COLOR = '#06B6D4';

// Retrieval modes
const RETRIEVAL_MODES = [
  { value: 'single', label: '单一' },
  { value: 'multiple', label: '多路' },
  { value: 'hybrid', label: '混合' },
] as const;

// Reranker models
const RERANKER_MODELS = [
  { value: 'cohere-rerank-v3', label: 'Cohere Rerank v3' },
  { value: 'bge-reranker-large', label: 'BGE Reranker Large' },
  { value: 'jina-reranker-v2', label: 'Jina Reranker v2' },
] as const;

// Mock knowledge bases
const MOCK_KNOWLEDGE_BASES = [
  { id: 'kb1', name: '产品文档库', docCount: 128 },
  { id: 'kb2', name: '技术支持FAQ', docCount: 256 },
  { id: 'kb3', name: '用户手册', docCount: 64 },
  { id: 'kb4', name: '开发者文档', docCount: 512 },
];

// Comparison operators for metadata filter
const FILTER_OPERATORS = [
  { value: 'eq', label: '等于' },
  { value: 'ne', label: '不等于' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'contains', label: '包含' },
  { value: 'not_contains', label: '不包含' },
] as const;

interface MetadataFilter {
  id: string;
  field: string;
  operator: string;
  value: string;
}

// Local interface for Knowledge config
interface KnowledgeConfigData {
  query_variable?: string;
  attachment_variable?: string;
  knowledge_bases?: string[];
  retrieval_mode?: 'single' | 'multiple' | 'hybrid';
  reranker_model?: string;
  top_k?: number;
  filter_logic?: 'AND' | 'OR';
  metadata_filters?: Array<{ field: string; operator: string; value: string }>;
}

interface KnowledgeConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<KnowledgeConfigData>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
}

interface OutputVariable {
  name: string;
  type: string;
  description: string;
}

export function KnowledgeConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
}: KnowledgeConfigPanelV2Props) {
  const config = (node.data as unknown as KnowledgeConfigData) || {};

  // Local state
  const [queryVariable, setQueryVariable] = useState(config.query_variable || '');
  const [attachmentVariable, setAttachmentVariable] = useState(config.attachment_variable || '');
  const [selectedKBs, setSelectedKBs] = useState<string[]>(config.knowledge_bases || []);
  const [retrievalMode, setRetrievalMode] = useState(config.retrieval_mode || 'single');
  const [rerankerModel, setRerankerModel] = useState(config.reranker_model || '');
  const [topK, setTopK] = useState(config.top_k || 5);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>(config.filter_logic || 'AND');
  const [filters, setFilters] = useState<MetadataFilter[]>(
    config.metadata_filters?.map((f: { field: string; operator: string; value: string }, i: number) => ({ id: `f_${i}`, ...f })) || []
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Output variables (read-only)
  const outputVariables: OutputVariable[] = [
    { name: 'result', type: 'array[object]', description: '检索结果列表' },
    { name: 'result_str', type: 'string', description: '拼接后的文本' },
  ];

  const toggleKB = (kbId: string) => {
    setSelectedKBs(prev =>
      prev.includes(kbId) ? prev.filter(id => id !== kbId) : [...prev, kbId]
    );
  };

  const addFilter = () => {
    setFilters([...filters, { id: `f_${Date.now()}`, field: '', operator: 'eq', value: '' }]);
  };

  const updateFilter = (id: string, updates: Partial<MetadataFilter>) => {
    setFilters(filters.map(f => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const handleSave = () => {
    onUpdate({
      query_variable: queryVariable,
      attachment_variable: attachmentVariable,
      knowledge_bases: selectedKBs,
      retrieval_mode: retrievalMode as 'single' | 'multiple' | 'hybrid',
      reranker_model: rerankerModel,
      top_k: topK,
      filter_logic: filterLogic,
      metadata_filters: filters.map(({ id, ...rest }) => rest),
    });
    onSave?.();
  };

  // Tabs configuration
  const tabs = [
    {
      id: 'params',
      label: '参数配置',
      content: (
        <div className="space-y-6 p-4">
          {/* Query Variable */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">查询变量</Label>
            <VariableSelector
              availableNodes={allNodes}
              currentNodeId={node.id}
              value={queryVariable ? [queryVariable] : undefined}
              onChange={(val) => setQueryVariable(val?.[0] || '')}
            />
          </div>

          {/* Attachment Variable (optional) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              查询附件变量
              <span className="text-muted-foreground ml-1">(可选)</span>
            </Label>
            <VariableSelector
              availableNodes={allNodes}
              currentNodeId={node.id}
              value={attachmentVariable ? [attachmentVariable] : undefined}
              onChange={(val) => setAttachmentVariable(val?.[0] || '')}
              placeholder="选择文件变量（可选）"
            />
          </div>

          {/* Knowledge Bases */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">知识库（多选）</Label>
            <div className="space-y-2">
              {MOCK_KNOWLEDGE_BASES.map(kb => (
                <div
                  key={kb.id}
                  onClick={() => toggleKB(kb.id)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    selectedKBs.includes(kb.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  <Checkbox checked={selectedKBs.includes(kb.id)} />
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm">{kb.name}</span>
                  <span className="text-xs text-muted-foreground">{kb.docCount} 文档</span>
                </div>
              ))}
            </div>
          </div>

          {/* Retrieval Mode */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">检索模式</Label>
            <div className="flex rounded-lg border p-1">
              {RETRIEVAL_MODES.map(mode => (
                <button
                  key={mode.value}
                  onClick={() => setRetrievalMode(mode.value)}
                  className={cn(
                    'flex-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                    retrievalMode === mode.value
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            
            {/* Reranker (for multiple/hybrid mode) */}
            {(retrievalMode === 'multiple' || retrievalMode === 'hybrid') && (
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground">Reranker 模型</Label>
                <Select value={rerankerModel} onValueChange={setRerankerModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择 Reranker 模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {RERANKER_MODELS.map(model => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Metadata Filters (collapsible) */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span>元数据过滤</span>
                {filtersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Logic toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">条件逻辑：</span>
                <div className="flex rounded-md border p-0.5">
                  <button
                    onClick={() => setFilterLogic('AND')}
                    className={cn(
                      'px-2 py-0.5 text-xs rounded',
                      filterLogic === 'AND' ? 'bg-primary text-primary-foreground' : ''
                    )}
                  >
                    AND
                  </button>
                  <button
                    onClick={() => setFilterLogic('OR')}
                    className={cn(
                      'px-2 py-0.5 text-xs rounded',
                      filterLogic === 'OR' ? 'bg-primary text-primary-foreground' : ''
                    )}
                  >
                    OR
                  </button>
                </div>
              </div>

              {/* Filter rows */}
              {filters.map(filter => (
                <div key={filter.id} className="flex items-center gap-2">
                  <Input
                    value={filter.field}
                    onChange={e => updateFilter(filter.id, { field: e.target.value })}
                    placeholder="字段名"
                    className="w-24"
                  />
                  <Select
                    value={filter.operator}
                    onValueChange={v => updateFilter(filter.id, { operator: v })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OPERATORS.map(op => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={filter.value}
                    onChange={e => updateFilter(filter.id, { value: e.target.value })}
                    placeholder="值"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeFilter(filter.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button variant="ghost" size="sm" onClick={addFilter} className="w-full">
                <Plus className="h-4 w-4 mr-1" />
                添加条件
              </Button>
            </CollapsibleContent>
          </Collapsible>

          {/* Top-K */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Top-K</Label>
            <Input
              type="number"
              value={topK}
              onChange={e => setTopK(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
              min={1}
              max={20}
            />
            <p className="text-xs text-muted-foreground">返回最相关的 K 个结果（1-20）</p>
          </div>
        </div>
      ),
    },
    {
      id: 'output',
      label: '输出变量',
      content: (
        <div className="space-y-3 p-4">
          {outputVariables.map(v => (
            <div
              key={v.name}
              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-primary">{v.name}</code>
                <Badge variant="outline" className="text-xs">
                  {v.type}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">{v.description}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <ConfigPanelWrapper
      title="知识检索"
      typeBadge="Knowledge"
      icon={<BookOpen className="h-4 w-4" />}
      accentColor={ACCENT_COLOR}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      onReset={onReset}
      tabs={tabs}
      defaultTab="params"
    />
  );
}
