# 租户管理页面增强 PRD

**文档类型**: 迭代需求文档  
**创建日期**: 2026-05-08  
**目标版本**: v1.03  
**所属模块**: 2.9 租户管理（平台运营方视角）

---

## 一、迭代背景

在 v1.01 中已建立租户管理模块的基础框架，本次迭代将深化租户管理的操作流程，完善开通企业的详细表单，构建完整的多级页面体系，提升平台运营方对企业租户的全生命周期管理能力。

## 二、核心增强内容

### 2.1 开通企业功能增强

#### 2.1.1 触发方式
- **位置**: 租户管理主页面右上角
- **按钮样式**: Primary 按钮，带 Plus 图标
- **交互方式**: 点击后打开全屏抽屉（Drawer）而非 Dialog
  - **理由**: 表单字段较多（15+ 字段），需要更大的空间展示分组信息，避免滚动过长

#### 2.1.2 表单结构（分 4 个区块）

**区块 1: 企业基本信息**

| 字段名称 | 字段类型 | 是否必填 | 默认值 | 说明 |
|---------|---------|---------|--------|------|
| 企业名称 | Input | 是 | - | 2-50 字符，支持中英文 |
| 企业编码 | Input | 是 | 自动生成 | 唯一标识，格式：`TENANT_YYYYMMDD_XXXX`，可手动修改 |
| 企业简称 | Input | 否 | - | 用于界面显示，2-20 字符 |
| 行业类型 | Select | 是 | - | 预设选项：互联网/金融/教育/医疗/制造/零售/其他 |
| 企业规模 | Select | 是 | - | 1-50人/51-200人/201-500人/501-1000人/1000人以上 |
| 国家/地区 | Cascader | 是 | 中国 | 支持国家→省份→城市三级联动 |
| 时区设置 | Select | 是 | UTC+8 | 影响账单周期、日志时间戳 |
| 企业 Logo | Upload | 否 | 默认头像 | 支持 jpg/png，最大 2MB，建议尺寸 200x200 |

**区块 2: 联系人信息**

| 字段名称 | 字段类型 | 是否必填 | 默认值 | 说明 |
|---------|---------|---------|--------|------|
| 联系人姓名 | Input | 是 | - | 2-20 字符 |
| 联系人职位 | Input | 否 | - | 如：技术负责人、CEO |
| 联系邮箱 | Input | 是 | - | 用于发送开通通知和账单，需验证格式 |
| 联系电话 | Input | 是 | - | 支持国际格式，如 +86 138xxxx |
| 备用邮箱 | Input | 否 | - | 用于重要通知抄送 |

**区块 3: 套餐与配额**

| 字段名称 | 字段类型 | 是否必填 | 默认值 | 说明 |
|---------|---------|---------|--------|------|
| 套餐类型 | Radio Group | 是 | 标准版 | 免费版/标准版/专业版/企业版 |
| 计费模式 | Radio Group | 是 | 按量付费 | 按量付费/包年包月 |
| 初始 Token 配额 | InputNumber | 是 | 100万 | 单位：Token，最小 10万 |
| 配额预警阈值 | InputNumber | 是 | 80% | 达到该比例时发送预警邮件 |
| 并发请求限制 | InputNumber | 是 | 100 | 单位：QPS，范围 10-1000 |
| 存储空间配额 | InputNumber | 是 | 10GB | 用于存储对话历史、文件等 |

**区块 4: 高级设置**

| 字段名称 | 字段类型 | 是否必填 | 默认值 | 说明 |
|---------|---------|---------|--------|------|
| 服务有效期 | DateRangePicker | 是 | 1年 | 到期后自动暂停服务 |
| 是否启用 MCP | Switch | 否 | 关闭 | 开启后租户可申请自定义 MCP |
| 数据隔离级别 | Select | 是 | 逻辑隔离 | 逻辑隔离/物理隔离（影响成本） |
| 备注信息 | Textarea | 否 | - | 内部备注，租户不可见，最多 500 字符 |

#### 2.1.3 表单验证规则

- **企业编码唯一性**: 提交前校验数据库，重复时提示并建议新编码
- **邮箱格式**: 正则验证 + DNS MX 记录检查（可选）
- **配额合理性**: Token 配额需 ≥ 10万，存储空间 ≥ 1GB
- **服务有效期**: 不能早于当前日期，最长不超过 5 年

#### 2.1.4 提交后操作

1. **数据库写入**: 创建 `tenants` 表记录，状态为 `active`
2. **初始化操作**:
   - 创建租户管理员账号（邮箱作为用户名）
   - 发送开通通知邮件（含登录链接、初始密码）
   - 初始化默认组织架构（根部门）
   - 分配初始 Token 配额
   - 创建审计日志记录
3. **UI 反馈**: 
   - 成功：Toast 提示 + 自动跳转到新创建的企业详情页
   - 失败：显示具体错误信息，表单数据保留

---

### 2.2 企业列表操作增强

#### 2.2.1 列表操作列新增按钮

在原有基础上，每行操作列增加以下按钮（使用 DropdownMenu 收纳）：

| 操作名称 | 图标 | 权限要求 | 跳转目标 |
|---------|------|---------|---------|
| 查看详情 | Eye | 所有运营人员 | 企业详情页（二级页面） |
| 编辑信息 | Edit | 高级运营 | 编辑抽屉（同创建表单） |
| 配额管理 | Gauge | 所有运营人员 | 配额管理页（二级页面） |
| 账单管理 | Receipt | 财务/高级运营 | 账单管理页（二级页面） |
| 模型配置 | Settings | 高级运营 | 模型配置页（二级页面） |
| 暂停服务 | Pause | 高级运营 | 确认弹窗 → 状态变更 |
| 恢复服务 | Play | 高级运营 | 确认弹窗 → 状态变更 |
| 删除租户 | Trash | 超级管理员 | 二次确认 → 软删除 |

#### 2.2.2 批量操作

- **选择框**: 列表首列增加 Checkbox
- **批量操作栏**: 选中后顶部显示操作栏
  - 批量暂停服务
  - 批量恢复服务
  - 批量导出数据
  - 批量发送通知

---

### 2.3 多级页面结构设计

#### 2.3.1 页面层级关系

```
租户管理主页（一级）
├── 企业详情页（二级）
│   ├── 基本信息 Tab
│   ├── 配额使用 Tab
│   ├── 账单记录 Tab
│   ├── 操作日志 Tab
│   └── 设置 Tab
├── 配额管理页（二级）
│   ├── Token 用量详情（三级）
│   └── 存储用量详情（三级）
├── 账单管理页（二级）
│   └── 账单详情（三级）
├── 模型配置页（二级）
│   └── 模型权限设置（三级）
└── MCP 审批页（二级）
    └── MCP 详情（三级）
```

#### 2.3.2 二级页面：企业详情页

**路由**: `/admin/tenants/:tenantId/detail`

**页面布局**:
- **顶部**: 面包屑导航 + 企业名称 + 状态标签
- **左侧**: 企业 Logo + 基本信息卡片
- **右侧**: Tab 切换区域（5 个 Tab）

**Tab 1: 基本信息**
- 展示所有创建时填写的字段（只读）
- 右上角"编辑"按钮，点击打开编辑抽屉

**Tab 2: 配额使用**
- Token 使用情况：
  - 环形进度图（已用/总配额）
  - 近 30 天用量趋势图（折线图）
  - 按模型分类的用量占比（饼图）
  - "查看详情"按钮 → 跳转到 Token 用量详情页（三级）
- 存储使用情况：
  - 进度条（已用/总配额）
  - 文件类型分布（表格）
  - "查看详情"按钮 → 跳转到存储用量详情页（三级）
- 并发请求监控：
  - 实时 QPS 数值
  - 近 1 小时 QPS 曲线

**Tab 3: 账单记录**
- 账单列表表格：
  - 列：账单周期、账单金额、Token 消耗、状态、操作
  - 操作：查看详情（跳转三级页面）、下载 PDF
- 筛选器：时间范围、状态（已支付/未支付/已逾期）
- 统计卡片：累计消费、本月消费、待支付金额

**Tab 4: 操作日志**
- 日志列表表格：
  - 列：操作时间、操作人、操作类型、操作内容、IP 地址
  - 支持按操作类型筛选（创建/编辑/暂停/恢复/配额调整）
- 导出功能：导出为 CSV

**Tab 5: 设置**
- 危险操作区：
  - 暂停服务（红色按钮，需二次确认）
  - 删除租户（红色按钮，需输入企业名称确认）
- 通知设置：
  - 配额预警邮件接收人（可添加多个）
  - 账单通知接收人

#### 2.3.3 二级页面：配额管理页

**路由**: `/admin/tenants/:tenantId/quota`

**页面布局**:
- **顶部**: 面包屑 + 企业名称
- **主体**: 3 个配额卡片（Token/存储/并发）

**Token 配额卡片**:
- 当前配额、已用量、剩余量
- 调整配额按钮 → 打开 Dialog：
  - InputNumber 输入新配额
  - 调整原因（Textarea，必填）
  - 提交后记录审计日志
- 用量趋势图（近 30 天）
- "查看详情"按钮 → 跳转到 Token 用量详情页（三级）

**存储配额卡片**:
- 当前配额、已用量、剩余量
- 调整配额按钮（同上）
- 文件类型分布表格
- "查看详情"按钮 → 跳转到存储用量详情页（三级）

**并发限制卡片**:
- 当前限制（QPS）
- 近 1 小时峰值 QPS
- 调整限制按钮（同上）

#### 2.3.4 二级页面：账单管理页

**路由**: `/admin/tenants/:tenantId/billing`

**页面布局**:
- **顶部**: 面包屑 + 企业名称 + 统计卡片（4 个）
  - 累计消费、本月消费、待支付金额、逾期金额
- **主体**: 账单列表表格

**账单列表表格**:
- 列：账单编号、账单周期、账单金额、Token 消耗、状态、创建时间、操作
- 状态标签：
  - 已支付（绿色）
  - 未支付（黄色）
  - 已逾期（红色）
  - 已作废（灰色）
- 操作：
  - 查看详情（跳转三级页面）
  - 下载 PDF
  - 标记为已支付（仅未支付状态）
  - 作废账单（需权限）
- 筛选器：时间范围、状态、金额范围
- 批量操作：批量下载、批量标记已支付

#### 2.3.5 二级页面：模型配置页

**路由**: `/admin/tenants/:tenantId/models`

**页面布局**:
- **顶部**: 面包屑 + 企业名称
- **主体**: 模型列表表格

**模型列表表格**:
- 列：模型名称、模型类型、是否启用、Token 单价、调用次数、操作
- 模型类型：文本生成/图像生成/语音合成/语音识别
- 操作：
  - 启用/禁用（Switch）
  - 设置权限（跳转三级页面）
  - 调整单价（Dialog）
- 批量操作：批量启用、批量禁用

#### 2.3.6 二级页面：MCP 审批页

**路由**: `/admin/tenants/:tenantId/mcp`

**页面布局**:
- **顶部**: 面包屑 + 企业名称 + 统计卡片（3 个）
  - 待审批、已通过、已拒绝
- **主体**: MCP 申请列表表格

**MCP 申请列表表格**:
- 列：MCP 名称、申请人、申请时间、状态、操作
- 状态标签：
  - 待审批（黄色）
  - 已通过（绿色）
  - 已拒绝（红色）
- 操作：
  - 查看详情（跳转三级页面）
  - 通过（仅待审批状态）
  - 拒绝（仅待审批状态，需填写拒绝原因）
- 筛选器：状态、申请时间范围

#### 2.3.7 三级页面：Token 用量详情页

**路由**: `/admin/tenants/:tenantId/quota/token-detail`

**页面布局**:
- **顶部**: 面包屑 + 时间范围选择器
- **主体**: 
  - 用量趋势图（可切换日/周/月粒度）
  - 按模型分类的用量表格：
    - 列：模型名称、调用次数、Token 消耗、占比、费用
  - 按用户分类的用量表格：
    - 列：用户名、调用次数、Token 消耗、占比
  - 导出功能：导出为 Excel

#### 2.3.8 三级页面：账单详情页

**路由**: `/admin/tenants/:tenantId/billing/:billId`

**页面布局**:
- **顶部**: 面包屑 + 账单编号 + 状态标签
- **主体**:
  - 账单基本信息卡片：
    - 账单周期、创建时间、支付时间、账单金额
  - 费用明细表格：
    - 列：费用项、数量、单价、小计
    - 费用项：Token 消耗、存储费用、并发费用、其他费用
  - 操作按钮：
    - 下载 PDF
    - 标记为已支付
    - 发送账单邮件

#### 2.3.9 三级页面：模型权限设置页

**路由**: `/admin/tenants/:tenantId/models/:modelId/permissions`

**页面布局**:
- **顶部**: 面包屑 + 模型名称
- **主体**:
  - 权限设置表单：
    - 是否启用（Switch）
    - Token 单价（InputNumber）
    - 每日调用限制（InputNumber）
    - 单次请求 Token 上限（InputNumber）
    - 允许的用户角色（CheckboxGroup）
  - 保存按钮

#### 2.3.10 三级页面：MCP 详情页

**路由**: `/admin/tenants/:tenantId/mcp/:mcpId`

**页面布局**:
- **顶部**: 面包屑 + MCP 名称 + 状态标签
- **主体**:
  - MCP 基本信息：
    - MCP 名称、描述、申请人、申请时间
  - MCP 配置信息（JSON 格式展示）：
    - 工具列表、权限范围、回调地址
  - 审批记录：
    - 审批人、审批时间、审批结果、审批意见
  - 操作按钮（仅待审批状态）：
    - 通过（绿色按钮）
    - 拒绝（红色按钮，需填写拒绝原因）

---

## 三、数据模型补充

### 3.1 租户表（tenants）新增字段

```typescript
interface Tenant {
  // ... 原有字段
  shortName?: string;              // 企业简称
  industry: string;                // 行业类型
  companySize: string;             // 企业规模
  country: string;                 // 国家
  province?: string;               // 省份
  city?: string;                   // 城市
  timezone: string;                // 时区
  logoUrl?: string;                // Logo URL
  contactName: string;             // 联系人姓名
  contactPosition?: string;        // 联系人职位
  contactEmail: string;            // 联系邮箱
  contactPhone: string;            // 联系电话
  backupEmail?: string;            // 备用邮箱
  planType: 'free' | 'standard' | 'professional' | 'enterprise'; // 套餐类型
  billingMode: 'pay_as_you_go' | 'annual' | 'monthly'; // 计费模式
  tokenQuota: number;              // Token 配额
  quotaWarningThreshold: number;   // 配额预警阈值（百分比）
  qpsLimit: number;                // 并发请求限制
  storageQuota: number;            // 存储空间配额（字节）
  serviceStartDate: Date;          // 服务开始日期
  serviceEndDate: Date;            // 服务结束日期
  mcpEnabled: boolean;             // 是否启用 MCP
  dataIsolationLevel: 'logical' | 'physical'; // 数据隔离级别
  internalNotes?: string;          // 内部备注
}
```

### 3.2 配额调整记录表（quota_adjustments）

```typescript
interface QuotaAdjustment {
  id: string;
  tenantId: string;
  quotaType: 'token' | 'storage' | 'qps'; // 配额类型
  oldValue: number;                // 调整前的值
  newValue: number;                // 调整后的值
  reason: string;                  // 调整原因
  operatorId: string;              // 操作人 ID
  operatorName: string;            // 操作人姓名
  createdAt: Date;
}
```

### 3.3 账单表（bills）

```typescript
interface Bill {
  id: string;
  billNumber: string;              // 账单编号，格式：BILL_YYYYMMDD_XXXX
  tenantId: string;
  billingPeriodStart: Date;        // 账单周期开始
  billingPeriodEnd: Date;          // 账单周期结束
  totalAmount: number;             // 账单总金额（分）
  tokenConsumption: number;        // Token 消耗量
  status: 'unpaid' | 'paid' | 'overdue' | 'voided'; // 状态
  paidAt?: Date;                   // 支付时间
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.4 账单明细表（bill_items）

```typescript
interface BillItem {
  id: string;
  billId: string;
  itemType: 'token' | 'storage' | 'qps' | 'other'; // 费用项类型
  itemName: string;                // 费用项名称
  quantity: number;                // 数量
  unitPrice: number;               // 单价（分）
  subtotal: number;                // 小计（分）
}
```

### 3.5 MCP 申请表（mcp_applications）

```typescript
interface McpApplication {
  id: string;
  tenantId: string;
  mcpName: string;                 // MCP 名称
  mcpDescription: string;          // MCP 描述
  mcpConfig: object;               // MCP 配置（JSON）
  applicantId: string;             // 申请人 ID
  applicantName: string;           // 申请人姓名
  status: 'pending' | 'approved' | 'rejected'; // 状态
  reviewerId?: string;             // 审批人 ID
  reviewerName?: string;           // 审批人姓名
  reviewedAt?: Date;               // 审批时间
  reviewComment?: string;          // 审批意见
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 四、技术实现建议

### 4.1 前端路由配置

```typescript
// app/admin/tenants/layout.tsx
export default function TenantsLayout({ children }) {
  return <div className="container mx-auto py-6">{children}</div>;
}

// 路由结构
// app/admin/tenants/page.tsx - 租户列表（一级）
// app/admin/tenants/[tenantId]/detail/page.tsx - 企业详情（二级）
// app/admin/tenants/[tenantId]/quota/page.tsx - 配额管理（二级）
// app/admin/tenants/[tenantId]/quota/token-detail/page.tsx - Token 详情（三级）
// app/admin/tenants/[tenantId]/billing/page.tsx - 账单管理（二级）
// app/admin/tenants/[tenantId]/billing/[billId]/page.tsx - 账单详情（三级）
// app/admin/tenants/[tenantId]/models/page.tsx - 模型配置（二级）
// app/admin/tenants/[tenantId]/models/[modelId]/permissions/page.tsx - 模型权限（三级）
// app/admin/tenants/[tenantId]/mcp/page.tsx - MCP 审批（二级）
// app/admin/tenants/[tenantId]/mcp/[mcpId]/page.tsx - MCP 详情（三级）
```

### 4.2 状态管理建议

使用 Zustand 管理全局状态：

```typescript
// stores/tenant-store.ts
interface TenantStore {
  currentTenant: Tenant | null;
  setCurrentTenant: (tenant: Tenant) => void;
  clearCurrentTenant: () => void;
}

export const useTenantStore = create<TenantStore>((set) => ({
  currentTenant: null,
  setCurrentTenant: (tenant) => set({ currentTenant: tenant }),
  clearCurrentTenant: () => set({ currentTenant: null }),
}));
```

### 4.3 API 接口设计

```typescript
// 创建租户
POST /api/admin/tenants
Body: CreateTenantDto

// 获取租户列表
GET /api/admin/tenants?page=1&pageSize=20&status=active

// 获取租户详情
GET /api/admin/tenants/:tenantId

// 更新租户信息
PATCH /api/admin/tenants/:tenantId
Body: UpdateTenantDto

// 调整配额
POST /api/admin/tenants/:tenantId/quota/adjust
Body: { quotaType, newValue, reason }

// 获取账单列表
GET /api/admin/tenants/:tenantId/bills?page=1&pageSize=20

// 获取账单详情
GET /api/admin/tenants/:tenantId/bills/:billId

// 标记账单已支付
POST /api/admin/tenants/:tenantId/bills/:billId/mark-paid

// 获取 MCP 申请列表
GET /api/admin/tenants/:tenantId/mcp?status=pending

// 审批 MCP
POST /api/admin/tenants/:tenantId/mcp/:mcpId/review
Body: { action: 'approve' | 'reject', comment?: string }
```

---

## 五、工作量估算

| 模块 | 工作内容 | 预估工时（人天） |
|-----|---------|----------------|
| 开通企业表单 | 4 区块表单 + 验证 + 提交逻辑 | 3 |
| 企业列表增强 | 操作列 + 批量操作 | 2 |
| 企业详情页 | 5 个 Tab + 数据展示 | 5 |
| 配额管理页 | 3 个配额卡片 + 调整功能 | 3 |
| 账单管理页 | 账单列表 + 筛选 + 批量操作 | 3 |
| 模型配置页 | 模型列表 + 启用/禁用 | 2 |
| MCP 审批页 | 申请列表 + 审批功能 | 2 |
| Token 用量详情页 | 趋势图 + 分类表格 | 2 |
| 账单详情页 | 账单信息 + 费用明细 | 2 |
| 模型权限设置页 | 权限表单 | 1 |
| MCP 详情页 | MCP 信息 + 审批操作 | 1 |
| 后端 API | 11 个接口 + 数据库操作 | 8 |
| 测试 | 单元测试 + 集成测试 | 4 |
| **总计** | | **38 人天** |

---

## 六、验收标准

### 6.1 功能验收

- [ ] 开通企业表单所有字段正常工作，验证规则生效
- [ ] 提交后成功创建租户，发送通知邮件，跳转到详情页
- [ ] 企业列表所有操作按钮正常跳转
- [ ] 批量操作功能正常
- [ ] 所有二级页面正常展示数据
- [ ] 所有三级页面正常展示数据
- [ ] 配额调整功能正常，记录审计日志
- [ ] 账单管理功能正常，支持筛选和导出
- [ ] MCP 审批功能正常，状态流转正确

### 6.2 性能验收

- [ ] 租户列表加载时间 < 1s（1000 条数据）
- [ ] 详情页加载时间 < 500ms
- [ ] 图表渲染时间 < 300ms

### 6.3 兼容性验收

- [ ] Chrome/Edge/Safari 最新版本正常显示
- [ ] 响应式布局在 1920x1080 和 1366x768 分辨率下正常

---

## 七、风险与依赖

### 7.1 风险

- **数据量大时的性能问题**: 租户数量超过 10000 时，列表加载可能变慢
  - **缓解措施**: 使用虚拟滚动 + 服务端分页 + Redis 缓存

- **账单计算准确性**: Token 消耗统计可能存在误差
  - **缓解措施**: 使用事务保证数据一致性，定期对账

### 7.2 依赖

- **邮件服务**: 需要配置 SMTP 服务器用于发送通知邮件
- **文件存储**: 需要 OSS 服务存储企业 Logo 和账单 PDF
- **图表库**: 使用 Recharts 或 ECharts 绘制趋势图

---

## 八、后续迭代方向

1. **智能配额推荐**: 基于历史用量数据，AI 推荐合理的配额值
2. **账单预测**: 根据当前用量趋势，预测本月账单金额
3. **异常检测**: 自动检测异常用量（如突然激增），发送预警
4. **多租户对比**: 支持选择多个租户进行用量对比分析
5. **自动化运营**: 配额不足时自动发送续费提醒，到期前自动发送续约邮件
