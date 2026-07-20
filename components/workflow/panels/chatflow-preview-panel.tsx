'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
  MessageSquare,
  Variable,
  History,
  RefreshCw,
  X,
  Send,
  Loader2,
  AlertTriangle,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Types
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  isStreaming?: boolean;
  timestamp: Date;
}

interface ConversationVariable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  value: string | number | boolean | object;
  description?: string;
}

interface ConversationRecord {
  id: string;
  preview: string;
  timestamp: Date;
  messageCount: number;
  branchCount: number;
  currentBranch: number;
}

interface ChatflowPreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

// Tab definitions
const TABS = [
  { id: 'chat', label: '对话', icon: MessageSquare },
  { id: 'variables', label: '对话变量', icon: Variable },
  { id: 'history', label: '对话记录', icon: History },
] as const;

type TabId = typeof TABS[number]['id'];

// Demo data
const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: '你好，请介绍一下你的功能',
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: '2',
    role: 'assistant',
    content: '您好！我是基于工作流构建的 AI 助手，可以帮您处理各种任务，包括：\n\n1. 文档处理与分析\n2. 数据查询与汇总\n3. 智能问答与对话\n4. 工作流自动化\n\n请问有什么我可以帮您的吗？',
    timestamp: new Date(Date.now() - 55000),
  },
  {
    id: '3',
    role: 'user',
    content: '如何配置 LLM 节点？',
    timestamp: new Date(Date.now() - 30000),
  },
  {
    id: '4',
    role: 'assistant',
    content: 'LLM 节点支持配置多种参数，包括模型选择、Temperature、最大输出长度等',
    isStreaming: true,
    timestamp: new Date(),
  },
];

const DEMO_VARIABLES: ConversationVariable[] = [
  { id: 'v1', name: 'user_name', type: 'string', value: '张三', description: '当前用户名称' },
  { id: 'v2', name: 'dialog_count', type: 'number', value: 3, description: '对话轮次计数' },
  { id: 'v3', name: 'is_vip', type: 'boolean', value: false, description: 'VIP 用户标识' },
];

const DEMO_RECORDS: ConversationRecord[] = [
  {
    id: 'r1',
    preview: '你好，请介绍一下你的功能',
    timestamp: new Date(Date.now() - 3600000),
    messageCount: 4,
    branchCount: 1,
    currentBranch: 1,
  },
  {
    id: 'r2',
    preview: '帮我分析这份销售数据...',
    timestamp: new Date(Date.now() - 86400000),
    messageCount: 8,
    branchCount: 2,
    currentBranch: 1,
  },
  {
    id: 'r3',
    preview: '如何使用知识库检索功能？',
    timestamp: new Date(Date.now() - 172800000),
    messageCount: 6,
    branchCount: 1,
    currentBranch: 1,
  },
];

export function ChatflowPreviewPanel({
  isOpen,
  onClose,
  onRefresh,
}: ChatflowPreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_MESSAGES);
  const [variables, setVariables] = useState<ConversationVariable[]>(DEMO_VARIABLES);
  const [records, setRecords] = useState<ConversationRecord[]>(DEMO_RECORDS);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  const [newVariable, setNewVariable] = useState({
    name: '',
    type: 'string' as ConversationVariable['type'],
    description: '',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '36px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: '这是 AI 的回复，模拟了流式输出的效果。实际集成时，这里会连接到真实的 AI 服务。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAddVariable = () => {
    if (!newVariable.name.trim()) return;

    const variable: ConversationVariable = {
      id: `var_${Date.now()}`,
      name: newVariable.name.trim(),
      type: newVariable.type,
      value: newVariable.type === 'boolean' ? false : newVariable.type === 'number' ? 0 : '',
      description: newVariable.description || undefined,
    };

    setVariables((prev) => [...prev, variable]);
    setNewVariable({ name: '', type: 'string', description: '' });
    setIsAddingVariable(false);
  };

  const handleDeleteVariable = (id: string) => {
    setVariables((prev) => prev.filter((v) => v.id !== id));
  };

  const handleUpdateVariableValue = (id: string, value: string | number | boolean) => {
    setVariables((prev) =>
      prev.map((v) => (v.id === id ? { ...v, value } : v))
    );
  };

  const handleBranchChange = (recordId: string, direction: 'prev' | 'next') => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== recordId) return r;
        const newBranch =
          direction === 'prev'
            ? Math.max(1, r.currentBranch - 1)
            : Math.min(r.branchCount, r.currentBranch + 1);
        return { ...r, currentBranch: newBranch };
      })
    );
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    return `${days} 天前`;
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-4 top-14 bottom-4 w-[380px] bg-white dark:bg-gray-900 rounded-xl shadow-xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-medium text-sm">对话预览</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">发送消息开始测试对话</p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex gap-2',
                        message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                      )}
                    >
                      {/* Avatar */}
                      <div
                        className={cn(
                          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : message.role === 'error'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        )}
                      >
                        {message.role === 'user' ? 'U' : message.role === 'error' ? '!' : 'AI'}
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={cn(
                          'max-w-[75%] px-3 py-2 text-sm whitespace-pre-wrap',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                            : message.role === 'error'
                            ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 rounded-2xl rounded-tl-sm'
                            : 'bg-gray-100 dark:bg-gray-800 text-foreground rounded-2xl rounded-tl-sm'
                        )}
                      >
                        {message.role === 'error' && (
                          <AlertTriangle className="h-4 w-4 inline-block mr-1 mb-0.5" />
                        )}
                        {message.content}
                        {message.isStreaming && (
                          <span className="inline-block ml-0.5 animate-pulse">|</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                        AI
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                        <span
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        />
                        <span
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <span
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-3">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
                  className="min-h-[36px] max-h-[120px] resize-none text-sm"
                  rows={1}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Variables Tab */}
        {activeTab === 'variables' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Info Box */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                对话变量在整个会话中持久保存，可被工作流节点读取和修改。
              </p>
            </div>

            {/* Variable List */}
            <div className="space-y-3">
              {variables.map((variable) => (
                <div
                  key={variable.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-sm">
                        {variable.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {variable.type}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteVariable(variable.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Value Editor */}
                  {variable.type === 'boolean' ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={variable.value as boolean}
                        onCheckedChange={(checked) =>
                          handleUpdateVariableValue(variable.id, checked)
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {variable.value ? 'true' : 'false'}
                      </span>
                    </div>
                  ) : variable.type === 'object' || variable.type === 'array' ? (
                    <Textarea
                      value={
                        typeof variable.value === 'object'
                          ? JSON.stringify(variable.value, null, 2)
                          : String(variable.value)
                      }
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          handleUpdateVariableValue(variable.id, parsed);
                        } catch {
                          // Invalid JSON, keep as string for now
                        }
                      }}
                      className="font-mono text-xs min-h-[60px]"
                    />
                  ) : (
                    <Input
                      type={variable.type === 'number' ? 'number' : 'text'}
                      value={String(variable.value)}
                      onChange={(e) =>
                        handleUpdateVariableValue(
                          variable.id,
                          variable.type === 'number'
                            ? Number(e.target.value)
                            : e.target.value
                        )
                      }
                      className="h-6 text-xs"
                    />
                  )}

                  {/* Description */}
                  {variable.description && (
                    <p className="text-[10px] text-gray-400">{variable.description}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Add Variable */}
            {isAddingVariable ? (
              <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="变量名"
                    value={newVariable.name}
                    onChange={(e) =>
                      setNewVariable((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="h-8 text-xs flex-1"
                  />
                  <Select
                    value={newVariable.type}
                    onValueChange={(value: ConversationVariable['type']) =>
                      setNewVariable((prev) => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">string</SelectItem>
                      <SelectItem value="number">number</SelectItem>
                      <SelectItem value="boolean">boolean</SelectItem>
                      <SelectItem value="object">object</SelectItem>
                      <SelectItem value="array">array</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder="描述（可选）"
                  value={newVariable.description}
                  onChange={(e) =>
                    setNewVariable((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="h-8 text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleAddVariable}
                    disabled={!newVariable.name.trim()}
                  >
                    确认添加
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setIsAddingVariable(false);
                      setNewVariable({ name: '', type: 'string', description: '' });
                    }}
                  >
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-9 text-xs"
                onClick={() => setIsAddingVariable(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                添加对话变量
              </Button>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Info Text */}
            <p className="text-xs text-muted-foreground">
              点击记录可在对话 Tab 中加载该会话
            </p>

            {/* Record List */}
            {records.map((record) => (
              <div
                key={record.id}
                onClick={() => setSelectedRecordId(record.id)}
                className={cn(
                  'border rounded-lg p-3 cursor-pointer transition-colors',
                  selectedRecordId === record.id
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{record.preview}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {formatTimestamp(record.timestamp)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {record.messageCount} 条
                    </Badge>
                    {record.branchCount > 1 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 flex items-center gap-0.5"
                      >
                        <GitBranch className="h-2.5 w-2.5" />
                        {record.branchCount}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Branch Navigation */}
                {record.branchCount > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={record.currentBranch <= 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBranchChange(record.id, 'prev');
                      }}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground">
                      分支 {record.currentBranch} / {record.branchCount}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={record.currentBranch >= record.branchCount}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBranchChange(record.id, 'next');
                      }}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Demo wrapper
export function ChatflowPreviewPanelDemo() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="relative w-full h-screen bg-gray-100 dark:bg-gray-900">
      {/* Mock canvas background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:20px_20px] dark:bg-[linear-gradient(to_right,#374151_1px,transparent_1px),linear-gradient(to_bottom,#374151_1px,transparent_1px)]" />

      {/* Toggle button */}
      {!isOpen && (
        <Button
          className="absolute right-4 top-4"
          onClick={() => setIsOpen(true)}
        >
          打开对话预览
        </Button>
      )}

      {/* Panel */}
      <ChatflowPreviewPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onRefresh={() => console.log('Refresh')}
      />
    </div>
  );
}
