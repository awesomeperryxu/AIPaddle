在工作流编辑器中，请完善右侧节点配置面板和底部运行调试面板。

## 右侧配置面板（w-96, bg-card, border-l）

点击画布上的节点后，从右侧滑出配置面板。

### 通用结构
- 顶部固定：节点色条(h-1) + 图标 + 名称 Input + 描述 Input + 关闭按钮(X)
- 中间可滚动：配置表单
- 底部固定：错误处理 Select（none/fail-branch/default-value）+ 重试开关

### LLM 节点面板
- 模型选择器：Provider 下拉 + Model 下拉 + 参数按钮(Settings)
- Prompt 编辑区：Tab 切换（System/User/Assistant）+ Textarea（支持 {{variable}} 高亮）
- Memory 折叠区：开关 + 窗口大小 Input
- Vision 折叠区：开关 + 分辨率 Select（low/high/auto）
- 结构化输出折叠区：开关 + JSON Schema 树形编辑器
- 输出变量列表（只读，text-xs）

### IF/ELSE 节点面板
- 条件列表（可添加多个 Case）
- 每个 Case：逻辑运算符切换按钮（AND/OR）
- 每个条件行：变量 Select + 运算符 Select + 值 Input + 删除按钮
- 添加条件按钮 + 添加 ELIF 按钮
- ELSE 分支（始终存在，灰色标签）

### HTTP 节点面板
- 方法 Select（GET/POST/PUT/DELETE）+ URL Input（支持变量）
- Tab 切换：Params / Headers / Body / Auth / Settings
- Key-Value 编辑器（每行：Key Input + Value Input + 删除按钮 + 添加行按钮）
- Body 类型 Select + 对应编辑器
- CURL 导入按钮 → Dialog（Textarea 粘贴 CURL）

### Code 节点面板
- 语言 Select（Python3/JavaScript）
- 输入变量映射列表
- 代码编辑器（深色背景，等宽字体，行号）
- 输出变量定义列表

### Knowledge Retrieval 节点面板
- 查询变量 Select
- 知识库列表 + 添加按钮
- 检索模式 Radio（单路/多路）
- Top-K 滑块 + Score 阈值 Input

## 底部运行调试面板（从底部滑出，高度 40%，可拖拽调整）

### 触发方式
点击顶部工具栏的运行按钮后展开

### 顶部栏
- 左侧：运行状态 Badge（Running=蓝色动画/Succeeded=绿/Failed=红）+ 耗时
- 右侧：折叠按钮 + 关闭按钮

### Tab 切换：RESULT / DETAIL / TRACING

**RESULT Tab**：
- 输出变量列表：变量名(font-mono) + 类型 Badge + 值（代码块展示）

**DETAIL Tab**：
- 信息卡片：总耗时、Token 消耗(input/output)、执行状态、触发方式

**TRACING Tab**：
- 节点执行时间线（垂直列表）：每个节点一行
- 每行：状态圆点 + 节点图标 + 名称 + 耗时条（宽度按比例）+ 时间文字
- 点击展开：输入/输出变量值

## 变量检查面板（底部，与调试面板并列 Tab）
- 左侧（w-48）：变量分组列表（按节点分组）
- 右侧：选中变量的 JSON 格式化展示
