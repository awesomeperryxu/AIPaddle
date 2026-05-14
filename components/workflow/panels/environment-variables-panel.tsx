'use client';

import { useState } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Search,
  AlertTriangle,
  Copy,
  Check,
  X,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ===== Types =====
interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'secret';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface EnvironmentVariablesPanelProps {
  variables: EnvironmentVariable[];
  onAdd: (variable: Omit<EnvironmentVariable, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (id: string, updates: Partial<EnvironmentVariable>) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

// ===== Main Component =====
export function EnvironmentVariablesPanel({
  variables,
  onAdd,
  onUpdate,
  onDelete,
  isOpen,
  onClose,
}: EnvironmentVariablesPanelProps) {
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New variable form state
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState<'string' | 'secret'>('string');
  const [newDescription, setNewDescription] = useState('');

  // Filter variables by search
  const filteredVariables = variables.filter(
    (v) =>
      v.key.toLowerCase().includes(search.toLowerCase()) ||
      v.description?.toLowerCase().includes(search.toLowerCase())
  );

  // Toggle secret visibility
  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Copy variable reference
  const copyReference = (key: string, id: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle add variable
  const handleAdd = () => {
    if (!newKey.trim()) return;
    onAdd({
      key: newKey.trim().toUpperCase().replace(/\s+/g, '_'),
      value: newValue,
      type: newType,
      description: newDescription,
    });
    setNewKey('');
    setNewValue('');
    setNewType('string');
    setNewDescription('');
    setShowAddDialog(false);
  };

  // Handle delete with confirmation
  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个环境变量吗？')) {
      onDelete(id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-background border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/30">
            <Settings className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="font-semibold">环境变量</h2>
          <Badge variant="secondary" className="text-xs">
            {variables.length}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search & Add */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索变量名或描述..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button className="w-full" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          添加环境变量
        </Button>
      </div>

      {/* Info Box */}
      <div className="mx-4 mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700 dark:text-amber-300">
            <p className="font-medium">使用提示</p>
            <p className="text-xs mt-1 text-amber-600 dark:text-amber-400">
              在节点配置中使用 {'{{VARIABLE_NAME}}'} 引用环境变量。Secret 类型变量值不会在日志中显示。
            </p>
          </div>
        </div>
      </div>

      {/* Variable List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredVariables.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {search ? '没有匹配的环境变量' : '暂无环境变量'}
            </p>
          </div>
        ) : (
          filteredVariables.map((variable) => (
            <VariableCard
              key={variable.id}
              variable={variable}
              isEditing={editingId === variable.id}
              isSecretVisible={visibleSecrets.has(variable.id)}
              isCopied={copiedId === variable.id}
              onEdit={() => setEditingId(variable.id)}
              onCancelEdit={() => setEditingId(null)}
              onUpdate={(updates) => {
                onUpdate(variable.id, updates);
                setEditingId(null);
              }}
              onDelete={() => handleDelete(variable.id)}
              onToggleSecret={() => toggleSecretVisibility(variable.id)}
              onCopyReference={() => copyReference(variable.key, variable.id)}
            />
          ))
        )}
      </div>

      {/* Add Variable Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加环境变量</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">变量名</label>
              <Input
                placeholder="例如: API_KEY"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                只能包含大写字母、数字和下划线
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">类型</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={newType === 'string' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewType('string')}
                  className="flex-1"
                >
                  字符串
                </Button>
                <Button
                  type="button"
                  variant={newType === 'secret' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewType('secret')}
                  className="flex-1"
                >
                  <Key className="h-3 w-3 mr-1" />
                  Secret
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">值</label>
              <Input
                type={newType === 'secret' ? 'password' : 'text'}
                placeholder={newType === 'secret' ? '输入敏感信息...' : '输入值...'}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">描述（可选）</label>
              <Input
                placeholder="变量用途说明..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              取消
            </Button>
            <Button onClick={handleAdd} disabled={!newKey.trim()}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Variable Card Component =====
interface VariableCardProps {
  variable: EnvironmentVariable;
  isEditing: boolean;
  isSecretVisible: boolean;
  isCopied: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (updates: Partial<EnvironmentVariable>) => void;
  onDelete: () => void;
  onToggleSecret: () => void;
  onCopyReference: () => void;
}

function VariableCard({
  variable,
  isEditing,
  isSecretVisible,
  isCopied,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onToggleSecret,
  onCopyReference,
}: VariableCardProps) {
  const [editValue, setEditValue] = useState(variable.value);
  const [editDescription, setEditDescription] = useState(variable.description || '');

  const handleSave = () => {
    onUpdate({
      value: editValue,
      description: editDescription,
    });
  };

  const displayValue = variable.type === 'secret' && !isSecretVisible
    ? '••••••••••••'
    : variable.value;

  return (
    <div className="p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <code className="text-sm font-semibold font-mono text-foreground">
            {variable.key}
          </code>
          {variable.type === 'secret' && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
              <Key className="h-2.5 w-2.5 mr-1" />
              Secret
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCopyReference}
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Value Row */}
      {isEditing ? (
        <div className="space-y-2">
          <Input
            type={variable.type === 'secret' ? 'password' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="font-mono text-sm"
            placeholder="输入值..."
          />
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="text-sm"
            placeholder="描述（可选）"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>
              保存
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelEdit}>
              取消
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono text-muted-foreground truncate">
              {displayValue}
            </code>
            {variable.type === 'secret' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={onToggleSecret}
              >
                {isSecretVisible ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
          {variable.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {variable.description}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ===== Demo Component =====
export function EnvironmentVariablesPanelDemo() {
  const [isOpen, setIsOpen] = useState(true);
  const [variables, setVariables] = useState<EnvironmentVariable[]>([
    {
      id: '1',
      key: 'OPENAI_API_KEY',
      value: 'sk-proj-1234567890abcdef',
      type: 'secret',
      description: 'OpenAI API 密钥',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      key: 'DATABASE_URL',
      value: 'postgresql://user:pass@localhost:5432/mydb',
      type: 'secret',
      description: '数据库连接字符串',
      createdAt: '2024-01-14T09:00:00Z',
      updatedAt: '2024-01-14T09:00:00Z',
    },
    {
      id: '3',
      key: 'APP_ENV',
      value: 'production',
      type: 'string',
      description: '应用环境',
      createdAt: '2024-01-13T08:00:00Z',
      updatedAt: '2024-01-13T08:00:00Z',
    },
    {
      id: '4',
      key: 'MAX_RETRIES',
      value: '3',
      type: 'string',
      createdAt: '2024-01-12T07:00:00Z',
      updatedAt: '2024-01-12T07:00:00Z',
    },
  ]);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">环境变量面板 Demo</h1>
        <Button onClick={() => setIsOpen(true)}>打开面板</Button>
      </div>
      <EnvironmentVariablesPanel
        variables={variables}
        onAdd={(newVar) => {
          setVariables((prev) => [
            ...prev,
            {
              ...newVar,
              id: Date.now().toString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]);
        }}
        onUpdate={(id, updates) => {
          setVariables((prev) =>
            prev.map((v) =>
              v.id === id
                ? { ...v, ...updates, updatedAt: new Date().toISOString() }
                : v
            )
          );
        }}
        onDelete={(id) => {
          setVariables((prev) => prev.filter((v) => v.id !== id));
        }}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}
