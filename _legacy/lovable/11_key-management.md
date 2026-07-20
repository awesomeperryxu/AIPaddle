在当前项目中，请生成"Key 管理"页面。这是平台管理员管理 API Key 的页面。

## 页面信息
- 页面标题：Key 管理
- 副标题：管理平台 API 密钥和访问凭证
- 路径：点击侧边栏"平台管理 > Key 管理"

## 页面布局（垂直堆叠 space-y-6）

### Header
- 左侧：标题 + 副标题
- 右侧：创建 API Key 按钮（Plus 图标 + "创建 Key"）

### 统计卡片（grid grid-cols-4 gap-4）
- 总 Key 数（Key 图标, primary）：12
- 活跃 Key（CheckCircle, success）：8
- 今日调用量（Activity, accent）：3,456
- 即将过期（AlertTriangle, warning）：2

### Tab 切换
- 全部 / 活跃 / 已禁用 / 已过期

### Key 列表（Table 组件）

TableHeader 列：
- Key 名称
- Key 前缀
- 所属租户
- 权限范围
- 调用量（今日）
- 状态
- 创建时间
- 过期时间
- 操作

TableBody 每行：
- Key 名称：font-medium（如 "生产环境 Key"、"测试 Key"）
- Key 前缀：font-mono text-xs bg-muted px-2 py-0.5 rounded（如 "sk-prod-****"）
- 所属租户：租户名
- 权限范围：Badge 列表（如 "Agent调用"、"知识库读取"、"工作流执行"）
- 调用量：数字
- 状态 Badge：active(绿 "活跃") / disabled(灰 "已禁用") / expired(红 "已过期") / expiring(黄 "即将过期")
- 创建时间：日期
- 过期时间：日期（即将过期的显示红色）
- 操作 DropdownMenu：
  - 查看详情（Eye）
  - 复制 Key（Copy）
  - 重新生成（RefreshCw）
  - 编辑权限（Settings）
  - 分隔线
  - 禁用/启用（Ban/CheckCircle）
  - 删除（Trash2, text-destructive）

### 创建 API Key Dialog（DialogContent 宽度 520px）

表单字段：
- Key 名称（Input，必填）
- 所属租户（Select 下拉，选择租户）
- 权限范围（多选 Checkbox 组）：
  - Agent 调用
  - 知识库读取
  - 知识库写入
  - 工作流执行
  - 模型直接调用
  - 管理 API
- 过期时间（Select：30天/90天/180天/1年/永不过期）
- 调用频率限制（Input，次/分钟）
- 备注（Textarea）
- 底部：取消 + 创建按钮

### Key 创建成功 Dialog
- 标题"API Key 创建成功"
- 警告提示（AlertTriangle 黄色）："请立即复制此 Key，关闭后将无法再次查看完整 Key"
- Key 显示区域：font-mono bg-muted p-3 rounded-lg + 复制按钮
- 确认按钮"我已复制"

## Mock 数据
生成 8 个 Key，覆盖不同状态和租户。
