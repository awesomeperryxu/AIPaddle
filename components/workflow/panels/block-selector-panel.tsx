'use client';

import { useState, useMemo } from 'react';
import {
  Play,
  Square,
  MessageSquare,
  Bot,
  Code,
  GitBranch,
  Repeat,
  RefreshCw,
  Globe,
  Wrench,
  Database,
  FileText,
  HelpCircle,
  Sliders,
  ArrowLeftRight,
  List,
  FileSearch,
  Layers,
  UserCheck,
  Webhook,
  Clock,
  Plug,
  StickyNote,
  Search,
  X,
  ChevronRight,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ===== Types =====
type AppType = 'workflow' | 'chatflow';

interface BlockDefinition {
  type: string;
  label: string;
  labelEn: string;
  icon: LucideIcon;
  color: string;
  description: string;
  category: string;
  availableIn: AppType[];
}

interface BlockCategory {
  id: string;
  label: string;
  labelEn: string;
  icon: LucideIcon;
}

interface BlockSelectorPanelProps {
  appType: AppType;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (blockType: string) => void;
  recentBlocks?: string[];
}

// ===== Block Categories =====
const CATEGORIES: BlockCategory[] = [
  { id: 'basic', label: '基础', labelEn: 'Basic', icon: Play },
  { id: 'llm', label: 'LLM & AI', labelEn: 'LLM & AI', icon: Sparkles },
  { id: 'data', label: '数据处理', labelEn: 'Data', icon: FileText },
  { id: 'logic', label: '逻辑控制', labelEn: 'Logic', icon: GitBranch },
  { id: 'integration', label: '集成', labelEn: 'Integration', icon: Plug },
  { id: 'trigger', label: '触发器', labelEn: 'Triggers', icon: Webhook },
  { id: 'other', label: '其他', labelEn: 'Other', icon: StickyNote },
];

// ===== Block Definitions =====
const BLOCKS: BlockDefinition[] = [
  // Basic
  { type: 'start', label: '开始', labelEn: 'Start', icon: Play, color: '#22C55E', description: '工作流入口点', category: 'basic', availableIn: ['workflow', 'chatflow'] },
  { type: 'end', label: '结束', labelEn: 'End', icon: Square, color: '#6B7280', description: '工作流结束并输出', category: 'basic', availableIn: ['workflow', 'chatflow'] },
  { type: 'answer', label: '回复', labelEn: 'Answer', icon: MessageSquare, color: '#2970FF', description: '直接输出到对话', category: 'basic', availableIn: ['chatflow'] },

  // LLM & AI
  { type: 'llm', label: 'LLM', labelEn: 'LLM', icon: Sparkles, color: '#7C3AED', description: '调用大语言模型', category: 'llm', availableIn: ['workflow', 'chatflow'] },
  { type: 'agent', label: 'Agent', labelEn: 'Agent', icon: Bot, color: '#6366F1', description: '自主决策与工具调用', category: 'llm', availableIn: ['workflow', 'chatflow'] },
  { type: 'question-classifier', label: '问题分类', labelEn: 'Question Classifier', icon: HelpCircle, color: '#F59E0B', description: 'LLM 驱动的意图分类', category: 'llm', availableIn: ['workflow', 'chatflow'] },
  { type: 'parameter-extractor', label: '参数提取', labelEn: 'Parameter Extractor', icon: Sliders, color: '#F59E0B', description: 'LLM 驱动的实体提取', category: 'llm', availableIn: ['workflow', 'chatflow'] },

  // Data Processing
  { type: 'code', label: '代码', labelEn: 'Code', icon: Code, color: '#F59E0B', description: 'Python / JavaScript 代码执行', category: 'data', availableIn: ['workflow', 'chatflow'] },
  { type: 'template-transform', label: '模板转换', labelEn: 'Template', icon: FileText, color: '#F59E0B', description: 'Jinja2 模板处理', category: 'data', availableIn: ['workflow', 'chatflow'] },
  { type: 'variable-assigner', label: '变量赋值', labelEn: 'Variable Assigner', icon: ArrowLeftRight, color: '#64748B', description: '赋值到会话变量', category: 'data', availableIn: ['workflow', 'chatflow'] },
  { type: 'variable-aggregator', label: '变量聚合', labelEn: 'Variable Aggregator', icon: Layers, color: '#06B6D4', description: '合并多个变量', category: 'data', availableIn: ['workflow', 'chatflow'] },
  { type: 'list-operator', label: '列表操作', labelEn: 'List Operator', icon: List, color: '#06B6D4', description: '数组操作处理', category: 'data', availableIn: ['workflow', 'chatflow'] },
  { type: 'document-extractor', label: '文档提取', labelEn: 'Document Extractor', icon: FileSearch, color: '#06B6D4', description: '提取文档内容', category: 'data', availableIn: ['workflow', 'chatflow'] },

  // Logic Control
  { type: 'if-else', label: '条件分支', labelEn: 'If-Else', icon: GitBranch, color: '#3B82F6', description: '条件判断分支', category: 'logic', availableIn: ['workflow', 'chatflow'] },
  { type: 'iteration', label: '迭代', labelEn: 'Iteration', icon: Repeat, color: '#3B82F6', description: '数组遍历处理', category: 'logic', availableIn: ['workflow', 'chatflow'] },
  { type: 'loop', label: '循环', labelEn: 'Loop', icon: RefreshCw, color: '#8B5CF6', description: '条件循环执行', category: 'logic', availableIn: ['workflow', 'chatflow'] },

  // Integration
  { type: 'http-request', label: 'HTTP 请求', labelEn: 'HTTP Request', icon: Globe, color: '#EF4444', description: '调用外部 API', category: 'integration', availableIn: ['workflow', 'chatflow'] },
  { type: 'tool', label: '工具', labelEn: 'Tool', icon: Wrench, color: '#8B5CF6', description: '调用自定义工具', category: 'integration', availableIn: ['workflow', 'chatflow'] },
  { type: 'knowledge-retrieval', label: '知识库检索', labelEn: 'Knowledge Retrieval', icon: Database, color: '#06B6D4', description: '检索知识库内容', category: 'integration', availableIn: ['workflow', 'chatflow'] },
  { type: 'human-input', label: '人工输入', labelEn: 'Human Input', icon: UserCheck, color: '#2970FF', description: '等待人工介入', category: 'integration', availableIn: ['workflow', 'chatflow'] },

  // Triggers
  { type: 'trigger-webhook', label: 'Webhook', labelEn: 'Webhook', icon: Webhook, color: '#F97316', description: 'HTTP 触发', category: 'trigger', availableIn: ['workflow'] },
  { type: 'trigger-schedule', label: '定时触发', labelEn: 'Schedule', icon: Clock, color: '#F97316', description: '定时执行', category: 'trigger', availableIn: ['workflow'] },
  { type: 'trigger-plugin', label: '插件触发', labelEn: 'Plugin', icon: Plug, color: '#F97316', description: '第三方集成触发', category: 'trigger', availableIn: ['workflow'] },

  // Other
  { type: 'note', label: '便签', labelEn: 'Note', icon: StickyNote, color: '#FBBF24', description: '添加注释说明', category: 'other', availableIn: ['workflow', 'chatflow'] },
];

// ===== Main Component =====
export function BlockSelectorPanel({
  appType,
  isOpen,
  onClose,
  onSelect,
  recentBlocks = [],
}: BlockSelectorPanelProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter blocks based on app type and search
  const filteredBlocks = useMemo(() => {
    let blocks = BLOCKS.filter((b) => b.availableIn.includes(appType));

    if (search) {
      const searchLower = search.toLowerCase();
      blocks = blocks.filter(
        (b) =>
          b.label.toLowerCase().includes(searchLower) ||
          b.labelEn.toLowerCase().includes(searchLower) ||
          b.description.toLowerCase().includes(searchLower)
      );
    }

    if (selectedCategory) {
      blocks = blocks.filter((b) => b.category === selectedCategory);
    }

    return blocks;
  }, [appType, search, selectedCategory]);

  // Group blocks by category
  const blocksByCategory = useMemo(() => {
    const groups: Record<string, BlockDefinition[]> = {};
    filteredBlocks.forEach((block) => {
      if (!groups[block.category]) {
        groups[block.category] = [];
      }
      groups[block.category].push(block);
    });
    return groups;
  }, [filteredBlocks]);

  // Get recent blocks
  const recentBlockDefs = useMemo(() => {
    return recentBlocks
      .map((type) => BLOCKS.find((b) => b.type === type))
      .filter((b): b is BlockDefinition => b !== undefined && b.availableIn.includes(appType))
      .slice(0, 5);
  }, [recentBlocks, appType]);

  const handleSelect = (blockType: string) => {
    onSelect(blockType);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 left-0 w-[320px] bg-background border-r shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <h2 className="font-semibold">添加节点</h2>
          <Badge variant="outline" className="text-xs">
            {appType === 'chatflow' ? 'Chatflow' : 'Workflow'}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索节点..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 py-2 border-b overflow-x-auto">
        <div className="flex gap-1">
          <Button
            variant={selectedCategory === null ? 'secondary' : 'ghost'}
            size="sm"
            className="text-xs shrink-0"
            onClick={() => setSelectedCategory(null)}
          >
            全部
          </Button>
          {CATEGORIES.map((cat) => {
            const count = BLOCKS.filter(
              (b) => b.category === cat.id && b.availableIn.includes(appType)
            ).length;
            if (count === 0) return null;
            return (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'secondary' : 'ghost'}
                size="sm"
                className="text-xs shrink-0"
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.label}
                <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 h-4">
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Block List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Recent Blocks */}
        {!search && !selectedCategory && recentBlockDefs.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              最近使用
            </h3>
            <div className="space-y-1">
              {recentBlockDefs.map((block) => (
                <BlockItem
                  key={block.type}
                  block={block}
                  onSelect={() => handleSelect(block.type)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Blocks by Category */}
        {search || selectedCategory ? (
          filteredBlocks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">没有匹配的节点</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredBlocks.map((block) => (
                <BlockItem
                  key={block.type}
                  block={block}
                  onSelect={() => handleSelect(block.type)}
                />
              ))}
            </div>
          )
        ) : (
          CATEGORIES.map((category) => {
            const blocks = blocksByCategory[category.id];
            if (!blocks || blocks.length === 0) return null;
            return (
              <div key={category.id}>
                <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1">
                  <category.icon className="h-3 w-3" />
                  {category.label}
                </h3>
                <div className="space-y-1">
                  {blocks.map((block) => (
                    <BlockItem
                      key={block.type}
                      block={block}
                      onSelect={() => handleSelect(block.type)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Hint */}
      <div className="px-4 py-3 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          拖拽节点到画布或点击添加
        </p>
      </div>
    </div>
  );
}

// ===== Block Item Component =====
interface BlockItemProps {
  block: BlockDefinition;
  onSelect: () => void;
}

function BlockItem({ block, onSelect }: BlockItemProps) {
  const Icon = block.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 p-2.5 rounded-lg border bg-card',
        'hover:bg-accent/50 hover:shadow-sm transition-all',
        'cursor-grab active:cursor-grabbing'
      )}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/workflow-block', block.type);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      {/* Icon */}
      <div
        className="p-2 rounded-md shrink-0"
        style={{ backgroundColor: `${block.color}15` }}
      >
        <Icon className="h-4 w-4" style={{ color: block.color }} />
      </div>

      {/* Label & Description */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{block.label}</span>
          {block.availableIn.length === 1 && (
            <Badge
              variant="outline"
              className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
            >
              {block.availableIn[0] === 'chatflow' ? 'Chatflow' : 'Workflow'}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {block.description}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

// ===== Demo Component =====
export function BlockSelectorPanelDemo() {
  const [isOpen, setIsOpen] = useState(true);
  const [appType, setAppType] = useState<AppType>('workflow');

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-8 ml-[320px]">
        <h1 className="text-2xl font-bold mb-4">节点选择器 Demo</h1>
        <div className="flex gap-4 mb-4">
          <Button
            variant={appType === 'workflow' ? 'default' : 'outline'}
            onClick={() => setAppType('workflow')}
          >
            Workflow
          </Button>
          <Button
            variant={appType === 'chatflow' ? 'default' : 'outline'}
            onClick={() => setAppType('chatflow')}
          >
            Chatflow
          </Button>
        </div>
        <Button onClick={() => setIsOpen(true)}>打开选择器</Button>
      </div>
      <BlockSelectorPanel
        appType={appType}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={(type) => {
          console.log('Selected block:', type);
        }}
        recentBlocks={['llm', 'code', 'if-else', 'http-request']}
      />
    </div>
  );
}
