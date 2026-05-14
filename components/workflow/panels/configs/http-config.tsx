'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Copy, Import } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { HttpMethod, BodyType } from '../../types';
import type { WorkflowNode, HttpRequestConfig, KeyValueItem } from '../../types';

interface HttpNodeConfigPanelProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<HttpRequestConfig>) => void;
  appType?: 'workflow' | 'chatflow';
}

function generateId(): string {
  return `kv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const methodColors: Record<HttpMethod, string> = {
  [HttpMethod.GET]: 'bg-green-100 text-green-700 border-green-200',
  [HttpMethod.POST]: 'bg-blue-100 text-blue-700 border-blue-200',
  [HttpMethod.PUT]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  [HttpMethod.DELETE]: 'bg-red-100 text-red-700 border-red-200',
  [HttpMethod.PATCH]: 'bg-purple-100 text-purple-700 border-purple-200',
  [HttpMethod.HEAD]: 'bg-gray-100 text-gray-700 border-gray-200',
  [HttpMethod.OPTIONS]: 'bg-gray-100 text-gray-700 border-gray-200',
};

interface KeyValueEditorProps {
  items: KeyValueItem[];
  onChange: (items: KeyValueItem[]) => void;
  placeholder?: { key: string; value: string };
}

function KeyValueEditor({ items, onChange, placeholder }: KeyValueEditorProps) {
  const addItem = () => {
    onChange([
      ...items,
      { id: generateId(), key: '', value: '', enabled: true },
    ]);
  };

  const updateItem = (index: number, item: KeyValueItem) => {
    const newItems = [...items];
    newItems[index] = item;
    onChange(newItems);
  };

  const deleteItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(newItems);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={item.id || index} className="flex items-center gap-2">
          <Switch
            checked={item.enabled !== false}
            onCheckedChange={(enabled) => updateItem(index, { ...item, enabled })}
            className="shrink-0"
          />
          <Input
            value={item.key}
            onChange={(e) => updateItem(index, { ...item, key: e.target.value })}
            placeholder={placeholder?.key || 'Key'}
            className="flex-1 h-8 text-sm"
          />
          <Input
            value={item.value}
            onChange={(e) => updateItem(index, { ...item, value: e.target.value })}
            placeholder={placeholder?.value || 'Value'}
            className="flex-1 h-8 text-sm"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteItem(index)}
            className="h-8 w-8 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} className="w-full">
        <Plus className="h-3.5 w-3.5 mr-1" />
        添加
      </Button>
    </div>
  );
}

export function HttpNodeConfigPanel({
  node,
  allNodes,
  onUpdate,
  appType = 'workflow',
}: HttpNodeConfigPanelProps) {
  const config = node.data as HttpRequestConfig;
  const method = config.method || HttpMethod.GET;
  const url = config.url || '';
  const headers = config.headers || [];
  const params = config.params || [];
  const body = config.body || { type: BodyType.None };
  const authorization = config.authorization || { type: 'none' };
  const timeout = config.timeout || 60;
  const retry = config.retry || { enabled: false, max_retries: 3, retry_interval: 1 };

  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateMethod = (newMethod: HttpMethod) => {
    onUpdate({ method: newMethod });
  };

  const updateUrl = (newUrl: string) => {
    onUpdate({ url: newUrl });
  };

  const updateHeaders = (newHeaders: KeyValueItem[]) => {
    onUpdate({ headers: newHeaders });
  };

  const updateParams = (newParams: KeyValueItem[]) => {
    onUpdate({ params: newParams });
  };

  const updateBodyType = (type: BodyType) => {
    onUpdate({ body: { ...body, type } });
  };

  const updateBodyContent = (content: string) => {
    onUpdate({ body: { ...body, content } });
  };

  const updateBodyData = (data: KeyValueItem[]) => {
    onUpdate({ body: { ...body, data } });
  };

  const updateAuthType = (type: 'none' | 'api-key' | 'basic' | 'bearer' | 'custom') => {
    onUpdate({ authorization: { type, config: {} } });
  };

  return (
    <div className="space-y-6">
      {/* Method and URL */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">请求配置</Label>
        <div className="flex items-center gap-2">
          <Select value={method} onValueChange={updateMethod}>
            <SelectTrigger className={cn('w-28 h-9', methodColors[method])}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(HttpMethod).map((m) => (
                <SelectItem key={m} value={m}>
                  <Badge variant="outline" className={cn('font-mono', methodColors[m])}>
                    {m}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={url}
            onChange={(e) => updateUrl(e.target.value)}
            placeholder="https://api.example.com/endpoint"
            className="flex-1 h-9 font-mono text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          支持变量插值: {'{{node_id.variable}}'}
        </p>
      </div>

      {/* Tabs for Headers, Params, Body, Auth */}
      <Tabs defaultValue="headers" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-9">
          <TabsTrigger value="headers" className="text-xs">
            Headers
            {headers.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                {headers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="params" className="text-xs">
            Params
            {params.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                {params.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="body" className="text-xs">
            Body
          </TabsTrigger>
          <TabsTrigger value="auth" className="text-xs">
            Auth
          </TabsTrigger>
        </TabsList>

        {/* Headers Tab */}
        <TabsContent value="headers" className="pt-3">
          <KeyValueEditor
            items={headers}
            onChange={updateHeaders}
            placeholder={{ key: 'Header Name', value: 'Header Value' }}
          />
        </TabsContent>

        {/* Params Tab */}
        <TabsContent value="params" className="pt-3">
          <KeyValueEditor
            items={params}
            onChange={updateParams}
            placeholder={{ key: 'Parameter Name', value: 'Parameter Value' }}
          />
        </TabsContent>

        {/* Body Tab */}
        <TabsContent value="body" className="pt-3 space-y-3">
          <Select value={body.type} onValueChange={updateBodyType}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={BodyType.None}>无</SelectItem>
              <SelectItem value={BodyType.JSON}>JSON</SelectItem>
              <SelectItem value={BodyType.FormData}>Form Data</SelectItem>
              <SelectItem value={BodyType.XWwwFormUrlencoded}>x-www-form-urlencoded</SelectItem>
              <SelectItem value={BodyType.RawText}>Raw Text</SelectItem>
              <SelectItem value={BodyType.Binary}>Binary</SelectItem>
            </SelectContent>
          </Select>

          {body.type === BodyType.JSON || body.type === BodyType.RawText ? (
            <Textarea
              value={body.content || ''}
              onChange={(e) => updateBodyContent(e.target.value)}
              placeholder={body.type === BodyType.JSON ? '{\n  "key": "value"\n}' : '请求体内容...'}
              className="min-h-[120px] font-mono text-sm resize-none"
            />
          ) : body.type === BodyType.FormData || body.type === BodyType.XWwwFormUrlencoded ? (
            <KeyValueEditor
              items={body.data || []}
              onChange={updateBodyData}
              placeholder={{ key: 'Field Name', value: 'Field Value' }}
            />
          ) : null}
        </TabsContent>

        {/* Auth Tab */}
        <TabsContent value="auth" className="pt-3 space-y-3">
          <Select value={authorization.type} onValueChange={updateAuthType}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">无需认证</SelectItem>
              <SelectItem value="api-key">API Key</SelectItem>
              <SelectItem value="basic">Basic Auth</SelectItem>
              <SelectItem value="bearer">Bearer Token</SelectItem>
              <SelectItem value="custom">自定义</SelectItem>
            </SelectContent>
          </Select>

          {authorization.type === 'api-key' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Header Name"
                  value={authorization.config?.header || ''}
                  onChange={(e) =>
                    onUpdate({
                      authorization: {
                        ...authorization,
                        config: { ...authorization.config, header: e.target.value },
                      },
                    })
                  }
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="API Key"
                  value={authorization.config?.key || ''}
                  onChange={(e) =>
                    onUpdate({
                      authorization: {
                        ...authorization,
                        config: { ...authorization.config, key: e.target.value },
                      },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {authorization.type === 'basic' && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Username"
                value={authorization.config?.username || ''}
                onChange={(e) =>
                  onUpdate({
                    authorization: {
                      ...authorization,
                      config: { ...authorization.config, username: e.target.value },
                    },
                  })
                }
                className="h-8 text-sm"
              />
              <Input
                type="password"
                placeholder="Password"
                value={authorization.config?.password || ''}
                onChange={(e) =>
                  onUpdate({
                    authorization: {
                      ...authorization,
                      config: { ...authorization.config, password: e.target.value },
                    },
                  })
                }
                className="h-8 text-sm"
              />
            </div>
          )}

          {authorization.type === 'bearer' && (
            <Input
              placeholder="Bearer Token"
              value={authorization.config?.token || ''}
              onChange={(e) =>
                onUpdate({
                  authorization: {
                    ...authorization,
                    config: { ...authorization.config, token: e.target.value },
                  },
                })
              }
              className="h-8 text-sm font-mono"
            />
          )}
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Advanced Settings */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between px-0">
            <span className="text-sm font-medium">高级设置</span>
            <ChevronDown className={cn(
              'h-4 w-4 transition-transform',
              showAdvanced && 'rotate-180'
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {/* Timeout */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">超时时间 (秒)</Label>
            <Input
              type="number"
              min={1}
              max={300}
              value={timeout}
              onChange={(e) => onUpdate({ timeout: parseInt(e.target.value) || 60 })}
              className="w-20 h-8 text-sm"
            />
          </div>

          {/* Retry */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">失败重试</Label>
                <p className="text-xs text-muted-foreground">请求失败时自动重试</p>
              </div>
              <Switch
                checked={retry.enabled}
                onCheckedChange={(enabled) =>
                  onUpdate({ retry: { ...retry, enabled } })
                }
              />
            </div>
            {retry.enabled && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30">
                <div className="space-y-1">
                  <Label className="text-xs">最大重试次数</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={retry.max_retries}
                    onChange={(e) =>
                      onUpdate({
                        retry: { ...retry, max_retries: parseInt(e.target.value) || 3 },
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">重试间隔 (秒)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={retry.retry_interval}
                    onChange={(e) =>
                      onUpdate({
                        retry: { ...retry, retry_interval: parseInt(e.target.value) || 1 },
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Import CURL */}
      <Button variant="outline" size="sm" className="w-full">
        <Import className="h-3.5 w-3.5 mr-1" />
        导入 cURL
      </Button>

      {/* Output Info */}
      <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
        <p className="font-medium">输出变量</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><code className="font-mono">body</code> - 响应体内容</li>
          <li><code className="font-mono">status_code</code> - HTTP 状态码</li>
          <li><code className="font-mono">headers</code> - 响应头</li>
        </ul>
      </div>
    </div>
  );
}
