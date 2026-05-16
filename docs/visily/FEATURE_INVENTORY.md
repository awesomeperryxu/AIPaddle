# Workflow/Chatflow 功能清单（源码驱动）

> 基于 `/web/app/components/workflow/` 源码完整提取，覆盖所有子目录与组件。

---

## 1. 节点类型系统

### 1.1 触发器节点（Trigger Nodes）

#### Start（开始节点）
- 源码：`nodes/start/`
- 功能：定义工作流输入变量（用户输入表单）
- 变量类型：text-input、paragraph、select、number、url、files、json、json_object、contexts、checkbox
- 支持文件上传配置（TransferMethod、Resolution）

#### Trigger-Schedule（定时触发器）
- 源码：`nodes/trigger-schedule/`
- 功能：按时间计划自动触发工作流
- 配置：可视化模式（hourly/daily/weekly/monthly）或 cron 表达式
- 支持时区设置、可视化配置（时间/星期/月日）

#### Trigger-Webhook（Webhook 触发器）
- 源码：`nodes/trigger-webhook/`
- 功能：通过 HTTP Webhook 触发工作流
- 配置：HTTP 方法、Content-Type、Headers、Params、Body 参数定义
- 支持异步模式、自定义响应状态码和响应体
- 自动生成 Webhook URL（含调试 URL）

#### Trigger-Plugin（插件触发器）
- 源码：`nodes/trigger-plugin/`
- 功能：通过插件事件触发工作流
- 配置：Provider、事件名称、事件参数、输出 Schema
- 支持版本管理和插件唯一标识

### 1.2 AI/LLM 节点

#### LLM（大语言模型）
- 源码：`nodes/llm/`
- 功能：调用 LLM 进行文本生成
- 配置：模型选择（Provider/Model/Mode）、Prompt 模板（system/user/assistant 多角色）
- 高级功能：Jinja2 模板、Memory 记忆窗口、上下文变量注入、Vision 视觉能力
- 结构化输出：JSON Schema 定义输出格式（object/array/enum 等嵌套类型）
- 推理格式：tagged / separated 两种模式

#### Question Classifier（问题分类器）
- 源码：`nodes/question-classifier/`
- 功能：基于 LLM 将用户问题分类到预定义主题
- 配置：查询变量选择、模型配置、分类列表（Topic[]）、指令说明
- 支持 Memory 和 Vision

#### Parameter Extractor（参数提取器）
- 源码：`nodes/parameter-extractor/`
- 功能：从文本中提取结构化参数
- 配置：模型、查询变量、参数定义（name/type/options/description/required）
- 推理模式：prompt 或 function_call
- 参数类型：string/number/boolean/select/array[string]/array[number]/array[object]/array[boolean]
- 支持 Memory 和 Vision

#### Agent（智能体）
- 源码：`nodes/agent/`
- 功能：调用 Agent 策略执行复杂任务
- 配置：策略 Provider/Name、参数输入、输出 Schema
- 支持 Memory（历史消息）、插件版本管理

### 1.3 数据处理节点

#### Knowledge Retrieval（知识检索）
- 源码：`nodes/knowledge-retrieval/`
- 功能：从知识库检索相关文档
- 检索模式：单路检索（SingleRetrieval）/ 多路检索（MultipleRetrieval）
- 多路检索配置：Top-K、Score 阈值、Reranking 模型、权重配置（向量/关键词）
- 元数据过滤：disabled/automatic/manual 三种模式，支持多条件组合（AND/OR）
- 比较运算符：contains/startWith/is/empty/equal/largerThan 等 20+ 种

#### Knowledge Base（知识索引）
- 源码：`nodes/knowledge-base/`
- 功能：将数据写入知识库（索引构建）
- 配置：Chunk 结构（general/parent_child/question_answer）、索引技术、嵌入模型
- 检索设置：搜索方法、Reranking、Top-K、Score 阈值
- 摘要索引设置：模型选择、摘要 Prompt

#### Document Extractor（文档提取器）
- 源码：`nodes/document-extractor/`
- 功能：从文件中提取文本内容
- 配置：变量选择器、是否为数组文件

#### Data Source（数据源）
- 源码：`nodes/data-source/`
- 功能：通过插件连接外部数据源
- 配置：插件 ID、Provider、数据源名称、参数、文件扩展名过滤

### 1.4 逻辑控制节点

#### IF/Else（条件分支）
- 源码：`nodes/if-else/`
- 功能：基于条件表达式进行分支路由
- 条件系统：多 Case 支持、逻辑运算符（AND/OR）、20+ 比较运算符
- 支持子变量条件（嵌套条件）
- 变量类型感知的比较操作

#### Iteration（迭代）
- 源码：`nodes/iteration/`
- 功能：对数组数据逐项执行子工作流
- 配置：迭代器变量选择、输出选择器、输出类型
- 并行模式：支持并行执行（1-10 并发数）
- 错误处理：terminated / continue-on-error / remove-abnormal-output
- 输出扁平化选项

#### Loop（循环）
- 源码：`nodes/loop/`
- 功能：基于条件的循环执行
- 配置：循环次数上限、中断条件（break_conditions）
- 循环变量：支持定义循环内变量（label/type/value）
- 错误处理模式同 Iteration

#### List Operator（列表操作）
- 源码：`nodes/list-operator/`
- 功能：对列表数据进行过滤、排序、截取
- 过滤：多条件组合过滤
- 提取：按序号提取元素
- 排序：ASC/DESC，支持指定排序键
- 限制：启用/禁用，指定数量

### 1.5 数据操作节点

#### Code（代码执行）
- 源码：`nodes/code/`
- 功能：执行自定义代码
- 语言：Python3、JavaScript、JSON
- 配置：输入变量映射、代码编辑器、输出变量定义（类型声明）

#### Template Transform（模板转换）
- 源码：`nodes/template-transform/`
- 功能：使用 Jinja2 模板转换数据
- 配置：变量列表、模板字符串

#### HTTP Request（HTTP 请求）
- 源码：`nodes/http/`
- 功能：发送 HTTP 请求
- 方法：GET/POST/HEAD/PATCH/PUT/DELETE
- Body 类型：none/form-data/x-www-form-urlencoded/raw-text/json/binary
- 认证：无认证 / API Key（basic/bearer/custom）
- 超时配置：connect/read/write 独立超时
- SSL 验证开关

#### Variable Assigner（变量聚合器）
- 源码：`nodes/variable-assigner/`
- 功能：将多个变量聚合为一个输出
- 支持分组模式（group_enabled）、多组变量聚合

#### Assigner（变量赋值器）
- 源码：`nodes/assigner/`
- 功能：对变量执行写操作
- 写入模式：overwrite/clear/append/extend/set/+=/-=/*=/ /=/remove-first/remove-last
- 输入类型：variable / constant
- 支持多操作批量执行

### 1.6 输出节点

#### Answer（回答）
- 源码：`nodes/answer/`
- 功能：在 Chatflow 中输出流式回答
- 配置：变量列表、回答模板文本

#### End（结束）
- 源码：`nodes/end/`
- 功能：Workflow 模式的终止节点，定义最终输出
- 配置：输出变量列表

### 1.7 人机交互节点

#### Human Input（人工输入）
- 源码：`nodes/human-input/`
- 功能：暂停工作流等待人工审批/输入
- 投递方式：WebApp/Email/Slack/Teams/Discord
- Email 配置：收件人（成员/外部）、主题、正文、调试模式
- 用户操作按钮：自定义按钮（Primary/Default/Accent/Ghost 样式）
- 表单输入项：支持所有 InputVarType 类型
- 超时设置：小时/天

### 1.8 辅助节点

#### Iteration Start / Loop Start / Loop End
- 源码：`nodes/iteration-start/`、`nodes/loop-start/`、`nodes/loop-end/`
- 功能：迭代/循环的内部起止标记节点

#### Data Source Empty
- 源码：`nodes/data-source-empty/`
- 功能：数据源占位节点

---

## 2. 画布交互系统

### 2.1 右键菜单（Context Menus）

#### 画布右键菜单（Panel Contextmenu）
- 源码：`panel-contextmenu.tsx`
- 功能项：添加节点（Block Selector）、粘贴节点、运行工作流/调试预览、添加便签、添加评论、导出 DSL、导入 DSL

#### 节点右键菜单（Node Contextmenu）
- 源码：`node-contextmenu.tsx`、`node-actions-menu/context-menu-content.tsx`
- 功能项：运行此步骤、更换节点类型（Change Block）、复制、复制副本（Duplicate）、删除
- 附加项：打开关联工作流应用、帮助链接

#### 连线右键菜单（Edge Contextmenu）
- 源码：`edge-contextmenu.tsx`
- 功能项：删除连线

#### 多选右键菜单（Selection Contextmenu）
- 源码：`selection-contextmenu.tsx`
- 功能项：对齐操作（上/中/下/左/居中/右）、分布操作（水平均分/垂直均分）
- 对齐类型：Top/Middle/Bottom/Left/Center/Right/DistributeHorizontal/DistributeVertical

### 2.2 快捷键系统（Shortcuts）
- 源码：`shortcuts/definitions.ts`、`shortcuts/use-workflow-hotkeys.ts`
- 编辑操作：Delete/Backspace 删除、Mod+C 复制、Mod+V 粘贴、Mod+D 复制副本
- 历史操作：Mod+Z 撤销、Mod+Y/Mod+Shift+Z 重做
- 模式切换：V 指针模式、H 手型模式、C 评论模式
- 画布操作：Mod+O 自动整理、F 全屏切换、Mod+1 适应画布、Shift+1 缩放100%、Shift+5 缩放50%
- 缩放：Mod+= 放大、Mod+- 缩小
- 运行：Alt+R 打开测试运行菜单
- 其他：Mod+Shift+L 下载导入日志、Shift 高亮当前节点（暗化其他）、版本历史

### 2.3 控制模式（Control Modes）
- 源码：`types.ts` (ControlMode enum)、`operator/control.tsx`
- 指针模式（Pointer）：选择和拖拽节点
- 手型模式（Hand）：平移画布
- 评论模式（Comment）：在画布上放置评论

### 2.4 连线系统（Edges）
- 源码：`custom-edge.tsx`、`custom-connection-line.tsx`、`custom-edge-linear-gradient-render.tsx`
- 自定义连线渲染（线性渐变）
- 连线状态：hovering、bundled、running、waiting
- 连线属性：sourceType/targetType、iteration/loop 归属

### 2.5 辅助线（Help Line）
- 源码：`help-line/`
- 功能：节点拖拽时显示对齐辅助线

### 2.6 候选节点（Candidate Node）
- 源码：`candidate-node.tsx`、`candidate-node-main.tsx`
- 功能：从连接点拖出时显示的待添加节点预览

---

## 3. 面板系统

### 3.1 节点配置面板（Node Panel）
- 源码：`panel/index.tsx`、`nodes/_base/components/`
- 功能：选中节点后右侧展开配置面板
- 通用组件：
  - 标题描述输入（title-description-input）
  - 变量引用选择器（var-reference-picker）：支持搜索、路径展示、类型匹配
  - 输入字段（input-field）：支持变量插入的文本输入
  - 代码编辑器（editor）
  - 模型选择器
  - 错误处理配置（error-handle）：none / fail-branch / default-value
  - 重试配置（retry）：max_retries、retry_interval、retry_enabled
  - 下一步连接（next-step）：添加/管理后续节点连接
  - 运行前表单（before-run-form）：单步运行时的输入表单
  - Vision 配置（config-vision）
  - Memory 配置（memory-config）
  - 文件上传设置（file-upload-setting）
  - 折叠面板（collapse）
  - Agent 策略选择器（agent-strategy-selector）
  - 插件版本切换（switch-plugin-version）
  - 安装插件按钮（install-plugin-button）
  - 输出变量展示（output-vars）
  - 变量标签（variable-tag）
  - 节点控制（node-control）：节点句柄、缩放器
  - 提示词编辑器（prompt）

### 3.2 运行调试面板（Run Panel）
- 源码：`run/`
- 标签页：RESULT（结果）/ DETAIL（详情）/ TRACING（追踪）
- 结果面板（result-panel）：展示运行输出
- 输出面板（output-panel）：格式化输出展示
- 追踪面板（tracing-panel）：节点执行链路追踪
- 状态展示（status）：运行状态、耗时、执行者信息
- 特殊日志：Agent 日志（agent-log）、迭代日志（iteration-log）、循环日志（loop-log）、重试日志（retry-log）
- 循环结果面板（loop-result-panel）
- 并行 ID 悬停检测（get-hovered-parallel-id）

### 3.3 调试与预览面板（Debug & Preview）
- 源码：`panel/debug-and-preview/`
- 功能：Chatflow 模式的对话调试
- 组件：聊天包装器（chat-wrapper）、用户输入表单（user-input）
- 会话变量弹窗（conversation-variable-modal）
- 可调整宽度（拖拽缩放）
- 重启对话功能

### 3.4 变量检查面板（Variable Inspect Panel）
- 源码：`variable-inspect/`
- 功能：实时查看工作流运行时变量值
- 组件：触发器（trigger）、面板（panel）、分组展示（group）
- 左右分栏：变量列表（left）/ 值内容（right）
- 值内容展示：代码/预览切换（ViewMode: code/preview）、Markdown/Chunks 预览
- 大数据告警（large-data-alert）
- 监听状态指示（listening）
- 可调整高度（垂直拖拽缩放）
- 事件：EVENT_WORKFLOW_STOP 停止监听

### 3.5 环境变量面板（Env Panel）
- 源码：`panel/env-panel/`
- 功能：管理工作流环境变量
- 变量类型：string / number / secret
- 组件：变量列表（env-item）、变量编辑弹窗（variable-modal）、触发按钮（variable-trigger）
- Header 入口：EnvButton

### 3.6 会话变量面板（Chat Variable Panel）
- 源码：`panel/chat-variable-panel/`
- 功能：管理 Chatflow 会话级变量
- 变量类型：Number/String/Boolean/Object/Array[String]/Array[Number]/Array[Boolean]/Array[Object]
- Header 入口：ChatVariableButton

### 3.7 全局变量面板（Global Variable Panel）
- 源码：`panel/global-variable-panel/`
- 功能：管理工作流全局变量
- 变量类型：string / number / integer
- Header 入口：GlobalVariableButton

### 3.8 版本历史面板（Version History Panel）
- 源码：`panel/version-history-panel/`
- 功能：查看和恢复工作流历史版本
- 组件：版本列表项（version-history-item）、操作菜单（action-menu）、筛选器（filter）
- 操作：恢复确认弹窗（restore-confirm-modal）、删除确认弹窗（delete-confirm-modal）
- 加载状态（loading）、空状态（empty）

### 3.9 评论面板（Comments Panel）
- 源码：`panel/comments-panel/`
- 功能：查看画布上所有评论的列表视图

### 3.10 聊天记录面板（Chat Record）
- 源码：`panel/chat-record/`
- 功能：查看历史对话记录
- 组件：用户输入展示（user-input）

### 3.11 人工输入表单
- 源码：`panel/human-input-form-list.tsx`、`panel/human-input-filled-form-list.tsx`
- 功能：展示人工输入节点的表单和已填写表单

---

## 4. Header 功能区

### 4.1 Header 模式
- 源码：`header/index.tsx`
- 三种模式：Normal（正常编辑）/ ViewHistory（查看历史）/ Restoring（恢复中）

### 4.2 正常模式 Header（Header In Normal）
- 源码：`header/header-in-normal.tsx`
- 左侧：编辑标题（EditingTitle）、在线用户（OnlineUsers）
- 中间：可自定义组件插槽
- 右侧：环境变量按钮、全局变量按钮、会话变量按钮、版本历史按钮、运行与历史

### 4.3 运行与历史（Run & History）
- 源码：`header/run-and-history.tsx`
- 运行按钮（RunMode）/ 预览按钮（PreviewMode）
- 查看历史（ViewHistory）
- 检查清单（Checklist）

### 4.4 测试运行菜单（Test Run Menu）
- 源码：`header/test-run-menu.tsx`、`header/run-mode.tsx`
- 触发类型：UserInput / Schedule / Webhook / Plugin / All
- 快捷键：Alt+R 打开菜单
- 运行中状态：显示停止按钮
- 验证：运行前检查 Checklist 警告节点

### 4.5 检查清单（Checklist）
- 源码：`header/checklist/`
- 功能：检测工作流配置问题
- 分类：插件缺失项（plugin-group）、节点配置问题（node-group）
- 交互：点击跳转到问题节点

### 4.6 撤销/重做（Undo/Redo）
- 源码：`header/undo-redo.tsx`
- 基于 zustand temporal 状态管理
- 按钮禁用状态感知（pastStates/futureStates）

### 4.7 版本历史按钮
- 源码：`header/version-history-button.tsx`
- 快捷键提示、触发版本历史面板

### 4.8 在线用户（Online Users）
- 源码：`header/online-users.tsx`
- 显示当前在线协作用户头像列表
- 点击用户跳转到其光标位置
- 用户颜色标识

### 4.9 滚动到选中节点
- 源码：`header/scroll-to-selected-node-button.tsx`
- 功能：快速定位到当前选中的节点

---

## 5. 协作功能（Collaboration）

### 5.1 实时协作系统
- 源码：`collaboration/`
- 架构：WebSocket 连接管理（core/websocket）、协作管理器（core/collaboration-manager）

### 5.2 在线用户感知
- 类型：OnlineUser（user_id/username/avatar/sid）
- 功能：实时显示在线编辑者

### 5.3 光标同步
- 源码：`collaboration/components/user-cursors.tsx`
- 类型：CursorPosition（x/y/userId/timestamp）
- 功能：实时显示其他用户的鼠标位置
- 可切换显示/隐藏（showUserCursors）

### 5.4 节点面板占用感知
- 类型：NodePanelPresenceMap
- 功能：显示哪个用户正在编辑哪个节点

### 5.5 协作事件类型
- mouse_move：光标移动
- workflow_update：工作流图更新
- vars_and_features_update：变量和功能更新
- comments_update：评论更新
- node_panel_presence：节点面板占用
- app_state_update / app_meta_update：应用状态/元数据更新
- sync_request / graph_resync_request：同步请求
- workflow_restore_intent / workflow_restore_complete：版本恢复意图/完成
- workflow_history_action：历史操作
- app_publish_update：发布更新
- mcp_server_update：MCP 服务器更新

---

## 6. 操作工具栏（Operator）

### 6.1 工具栏布局
- 源码：`operator/index.tsx`
- 位置：画布底部左侧
- 包含：缩放控件、撤销重做、变量检查面板、MiniMap

### 6.2 控制面板（Control）
- 源码：`operator/control.tsx`
- 按钮：添加节点、指针模式、手型模式、评论模式、添加便签、自动整理、全屏切换、更多操作

### 6.3 缩放控件（Zoom In/Out）
- 源码：`operator/zoom-in-out.tsx`
- 功能：缩放百分比显示、预设缩放级别（25%/50%/75%/100%/200%）、适应画布
- 切换项：MiniMap 显示/隐藏、用户光标显示/隐藏、用户评论显示/隐藏

### 6.4 更多操作（More Actions）
- 源码：`operator/more-actions.tsx`
- 导出图片：PNG / JPEG / SVG 格式
- 导出范围：当前视口 / 完整工作流
- 图片预览功能

### 6.5 添加节点（Add Block）
- 源码：`operator/add-block.tsx`
- 触发 Block Selector 弹窗

---

## 7. 节点选择器（Block Selector）

### 7.1 选择器系统
- 源码：`block-selector/`
- 标签页：Start（触发器）/ Blocks（节点）/ Tools（工具）/ Sources（数据源）

### 7.2 节点分类
- 问题理解（QuestionUnderstand）
- 逻辑控制（Logic）
- 数据转换（Transform）
- 工具（Utilities）

### 7.3 工具类型
- All / BuiltIn / Custom / Workflow / MCP

### 7.4 组件
- 搜索过滤、索引栏（index-bar）、视图类型切换（view-type-select）
- 精选工具（featured-tools）、精选触发器（featured-triggers）
- 工具选择器（tool-picker）、数据源选择器（data-sources）
- 插件市场入口（market-place-plugin）
- RAG 工具推荐（rag-tool-recommendations）
- 粘性滚动（use-sticky-scroll）、垂直滚动条检测

---

## 8. 评论系统（Comments）

### 8.1 画布评论
- 源码：`comment/`
- 评论图标（comment-icon）：画布上的评论标记
- 评论预览（comment-preview）：悬停显示评论摘要
- 评论线程（thread）：完整评论对话

### 8.2 评论交互
- 创建评论：评论模式下点击画布
- 回复评论：线程内回复
- 编辑评论/回复
- 删除评论/回复
- 解决评论（Resolve）
- 前后导航（Prev/Next）
- @提及用户（mention-input）

### 8.3 评论光标
- 源码：`comment/cursor.tsx`
- 评论模式下的自定义光标样式

---

## 9. 便签节点（Note Node）

### 9.1 便签功能
- 源码：`note-node/`
- 主题颜色：blue/cyan/green/yellow/pink/violet
- 属性：文本内容、主题色、作者、是否显示作者

### 9.2 富文本编辑器（Note Editor）
- 源码：`note-node/note-editor/`
- 基于 Lexical 编辑器
- 工具栏：字体大小选择器、颜色选择器、格式命令、操作按钮
- 插件：格式检测器（format-detector-plugin）、链接编辑器（link-editor-plugin）
- 状态管理：独立 store

---

## 10. DSL 导入/导出

### 10.1 DSL 导出确认弹窗
- 源码：`dsl-export-confirm-modal.tsx`
- 功能：导出时确认是否包含 Secret 类型环境变量
- 交互：Checkbox 选择是否导出密钥

### 10.2 DSL 导入弹窗
- 源码：`update-dsl-modal.tsx`
- 功能：上传 DSL 文件更新当前工作流
- 流程：上传文件 → 验证内容 → 确认导入 → 处理插件依赖
- 备份功能：导入前可备份当前版本
- 导入模式：DSLImportMode
- 状态：DSLImportStatus

### 10.3 同步数据弹窗
- 源码：`syncing-data-modal.tsx`
- 功能：数据同步中的加载状态展示

---

## 11. 工作流预览（Workflow Preview）
- 源码：`workflow-preview/`
- 功能：只读模式下的工作流可视化预览
- 支持：自定义节点渲染、MiniMap、缩放控件、背景网格
- 节点类型：普通节点、便签节点、简单节点、迭代起始节点、循环起始节点

---

## 12. 节点基础能力（_base）

### 12.1 错误处理
- 源码：`nodes/_base/components/error-handle/`
- 策略：none / fail-branch / default-value
- 默认值表单：按输出变量类型设置默认值

### 12.2 重试机制
- 源码：`nodes/_base/components/retry/`
- 配置：启用开关、最大重试次数、重试间隔

### 12.3 变量引用系统
- 源码：`nodes/_base/components/variable/`
- 变量引用选择器（var-reference-picker）：搜索、路径展示、类型过滤
- 变量列表（var-list）：展示可用变量
- 变量引用弹窗（var-reference-popup）
- 变量类型选择器（var-type-picker）
- 常量字段（constant-field）
- 对象子树面板（object-child-tree-panel）
- 变量完整路径面板（var-full-path-panel）
- Schema 类型匹配（match-schema-type）
- 赋值变量引用弹窗（assigned-var-reference-popup）

### 12.4 下一步连接
- 源码：`nodes/_base/components/next-step/`
- 添加后续节点、连接线管理、操作按钮

### 12.5 运行前表单
- 源码：`nodes/_base/components/before-run-form/`
- 单步运行时的输入表单、布尔输入、表单项渲染

### 12.6 其他基础组件
- 代码生成按钮（code-generator-button）
- 提示词编辑器（prompt）
- 混合变量文本输入（mixed-variable-text-input）
- 支持变量的输入（support-var-input / input-support-select-var）
- 文件类型选择（file-type-item）
- 数字滑块输入（input-number-with-slider）
- MCP 工具可用性检测（mcp-tool-availability）
- 帮助链接（help-link）
- 信息面板（info-panel）
- 节点缩放器（node-resizer）

---

## 13. 系统变量（Global Variables）

### 13.1 系统内置变量
- 源码：`constants.ts` (getGlobalVars)
- Chatflow 专属：sys.dialogue_count、sys.conversation_id
- 通用变量：sys.user_id、sys.app_id、sys.workflow_id、sys.workflow_run_id
- Workflow 专属：sys.timestamp

---

## 14. 工作流历史（Workflow History）
- 源码：`workflow-history-store.ts`、`hooks/use-workflow-history.ts`
- 基于 zustand temporal 的撤销/重做系统
- 事件类型：WorkflowHistoryEvent
- 状态：pastStates / futureStates

---

## 15. 插件依赖管理
- 源码：`plugin-dependency/`
- 功能：检测和安装工作流所需的插件
- 组件：依赖检测 hooks、安装界面

---

## 16. 功能面板（Features Panel）
- 源码：`features.tsx`
- Chatflow 功能配置：
  - 开场白（opening_statement）及建议问题（suggested_questions）
  - 回答后建议问题（suggested_questions_after_answer）
  - 文字转语音（text_to_speech）
  - 语音转文字（speech_to_text）
  - 引用来源（retriever_resource）
  - 文件上传（file_upload）
  - 敏感词审查（sensitive_word_avoidance）
- 自动同步到服务端 + WebSocket 广播

---

## 17. 简单节点（Simple Node）
- 源码：`simple-node/`
- 功能：简化渲染的节点类型（用于特定场景的轻量展示）

---

## 18. 数据存储层

### 18.1 工作流 Store
- 源码：`store/`
- 状态管理：节点、边、视口、面板状态、运行状态、协作状态
- 关键状态：controlMode、clipboardElements、panelMenu/nodeMenu/edgeMenu
- 面板开关：showEnvPanel、showDebugAndPreviewPanel、showVariableInspectPanel、showChatVariablePanel、showGlobalVariablePanel、showWorkflowVersionHistoryPanel、showFeaturesPanel

### 18.2 Hooks Store
- 源码：`hooks-store/`
- 配置映射：flowType 等运行时配置

### 18.3 Datasets Detail Store
- 源码：`datasets-detail-store/`
- 知识库详情缓存
