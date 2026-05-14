# 【第 6 步】节点配置面板：Agent / Answer / End / QC / PE / Template / Assigner / HumanInput / Trigger

请生成以下 9 个节点配置面板组件，380px 宽右侧抽屉。

---

## 面板 1：Agent 节点配置面板

Header：靛蓝色（#6366F1）背景，Bot 图标，"Agent" 标题，"Agent" 徽章

**参数配置 Tab：**
1. Agent 策略：分段控件 "Function Calling" / "ReAct"
2. 模型：Select（GPT-4o / Claude Sonnet 4.6 / Gemini 1.5 Pro）
3. 工具（多选 Checkbox 卡片）：工具名 + 描述，选中高亮边框
4. 最大执行步数：Slider（1-20）+ 当前值显示
5. 记忆（Chatflow 专属）：Switch + 历史消息数量 Input（开启后显示）
6. 高级设置（折叠）：RetryConfig + ErrorHandleConfig

**输出变量 Tab：**
- 动态字段列表：[字段名 Input] [类型 Select] [删除]，"添加输出字段" 按钮

---

## 面板 2：Answer 节点配置面板（Chatflow 专属）

Header：蓝色（#2970FF）背景，MessageSquare 图标，"回复" 标题，"Chatflow 专属" 蓝色徽章

**内容（单页）：**

1. 回复内容编辑器
   - 顶部变量工具栏（gray-50 背景）：
     - "插入变量：" 标签
     - 变量 chip 按钮（sys.query 蓝色 / llm1.text 紫色 / node1.output 绿色）
     - "+ 更多" 按钮
   - Textarea（min-h-[160px]），placeholder "输入回复内容，使用 {{变量名}} 插入变量..."
   - 提示文字："支持 Markdown 格式，使用 {{变量名}} 引用变量"
   - 点击变量 chip 时，在光标位置插入 `{{变量名}}`

2. 文件变量（可选）
   - 虚线边框区域 + "选择变量" 按钮

---

## 面板 3：End 节点配置面板

Header：灰色（#6B7280）背景，Square 图标，"结束" 标题，"End" 徽章

**内容（单页）：**
- 说明文字："定义工作流的最终输出，可在运行结果中查看"
- 输出变量映射列表：[输出名称 Input（w-28）] [变量引用 Select（flex-1）] [删除]
- "添加" 按钮

---

## 面板 4：QuestionClassifier 节点配置面板

Header：琥珀色（#F59E0B）背景，HelpCircle 图标，"问题分类" 标题，"Classifier" 徽章

**内容：**
1. 查询变量：VarReferencePicker
2. 模型：Select
3. 分类列表（可拖拽排序）：
   - 每项：[GripVertical] [序号徽章] [分类名 Input] [删除] + [描述 Input（下一行）]
   - "添加分类" 按钮
4. 自定义指令（可折叠）：Textarea

---

## 面板 5：ParameterExtractor 节点配置面板

Header：琥珀色（#F59E0B）背景，Sliders 图标，"参数提取" 标题，"Extractor" 徽章

**内容：**
1. 输入文本变量：VarReferencePicker
2. 模型：Select
3. 参数列表（每项为卡片）：
   - [参数名 Input] [类型 Select（string/number/boolean/array/object）] [删除]
   - [描述 Input]
   - [必填 Switch]
   - "添加参数" 按钮
4. 自定义指令（可折叠）：Textarea

---

## 面板 6：TemplateTransform 节点配置面板

Header：琥珀色（#F59E0B）背景，FileText 图标，"模板转换" 标题，"Jinja2" 徽章

**内容：**
1. 输入变量列表：[变量名 Input（w-24）] [变量引用 Select（flex-1）] [删除]，"添加" 按钮
2. Jinja2 模板编辑器：font-mono Textarea（min-h-[160px]）
   - 提示："支持 Jinja2 语法：{{var}} 变量、{% if %}...{% endif %} 条件"
3. 输出变量（只读）：`output`（string）

---

## 面板 7：VariableAssigner 节点配置面板

Header：灰蓝色（#64748B）背景，ArrowLeftRight 图标，"变量赋值" 标题，"Assigner" 徽章

**内容：**
- 说明框（blue-50）："将源变量的值赋给目标变量（对话变量或环境变量）"
- 赋值规则列表：
  - 每行：[目标变量 Select（conversation.*/env.*）] [→ 图标] [源变量 Select] [删除]
  - "添加" 按钮

---

## 面板 8：HumanInput 节点配置面板

Header：蓝色（#2970FF）背景，UserCheck 图标，"人工输入" 标题，"Human" 徽章

**内容：**
1. 提示内容：Textarea（min-h-[100px]），支持 {{变量}} 插值
2. 超时时间（秒）：Input（0 = 不限时）
3. 输入字段列表（每项为卡片）：
   - [字段标签 Input] [类型 Select（string/number/boolean/select）] [删除]
   - [字段名 Input] [必填 Switch]
   - "添加字段" 按钮
4. 通知方式：分段控件 "邮件" / "Webhook"
   - 邮件 → 邮箱 Input
   - Webhook → URL Input

---

## 面板 9：Trigger 节点配置面板（两种）

### TriggerWebhook（Webhook 触发）

Header：橙色（#F97316）背景，Webhook 图标，"Webhook 触发" 标题，"Trigger" 徽章

内容：
- 说明框（orange-50）
- Webhook URL：只读 Input + 复制按钮（点击后图标变为 Check，2 秒后恢复）
- 请求方法：只读 "POST"
- 输出变量（只读）：body / headers / query（均为 object）
- "发送测试请求" outline 按钮

### TriggerSchedule（定时触发）

Header：橙色（#F97316）背景，Clock 图标，"定时触发" 标题，"Schedule" 徽章

内容：
- 执行频率 Select：每分钟 / 每小时 / 每天9:00 / 每周一9:00 / 每月1日9:00 / 自定义
- 自定义时显示：Cron 表达式 Input（font-mono）+ 5 字段标签（分钟/小时/日/月/星期）
- 当前 Cron 表达式：gray-50 展示框
- 时区 Select：Asia/Shanghai / UTC / America/New_York / Europe/London
- 下次执行时间：只读 Input

Footer：重置 + 保存（Webhook 面板无 Footer）
