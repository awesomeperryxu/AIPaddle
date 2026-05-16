在当前项目中，请生成"开通企业"流程页面。这是平台管理员为新企业开通 SaaS 服务的完整表单流程。

## 触发方式
点击租户管理页面的"开通企业"按钮，打开全屏 Sheet（从右侧滑出，宽度 640px）

## Sheet 布局

### 顶部
- 标题"开通新企业"
- 副标题"填写企业信息并配置服务套餐"
- 关闭按钮(X)

### 内容区（ScrollArea，垂直排列 4 个表单区块，每个区块用 Card 包裹）

---

#### 区块 1：企业基本信息

Card 标题："企业基本信息"（带 Building2 图标）

表单字段（grid grid-cols-2 gap-4）：
- 企业名称（Input，必填，col-span-2）
- 企业编码（Input，自动生成，可修改）
- 企业简称（Input）
- 行业类型（Select：制造/金融/零售/科技/教育/医疗/其他）
- 企业规模（Select：1-50人/51-200人/201-1000人/1000人以上）
- 国家/地区（Select）
- 时区（Select：UTC+8 北京 等）
- 企业 Logo（文件上传区域，虚线边框，支持拖拽，显示预览）

---

#### 区块 2：联系人信息

Card 标题："管理员联系人"（带 User 图标）

表单字段（grid grid-cols-2 gap-4）：
- 联系人姓名（Input，必填）
- 职位（Input）
- 邮箱（Input type="email"，必填，用于登录）
- 联系电话（Input）

---

#### 区块 3：套餐与配额

Card 标题："套餐与配额"（带 CreditCard 图标）

套餐选择（grid grid-cols-4 gap-3，卡片单选）：
每张套餐卡片（border rounded-lg p-4 cursor-pointer，选中态 ring-2 ring-primary border-primary）：
- 套餐名（font-semibold）
- 价格（text-xl font-bold）
- 特性列表（text-xs text-muted-foreground，3-4 条）

4 种套餐：
1. 试用版：¥0/月，100K Token，1 Agent，1GB 存储
2. 基础版：¥450/月，3M Token，3 Agent，10GB 存储
3. 专业版：¥1,560/月，8M Token，10 Agent，50GB 存储
4. 企业版：¥2,890+/月，自定义 Token，无限 Agent，无限存储

其他配置字段：
- 计费模式（RadioGroup：按量付费 / 包年包月）
- 初始 Token 配额（Input type="number" + 单位 Select：K/M/B）
- 配额预警阈值（Slider，默认 80%，显示当前值）
- 并发请求限制 QPS（Input type="number"，默认 100）
- 存储空间配额（Input type="number" + 单位 Select：GB/TB）

---

#### 区块 4：高级设置

Card 标题："高级设置"（带 Settings 图标）

表单字段：
- 服务有效期（两个日期 Input：开始日期 ~ 结束日期）
- 是否启用 MCP（Switch 开关 + 说明文字"允许租户使用 MCP 协议连接外部工具"）
- 数据隔离级别（RadioGroup：逻辑隔离(推荐) / 物理隔离(企业版专属)）
- 备注信息（Textarea，4 行）

---

### 底部固定操作栏（border-t p-4 bg-card）
- 左侧：步骤指示（"第 1 步，共 1 步"或进度条）
- 右侧：取消按钮(variant="outline") + 提交按钮(primary, "开通企业")

### 提交成功 Dialog
- 绿色 CheckCircle 图标
- 标题"企业开通成功"
- 信息：企业名称 + 管理员邮箱 + 套餐类型
- 提示"激活邮件已发送至管理员邮箱"
- 按钮：查看租户详情 / 返回列表
