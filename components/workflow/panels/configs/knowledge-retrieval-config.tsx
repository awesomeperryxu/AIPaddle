'use client';

import { useEffect, useState } from 'react';
import { Plus, ChevronDown, Database, Filter, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { VariableSelector } from '../common/variable-selector';
import { RetrievalMode, VarType } from '../../types';
import type { WorkflowNode, KnowledgeRetrievalConfig, ValueSelector } from '../../types';

interface KnowledgeRetrievalConfigPanelProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<KnowledgeRetrievalConfig>) => void;
  appType?: 'workflow' | 'chatflow';
}

interface KnowledgeBaseOption {
  id: string;
  name: string;
  documentCount: number;
}

// Reranking models
const rerankingModels = [
  { provider: 'cohere', model: 'rerank-english-v3.0', name: 'Cohere Rerank (English)' },
  { provider: 'cohere', model: 'rerank-multilingual-v3.0', name: 'Cohere Rerank (Multilingual)' },
  { provider: 'jina', model: 'jina-reranker-v2', name: 'Jina Reranker v2' },
];

export function KnowledgeRetrievalConfigPanel({
  node,
  allNodes,
  onUpdate,
  appType = 'workflow',
}: KnowledgeRetrievalConfigPanelProps) {
  const config = node.data as KnowledgeRetrievalConfig;
  const queryVariable = config.query_variable || [];
  const datasetIds = config.dataset_ids || [];
  const retrievalMode = config.retrieval_mode || RetrievalMode.Multiple;
  const multipleConfig = config.multiple_retrieval_config || {
    top_k: 3,
    score_threshold: 0.5,
  };
  const metadataFiltering = config.metadata_filtering;

  const [showReranking, setShowReranking] = useState(!!multipleConfig.reranking_model);
  const [showFiltering, setShowFiltering] = useState(!!metadataFiltering);

  // 真实知识库列表（ADR-008：客户端只经 apiFetch）
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseOption[]>([]);
  const [kbLoading, setKbLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ knowledgeBases: KnowledgeBaseOption[] }>('/api/knowledge-bases')
      .then(res => { if (!cancelled) setKnowledgeBases(res.knowledgeBases ?? []); })
      .catch(() => { if (!cancelled) setKnowledgeBases([]); })
      .finally(() => { if (!cancelled) setKbLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const updateQueryVariable = (selector: ValueSelector) => {
    onUpdate({ query_variable: selector });
  };

  const toggleDataset = (datasetId: string) => {
    const newIds = datasetIds.includes(datasetId)
      ? datasetIds.filter(id => id !== datasetId)
      : [...datasetIds, datasetId];
    onUpdate({ dataset_ids: newIds });
  };

  const updateTopK = (value: number) => {
    onUpdate({
      multiple_retrieval_config: {
        ...multipleConfig,
        top_k: value,
      },
    });
  };

  const updateScoreThreshold = (value: number) => {
    onUpdate({
      multiple_retrieval_config: {
        ...multipleConfig,
        score_threshold: value,
      },
    });
  };

  const toggleReranking = (enabled: boolean) => {
    setShowReranking(enabled);
    if (enabled) {
      onUpdate({
        multiple_retrieval_config: {
          ...multipleConfig,
          reranking_model: rerankingModels[0],
        },
      });
    } else {
      const { reranking_model, ...rest } = multipleConfig;
      onUpdate({ multiple_retrieval_config: rest });
    }
  };

  const updateRerankingModel = (modelId: string) => {
    const model = rerankingModels.find(m => `${m.provider}/${m.model}` === modelId);
    if (model) {
      onUpdate({
        multiple_retrieval_config: {
          ...multipleConfig,
          reranking_model: { provider: model.provider, model: model.model },
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Query Variable */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">查询变量</Label>
        <VariableSelector
          value={queryVariable}
          onChange={updateQueryVariable}
          availableNodes={allNodes}
          currentNodeId={node.id}
          placeholder="选择查询文本变量"
          filterTypes={['string'] as VarType[]}
        />
        <p className="text-xs text-muted-foreground">
          用于检索的查询文本，通常是用户的问题
        </p>
      </div>

      <Separator />

      {/* Knowledge Bases Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">知识库</Label>
          <Badge variant="secondary" className="text-[10px]">
            已选 {datasetIds.length}
          </Badge>
        </div>

        <div className="space-y-2">
          {kbLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载知识库…
            </div>
          ) : knowledgeBases.length === 0 ? (
            <div className="p-3 rounded-lg border border-dashed text-center text-xs text-muted-foreground">
              暂无知识库，请先在知识库模块创建
            </div>
          ) : (
            knowledgeBases.map((kb) => {
              const isSelected = datasetIds.includes(kb.id);

              return (
                <div
                  key={kb.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer',
                    isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  )}
                  onClick={() => toggleDataset(kb.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleDataset(kb.id)}
                  />
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{kb.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {kb.documentCount} 个文档
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!kbLoading && knowledgeBases.length > 0 && datasetIds.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            请至少选择一个知识库
          </p>
        )}
      </div>

      <Separator />

      {/* Retrieval Settings */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">检索设置</Label>

        {/* Retrieval Mode */}
        <div className="space-y-2">
          <Label className="text-xs">检索模式</Label>
          <Select
            value={retrievalMode}
            onValueChange={(mode: RetrievalMode) => onUpdate({ retrieval_mode: mode })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={RetrievalMode.Multiple}>
                多路召回
              </SelectItem>
              <SelectItem value={RetrievalMode.Single}>
                单一召回
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {retrievalMode === RetrievalMode.Multiple && (
          <>
            {/* Top K */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Top K</Label>
                <span className="text-xs text-muted-foreground">{multipleConfig.top_k}</span>
              </div>
              <Slider
                value={[multipleConfig.top_k]}
                onValueChange={([val]) => updateTopK(val)}
                min={1}
                max={20}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                返回相关性最高的 K 个结果
              </p>
            </div>

            {/* Score Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">分数阈值</Label>
                <span className="text-xs text-muted-foreground">
                  {(multipleConfig.score_threshold || 0).toFixed(2)}
                </span>
              </div>
              <Slider
                value={[multipleConfig.score_threshold || 0]}
                onValueChange={([val]) => updateScoreThreshold(val)}
                min={0}
                max={1}
                step={0.05}
              />
              <p className="text-xs text-muted-foreground">
                只返回相似度高于阈值的结果
              </p>
            </div>

            {/* Reranking */}
            <Collapsible open={showReranking} onOpenChange={toggleReranking}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Switch checked={showReranking} />
                    <div>
                      <Label className="text-xs cursor-pointer">重排序</Label>
                      <p className="text-xs text-muted-foreground">
                        使用 Reranking 模型优化结果排序
                      </p>
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <Select
                  value={
                    multipleConfig.reranking_model
                      ? `${multipleConfig.reranking_model.provider}/${multipleConfig.reranking_model.model}`
                      : ''
                  }
                  onValueChange={updateRerankingModel}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="选择重排序模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {rerankingModels.map((model) => (
                      <SelectItem
                        key={`${model.provider}/${model.model}`}
                        value={`${model.provider}/${model.model}`}
                      >
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>

      <Separator />

      {/* Metadata Filtering */}
      <Collapsible open={showFiltering} onOpenChange={setShowFiltering}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between px-0">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">元数据过滤</span>
            </div>
            <ChevronDown className={cn(
              'h-4 w-4 transition-transform',
              showFiltering && 'rotate-180'
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="p-3 rounded-lg border border-dashed text-center">
            <Filter className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              添加元数据过滤条件以缩小检索范围
            </p>
            <Button variant="outline" size="sm" className="mt-2">
              <Plus className="h-3.5 w-3.5 mr-1" />
              添加过滤条件
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Output Info */}
      <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
        <p className="font-medium">输出变量</p>
        <div className="flex items-center gap-2">
          <code className="font-mono bg-muted px-1 rounded">result</code>
          <Badge variant="outline" className="text-[10px]">Array[Object]</Badge>
        </div>
        <p>每个结果包含：content, score, metadata, document_id</p>
      </div>
    </div>
  );
}
