# 【第 5 步】节点配置面板：HTTP / Knowledge / Iteration / Loop

请生成以下 4 个节点配置面板组件，380px 宽右侧抽屉。

---

## 面板 1：HTTP Request 节点配置面板

Header：红色（#EF4444）背景，Globe 图标，"HTTP 请求" 标题，"HTTP" 徽章

**参数配置 Tab：**

1. 请求方法 + URL（同行）
   - 方法 Select（w-24）：GET / POST / PUT / DELETE / PATCH / HEAD
   - URL Input（flex-1）：placeholder "https://api.example.com/endpoint"
   - 下方："导入 cURL" 幽灵按钮

2. 认证方式
   - Select：无认证 / Basic Auth / Bearer Token / API Key
   - 条件显示：
     - Bearer Token → Token Input
     - Basic Auth → 用户名 Input + 密码 Input（type=password）
     - API Key → Header 名称 Input + API Key 值 Input

3. 请求头（Headers）
   - Key-Value 列表，每行：[Key Input（w-32）] [Value Input（flex-1）] [删除]
   - "添加" 按钮

4. 查询参数（Params）
   - 同 Headers 结构

5. 请求体（Body）
   - Select：无 / form-data / x-www-form-urlencoded / raw
   - raw 时：格式 Select（JSON/XML/text）+ Textarea（font-mono，min-h-[80px]）
   - form-data / x-www-form-urlencoded：Key-Value 列表

6. 高级设置
   - SSL 验证：Switch
   - 超时时间（秒）：Input（type=number，默认 10）

**输出变量 Tab（只读）：**
- `body`（string）
- `status_code`（number）
- `headers`（object）
- `files`（array[file]）

---

## 面板 2：Knowledge Retrieval 节点配置面板

Header：青色（#06B6D4）背景，BookOpen 图标，"知识检索" 标题，"Knowledge" 徽章

**参数配置 Tab：**

1. 查询变量
   - VarReferencePicker（变量选择器）

2. 查询附件变量（可选）
   - VarReferencePicker，placeholder "选择文件变量（可选）"

3. 知识库（多选）
   - Checkbox 列表，每项：[Checkbox] [知识库名称] [文档数量灰色文字]
   - 选中时边框高亮

4. 检索模式
   - 分段控件：单一 / 多路 / 混合
   - 多路/混合时显示：Reranker 模型 Select

5. 元数据过滤（可折叠）
   - AND/OR 切换 + 条件行列表

6. Top-K
   - Input（type=number，1-20）

**输出变量 Tab（只读）：**
- `result`（array[object]）— 检索结果列表
- `result_str`（string）— 拼接后的文本

---

## 面板 3：Iteration 容器节点配置面板

Header：蓝色（#3B82F6）背景，RefreshCw 图标，"迭代" 标题，"Iteration" 徽章

**内容（单页，无 Tab）：**

1. 输入数组变量
   - VarReferencePicker
   - 提示文字："迭代器将遍历此数组的每个元素"

2. 并行执行
   - 标题 + 描述（"同时处理多个迭代项"）+ Switch
   - 开启后显示：最大并行数 Slider（1-100）+ 数字 Input

3. 错误处理策略（单选卡片组）
   - **终止迭代**：遇到错误立即停止整个迭代
   - **继续执行**：跳过错误项，继续处理其余项
   - **移除异常输出**：从输出数组中移除失败项
   - 每个选项：单选圆圈 + 标题 + 描述，选中时 primary 边框 + 浅色背景

4. 展平输出
   - 标题 + 描述（"将嵌套数组展平为一维数组"）+ Switch

---

## 面板 4：Loop 容器节点配置面板

Header：紫色（#8B5CF6）背景，Repeat 图标，"循环" 标题，"Loop" 徽章

**内容（单页，无 Tab）：**

1. 循环变量列表
   - 每行：[变量名 Input（w-24）] [类型 Select（string/number/boolean/array/object，w-24）] [初始值 Input（flex-1）] [删除]
   - "添加" 按钮

2. 退出条件
   - AND/OR 切换按钮
   - 条件行：[变量 Select] [运算符 Select（等于/不等于/大于/小于/大于等于/小于等于）] [值 Input] [删除]
   - "添加条件" 幽灵按钮

3. 最大循环次数
   - 标签 + Input（type=number，默认 100，min=1，max=1000）

Footer：重置 + 保存
