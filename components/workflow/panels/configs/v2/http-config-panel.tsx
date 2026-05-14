'use client';

import { useState } from 'react';
import { Globe, Plus, Trash2, ChevronDown, ChevronRight, Import } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import type { WorkflowNode } from '../../../types';

// Local interface for HTTP config data
interface HttpConfigData {
  method?: string;
  url?: string;
  authorization?: {
    type: string;
    config: Record<string, string>;
  };
  headers?: Array<{ key: string; value: string }>;
  params?: Array<{ key: string; value: string }>;
  body?: {
    type: string;
    content?: string;
    data?: Array<{ key: string; value: string }>;
  };
  sslVerify?: boolean;
  timeout?: number;
}

// Accent color for HTTP node
const ACCENT_COLOR = '#EF4444';

// HTTP methods
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'] as const;

// Auth types
const AUTH_TYPES = [
  { value: 'none', label: '无认证' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api-key', label: 'API Key' },
] as const;

// Body types
const BODY_TYPES = [
  { value: 'none', label: '无' },
  { value: 'form-data', label: 'form-data' },
  { value: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
  { value: 'raw', label: 'raw' },
] as const;

// Raw body formats
const RAW_FORMATS = ['JSON', 'XML', 'text'] as const;

interface KeyValuePair {
  id: string;
  key: string;
  value: string;
}

interface HttpConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<HttpConfigData>) => void;
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

// Key-Value pair list component
function KeyValueList({
  items,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: {
  items: KeyValuePair[];
  onChange: (items: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const addItem = () => {
    onChange([...items, { id: `item_${Date.now()}`, key: '', value: '' }]);
  };

  const updateItem = (id: string, field: 'key' | 'value', val: string) => {
    onChange(items.map(item => (item.id === id ? { ...item, [field]: val } : item)));
  };

  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2">
          <Input
            value={item.key}
            onChange={e => updateItem(item.id, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className="w-32"
          />
          <Input
            value={item.value}
            onChange={e => updateItem(item.id, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => removeItem(item.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} className="w-full">
        <Plus className="h-4 w-4 mr-1" />
        添加
      </Button>
    </div>
  );
}

export function HttpConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
}: HttpConfigPanelV2Props) {
  const config = (node.data as unknown as HttpConfigData) || {};
  
  // Local state
  const [method, setMethod] = useState(config.method || 'GET');
  const [url, setUrl] = useState(config.url || '');
  const [authType, setAuthType] = useState<string>(config.authorization?.type || 'none');
  const [authConfig, setAuthConfig] = useState<Record<string, string>>(config.authorization?.config || {});
  const [headers, setHeaders] = useState<KeyValuePair[]>(
    config.headers?.map((h: { key: string; value: string }, i: number) => ({ id: `h_${i}`, key: h.key, value: h.value })) || []
  );
  const [params, setParams] = useState<KeyValuePair[]>(
    config.params?.map((p: { key: string; value: string }, i: number) => ({ id: `p_${i}`, key: p.key, value: p.value })) || []
  );
  const [bodyType, setBodyType] = useState<string>(config.body?.type || 'none');
  const [rawFormat, setRawFormat] = useState('JSON');
  const [rawBody, setRawBody] = useState(config.body?.content || '');
  const [bodyData, setBodyData] = useState<KeyValuePair[]>(
    config.body?.data?.map((d: { key: string; value: string }, i: number) => ({ id: `b_${i}`, key: d.key, value: d.value })) || []
  );
  const [sslVerify, setSslVerify] = useState(config.sslVerify ?? true);
  const [timeout, setTimeout] = useState(config.timeout || 10);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Output variables (read-only)
  const outputVariables: OutputVariable[] = [
    { name: 'body', type: 'string', description: '响应体内容' },
    { name: 'status_code', type: 'number', description: 'HTTP 状态码' },
    { name: 'headers', type: 'object', description: '响应头' },
    { name: 'files', type: 'array[file]', description: '响应文件' },
  ];

  const handleSave = () => {
    onUpdate({
      method,
      url,
      authorization: { type: authType, config: authConfig },
      headers: headers.map(h => ({ key: h.key, value: h.value })),
      params: params.map(p => ({ key: p.key, value: p.value })),
      body: {
        type: bodyType,
        content: rawBody,
        data: bodyData.map(d => ({ key: d.key, value: d.value })),
      },
      sslVerify,
      timeout,
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
          {/* Method + URL */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">请求</Label>
            <div className="flex items-center gap-2">
              <Select value={method} onValueChange={(v: string) => setMethod(v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map(m => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://api.example.com/endpoint"
                className="flex-1"
              />
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Import className="h-4 w-4 mr-1" />
              导入 cURL
            </Button>
          </div>

          {/* Auth */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">认证方式</Label>
            <Select value={authType} onValueChange={setAuthType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTH_TYPES.map(auth => (
                  <SelectItem key={auth.value} value={auth.value}>
                    {auth.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Conditional auth inputs */}
            {authType === 'bearer' && (
              <Input
                value={authConfig.token || ''}
                onChange={e => setAuthConfig({ ...authConfig, token: e.target.value })}
                placeholder="Bearer Token"
                type="password"
              />
            )}
            {authType === 'basic' && (
              <div className="space-y-2">
                <Input
                  value={authConfig.username || ''}
                  onChange={e => setAuthConfig({ ...authConfig, username: e.target.value })}
                  placeholder="用户名"
                />
                <Input
                  value={authConfig.password || ''}
                  onChange={e => setAuthConfig({ ...authConfig, password: e.target.value })}
                  placeholder="密码"
                  type="password"
                />
              </div>
            )}
            {authType === 'api-key' && (
              <div className="space-y-2">
                <Input
                  value={authConfig.headerName || ''}
                  onChange={e => setAuthConfig({ ...authConfig, headerName: e.target.value })}
                  placeholder="Header 名称"
                />
                <Input
                  value={authConfig.apiKey || ''}
                  onChange={e => setAuthConfig({ ...authConfig, apiKey: e.target.value })}
                  placeholder="API Key 值"
                  type="password"
                />
              </div>
            )}
          </div>

          {/* Headers */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">请求头 (Headers)</Label>
            <KeyValueList items={headers} onChange={setHeaders} />
          </div>

          {/* Query Params */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">查询参数 (Params)</Label>
            <KeyValueList items={params} onChange={setParams} />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">请求体 (Body)</Label>
            <Select value={bodyType} onValueChange={setBodyType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BODY_TYPES.map(bt => (
                  <SelectItem key={bt.value} value={bt.value}>
                    {bt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {bodyType === 'raw' && (
              <div className="space-y-2">
                <Select value={rawFormat} onValueChange={setRawFormat}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RAW_FORMATS.map(f => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={rawBody}
                  onChange={e => setRawBody(e.target.value)}
                  placeholder={rawFormat === 'JSON' ? '{\n  "key": "value"\n}' : ''}
                  className="font-mono min-h-[80px]"
                />
              </div>
            )}
            
            {(bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') && (
              <KeyValueList items={bodyData} onChange={setBodyData} />
            )}
          </div>

          {/* Advanced Settings */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span>高级设置</span>
                {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">SSL 验证</Label>
                <Switch checked={sslVerify} onCheckedChange={setSslVerify} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">超时时间（秒）</Label>
                <Input
                  type="number"
                  value={timeout}
                  onChange={e => setTimeout(parseInt(e.target.value) || 10)}
                  min={1}
                  max={300}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
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
      title="HTTP 请求"
      typeBadge="HTTP"
      icon={<Globe className="h-4 w-4" />}
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
