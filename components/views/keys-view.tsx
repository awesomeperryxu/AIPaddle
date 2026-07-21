'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Key, CheckCircle2, Ban, Activity, Copy } from 'lucide-react';

type KeyStatus = 'active' | 'revoked' | 'expired';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  scope: string;
  rate: string;
  calls: number;
  lastUsed: string;
  status: KeyStatus;
}

const statusConfig: Record<KeyStatus, { label: string; className: string }> = {
  active: { label: '生效中', className: 'bg-green-500/10 text-green-500' },
  revoked: { label: '已吊销', className: 'bg-destructive/10 text-destructive' },
  expired: { label: '已过期', className: 'bg-yellow-500/10 text-yellow-500' },
};

const scopeOptions = ['Agent 调用', '只读（用量/账单）', '全部权限'];

const initialKeys: ApiKey[] = [
  { id: 'k-001', name: 'CRM 集成', key: 'ap_sk_live_a1f3************9c2b', scope: 'Agent 调用', rate: '50 QPS', calls: 892340, lastUsed: '3 分钟前', status: 'active' },
  { id: 'k-002', name: '客服机器人', key: 'ap_sk_live_7d2e************4f81', scope: 'Agent 调用', rate: '100 QPS', calls: 615720, lastUsed: '1 小时前', status: 'active' },
  { id: 'k-003', name: '数据看板只读', key: 'ap_sk_live_3b9c************e07a', scope: '只读（用量/账单）', rate: '20 QPS', calls: 128450, lastUsed: '昨天', status: 'active' },
  { id: 'k-004', name: '运维管理密钥', key: 'ap_sk_live_5e11************b6d4', scope: '全部权限', rate: '30 QPS', calls: 43210, lastUsed: '5 天前', status: 'revoked' },
  { id: 'k-005', name: '临时测试 Key', key: 'ap_sk_live_9c04************1a2f', scope: 'Agent 调用', rate: '10 QPS', calls: 5620, lastUsed: '2026-06-30', status: 'expired' },
  { id: 'k-006', name: '营销活动集成', key: 'ap_sk_live_2f7b************8d3c', scope: 'Agent 调用', rate: '50 QPS', calls: 97880, lastUsed: '10 分钟前', status: 'active' },
];

const monthlyCallsLabel = '1.78M';

export function KeysView() {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState(scopeOptions[0]);
  const [newRate, setNewRate] = useState('50');

  const nTotal = keys.length;
  const nActive = keys.filter((k) => k.status === 'active').length;
  const nRevoked = keys.filter((k) => k.status !== 'active').length;

  const handleCopy = (id: string) => {
    // 占位：真实实现将写入剪贴板
    void id;
  };

  const handleRevoke = (id: string) => {
    setKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, status: 'revoked' } : k)),
    );
  };

  const handleSubmit = () => {
    const name = newName.trim() || '未命名 Key';
    const rate = newRate.trim() || '50';
    const next: ApiKey = {
      id: `k-${Date.now()}`,
      name,
      key: `ap_sk_live_${Math.random().toString(16).slice(2, 6)}************${Math.random().toString(16).slice(2, 6)}`,
      scope: newScope,
      rate: `${rate} QPS`,
      calls: 0,
      lastUsed: '尚未使用',
      status: 'active',
    };
    setKeys((prev) => [...prev, next]);
    setCreateOpen(false);
    setNewName('');
    setNewScope(scopeOptions[0]);
    setNewRate('50');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Key 管理</h1>
          <p className="text-muted-foreground">管理平台 API 密钥、权限范围与限流</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          创建 Key
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{nTotal}</p>
                <p className="text-xs text-muted-foreground">全部 Key</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{nActive}</p>
                <p className="text-xs text-muted-foreground">生效中</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Ban className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{nRevoked}</p>
                <p className="text-xs text-muted-foreground">已吊销 / 过期</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{monthlyCallsLabel}</p>
                <p className="text-xs text-muted-foreground">本月 Key 调用量</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Keys Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">名称 / Key</TableHead>
                <TableHead className="text-muted-foreground">权限范围</TableHead>
                <TableHead className="text-muted-foreground">限流</TableHead>
                <TableHead className="text-muted-foreground">累计调用</TableHead>
                <TableHead className="text-muted-foreground">最近使用</TableHead>
                <TableHead className="text-muted-foreground">状态</TableHead>
                <TableHead className="text-muted-foreground text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id} className="border-border">
                  <TableCell>
                    <p className="font-medium text-foreground">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{k.key}</p>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-muted text-foreground">{k.scope}</Badge>
                  </TableCell>
                  <TableCell className="text-foreground">{k.rate}</TableCell>
                  <TableCell className="text-foreground">{k.calls.toLocaleString('en-US')}</TableCell>
                  <TableCell className="text-muted-foreground">{k.lastUsed}</TableCell>
                  <TableCell>
                    <Badge className={statusConfig[k.status].className}>
                      {statusConfig[k.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 mr-2 gap-1"
                      onClick={() => handleCopy(k.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      复制
                    </Button>
                    {k.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-destructive border-destructive/35 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleRevoke(k.id)}
                      >
                        吊销
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">创建 API Key</DialogTitle>
            <DialogDescription>Key 仅在创建时完整展示一次，请妥善保存</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">名称 *</Label>
              <Input
                id="key-name"
                placeholder="如：CRM 集成"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-scope">权限范围 *</Label>
              <Select value={newScope} onValueChange={setNewScope}>
                <SelectTrigger id="key-scope" className="w-full bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((scope) => (
                    <SelectItem key={scope} value={scope}>
                      {scope}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-rate">限流（QPS）*</Label>
              <Input
                id="key-rate"
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
