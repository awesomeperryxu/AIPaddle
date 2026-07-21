'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, AlertTriangle, CheckCircle2 } from 'lucide-react';

type BillStatus = 'paid' | 'unpaid' | 'overdue' | 'void';
type FilterValue = 'all' | BillStatus;

interface Bill {
  id: string;
  tenantName: string;
  billNo: string;
  period: string;
  amount: number;
  status: BillStatus;
}

// 组件内联 mock 数据（原型演示用，不接后端）
const mockBills: Bill[] = [
  { id: 'b-001', tenantName: '示范科技有限公司', billNo: 'INV-2405-0012', period: '2024-05', amount: 2890, status: 'paid' },
  { id: 'b-002', tenantName: '创新金融集团', billNo: 'INV-2405-0013', period: '2024-05', amount: 1560, status: 'paid' },
  { id: 'b-003', tenantName: '未来科技公司', billNo: 'INV-2405-0014', period: '2024-05', amount: 450, status: 'unpaid' },
  { id: 'b-004', tenantName: '智慧零售有限公司', billNo: 'INV-2405-0015', period: '2024-05', amount: 1230, status: 'overdue' },
  { id: 'b-005', tenantName: '智慧零售有限公司', billNo: 'INV-2404-0009', period: '2024-04', amount: 1230, status: 'overdue' },
  { id: 'b-006', tenantName: '云图数据科技', billNo: 'INV-2405-0016', period: '2024-05', amount: 3680, status: 'unpaid' },
  { id: 'b-007', tenantName: '恒达制造集团', billNo: 'INV-2405-0017', period: '2024-05', amount: 2140, status: 'paid' },
  { id: 'b-008', tenantName: '测试企业', billNo: 'INV-2405-0018', period: '2024-05', amount: 0, status: 'void' },
];

// 平台收入汇总（mock）
const platformRevenue = {
  month: 34280,
  ytd: 186450,
  unpaid: 4130,
  overdue: 2460,
};

// 应收账龄分桶（mock）
const overdueAging = [
  { bucket: '未逾期（0-30 天）', amount: 4130 },
  { bucket: '逾期 1-30 天', amount: 1230 },
  { bucket: '逾期 31-60 天', amount: 1230 },
  { bucket: '逾期 60 天以上', amount: 0 },
];

const statusConfig: Record<BillStatus, { label: string; className: string }> = {
  paid: { label: '已支付', className: 'bg-green-500/10 text-green-500' },
  unpaid: { label: '未支付', className: 'bg-yellow-500/10 text-yellow-500' },
  overdue: { label: '已逾期', className: 'bg-destructive/10 text-destructive' },
  void: { label: '已作废', className: 'bg-muted text-muted-foreground' },
};

const filterOptions: { value: FilterValue; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'paid', label: '已支付' },
  { value: 'unpaid', label: '未支付' },
  { value: 'overdue', label: '已逾期' },
  { value: 'void', label: '已作废' },
];

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

export function BillingView() {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [paidMap, setPaidMap] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2600);
  };

  const bills = useMemo(
    () =>
      mockBills.map((b) => ({
        ...b,
        status: paidMap[b.id] ? ('paid' as BillStatus) : b.status,
      })),
    [paidMap]
  );

  const shownBills = bills.filter((b) => filter === 'all' || b.status === filter);

  const agingMax = Math.max(...overdueAging.map((a) => a.amount), 1);

  const handleMarkPaid = (bill: Bill) => {
    setPaidMap((prev) => ({ ...prev, [bill.id]: true }));
    showToast(`${bill.billNo} 已标记为已支付`);
  };

  const handleRemind = (bill: Bill) => {
    showToast(`已向「${bill.tenantName}」发送催缴通知`);
  };

  const handleExport = () => {
    showToast(`已导出 ${shownBills.length} 条账单对账单（CSV，原型模拟）`);
  };

  return (
    <div className="space-y-6">
      {/* 顶部：标题 + 筛选 + 导出 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">账单管理（平台）</h1>
          <p className="text-muted-foreground">跨租户账单与应收管理；单租户账单在租户管理中查看</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
            <SelectTrigger className="w-[130px] bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {filterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2 border-border" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出对账单
          </Button>
        </div>
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">¥{fmt(platformRevenue.month)}</p>
            <p className="mt-1 text-xs text-muted-foreground">本月收入（MRR）</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">¥{fmt(platformRevenue.ytd)}</p>
            <p className="mt-1 text-xs text-muted-foreground">年度累计收入</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-yellow-500">¥{fmt(platformRevenue.unpaid)}</p>
            <p className="mt-1 text-xs text-muted-foreground">待支付应收</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-destructive">¥{fmt(platformRevenue.overdue)}</p>
            <p className="mt-1 text-xs text-muted-foreground">逾期应收</p>
          </CardContent>
        </Card>
      </div>

      {/* 主体：账单表 + 侧栏 */}
      <div className="grid grid-cols-3 gap-6 items-start">
        {/* 左：账单表 */}
        <Card className="col-span-2 bg-card border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">租户 / 账单编号</TableHead>
                  <TableHead className="text-muted-foreground">周期</TableHead>
                  <TableHead className="text-muted-foreground">金额</TableHead>
                  <TableHead className="text-muted-foreground">状态</TableHead>
                  <TableHead className="text-muted-foreground text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownBills.map((bill) => {
                  const canPay = bill.status === 'unpaid' || bill.status === 'overdue';
                  return (
                    <TableRow key={bill.id} className="border-border">
                      <TableCell>
                        <p className="font-medium text-foreground">{bill.tenantName}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground font-mono">{bill.billNo}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{bill.period}</TableCell>
                      <TableCell className="text-foreground font-medium">¥{fmt(bill.amount)}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig[bill.status].className}>
                          {statusConfig[bill.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {canPay ? (
                          <div className="inline-flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 border-green-500/35 text-green-500 hover:bg-green-500/10 hover:text-green-500"
                              onClick={() => handleMarkPaid(bill)}
                            >
                              标记已支付
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 border-yellow-500/35 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-500"
                              onClick={() => handleRemind(bill)}
                            >
                              催缴
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 右：应收账龄 + 催缴中 */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">应收账龄</h3>
              <div className="space-y-3">
                {overdueAging.map((ag) => {
                  const isOverdue = ag.bucket.startsWith('逾期') && ag.amount > 0;
                  return (
                    <div key={ag.bucket}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{ag.bucket}</span>
                        <span className="font-medium text-foreground">¥{fmt(ag.amount)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${isOverdue ? 'bg-destructive' : 'bg-primary'}`}
                          style={{ width: `${Math.round((ag.amount / agingMax) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-destructive/30">
            <CardContent className="p-5">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                催缴中
              </h3>
              <p className="mb-1 text-sm text-foreground">智慧零售有限公司 · ¥2,460</p>
              <p className="text-xs text-muted-foreground">
                连续 2 期未付（1 期已逾期）。已于 05-02、05-09 发送催缴邮件；再逾期 7 天将自动限流。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 轻量 Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-green-500/40 bg-card px-4 py-3 shadow-xl">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm text-foreground">{toast}</span>
        </div>
      )}
    </div>
  );
}
