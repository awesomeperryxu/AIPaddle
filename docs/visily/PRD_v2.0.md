# AIPaddle - AI 业务赋能平台 产品需求文档 (PRD v2.0)

**项目名称**: AIPaddle (AI 业务赋能平台)  
**文档版本**: 2.0  
**更新日期**: 2026-05-15  
**用途**: 配合 Visily 生成高保真 UI 设计稿  
**数据来源**: Dify 开源代码深度分析（547 个 TSX 文件）+ 原有平台模块

---

## 1. 产品概述

### 1.1 产品定位

企业级 AI 运营管理平台，帮助企业构建、部署、管理和监控 AI Agent、Skill 和工作流。

### 1.2 核心价值

- 统一管理所有 AI 资产（Agent、Skill、知识库、工作流）
- 完整的权限管理、安全审核、多租户支持
- 可视化监控面板和工作流编辑器
- 灵活的 Skill 市场和插件系统

### 1.3 目标用户

| 角色 | 职责 |
|------|------|
| 企业 IT 管理员 | 管理 AI 基础设施和资源 |
| AI 开发者 | 创建和发布 AI Agent 和 Skill |
| 业务部门 | 使用 AI Agent 提升工作效率 |
| 安全审计员 | 审核和监控 AI 使用情况 |
| 租户管理员 | SaaS 模式下的多租户管理 |

---

## 2. 平台信息架构

### 2.1 导航结构（侧边栏）

```
AIPaddle (AI 业务赋能平台)
├── 工作台
│   ├── 监控
│   └── 个人助理
├── Agent
│   ├── Agent 管理
│   └── 数字员工
├── Skill
│   ├── Skill Hub
│   └── 我的 Skill
├── 知识库
│   ├── 知识库管理
│   └── 知识库问答
├── 工作流
│   └── 工作流管理（含 Workflow/Chatflow/Agent/文本生成 四种应用类型）
├── 安全与管理
│   ├── 安全管理
│   └── 成员管理
├── 平台管理
│   ├── 运营看板
│   ├── 租户管理
│   ├── Key 管理
│   └── 账单管理
└── 系统设置
```

---

## 3. 功能模块

### 3.1 监控面板 (Dashboard)

提供平台整体运营数据的可视化展示。

**页面内容**：
- 4 张主要统计卡片：Agent 总数、Skill 总数、工作流执行数、知识库容量
- 5 张次要指标卡片：今日调用量、成功率、平均响应时间、活跃用户、待审核数
- 调用趋势折线图（近 7 天）
- Agent 类型分布饼图
- 部门使用情况柱状图
- 最近活动列表

### 3.2 Agent 管理

创建、配置和管理企业 AI Agent。

**Agent 列表页**：
- 顶部统计卡片：总数、已发布、待审核、草稿
- 状态筛选 Tab：全部 / 已发布 / 待审核 / 草稿 / 已下线
- Agent 卡片网格（每行 3-4 张）
- 每张卡片：图标、名称、部门、状态标签、描述、标签、调用指标

**Agent 状态流转**：草稿 → 待审核 → 已发布 → 已下线

**使用场景**：本地 CC（呼叫中心）、企微对话、Web 接入、API 调用

### 3.3 数字员工（Agent 交互视图）

用户与已发布 Agent 的对话交互界面。
- 左侧：Agent 列表（按部门分组）
- 右侧：对话窗口（消息列表 + 输入框）

### 3.4 Skill Hub

企业 AI 能力市场，管理和分享可复用的 AI 能力。
- Tab 切换：Skill Hub / 我的 Skill
- 类型筛选：MCP / API / DB / Workflow / Prompt
- Skill 卡片网格：图标、名称、类型、描述、发布者、安装量、评分、风险等级

### 3.5 知识库

管理企业知识库，为 Agent 提供知识支持。
- 知识库卡片网格：名称、描述、文档数量、存储容量、向量化状态
- 知识库详情页：文档列表、上传入口、检索测试

<!-- PLACEHOLDER_WORKFLOW -->

### 3.6 Workflow & Chatflow 编辑器

> 基于 Dify 源码深度分析（547 个 TSX 文件），全量覆盖。

**功能定位**：
- **Workflow**：面向批处理和 API 调用，以 End 节点输出，支持 Webhook/定时/插件触发
- **Chatflow**：面向对话场景，以 Answer 节点流式输出，支持多轮对话上下文和对话变量

**技术架构**：ReactFlow 画布引擎 + Zustand 状态管理 + WebSocket 实时协作

---

#### 3.6.1 节点类型系统（33 种）

**触发器节点（4 种）**：

| 节点 | 功能 | 关键配置 |
|------|------|---------|
| Start | 工作流入口，定义输入变量 | 变量类型：text-input/paragraph/select/number/url/files/json/json_object/contexts/checkbox；文件上传配置 |
| Trigger-Schedule | 按时间计划自动触发 | 可视化模式（hourly/daily/weekly/monthly）或 cron 表达式；时区设置 |
| Trigger-Webhook | HTTP Webhook 触发 | HTTP 方法、Content-Type、Headers/Params/Body 参数定义；异步模式；自定义响应状态码和响应体；自动生成 Webhook URL（含调试 URL） |
| Trigger-Plugin | 插件事件触发 | Provider、事件名称、事件参数、输出 Schema；版本管理 |

**AI 节点（4 种）**：

| 节点 | 功能 | 关键配置 |
|------|------|---------|
| LLM | 大模型调用 | 模型选择（Provider/Model/Mode）；Prompt 模板（system/user/assistant 多角色）；Jinja2 模板；Memory 记忆窗口（窗口大小、角色前缀、查询模板）；上下文变量注入；Vision 视觉能力（分辨率选择）；结构化输出（JSON Schema）；推理格式（tagged/separated） |
| Agent | 智能体调用 | 策略 Provider/Name 选择；参数输入；输出 Schema；Memory（历史消息）；插件版本管理；MCP 工具可用性检测 |
| Question-Classifier | 问题分类路由 | 查询变量选择；模型配置；分类列表（Topic[]）；指令说明；支持 Memory 和 Vision |
| Parameter-Extractor | 从文本提取结构化参数 | 模型选择；查询变量；参数定义（name/type/options/description/required）；推理模式（prompt/function_call）；参数类型：string/number/boolean/select/array[*] |

**逻辑控制节点（4 种）**：

| 节点 | 功能 | 关键配置 |
|------|------|---------|
| If-Else | 条件分支路由 | 多 Case 支持（IF/ELIF/ELSE）；逻辑运算符（AND/OR）；20+ 比较运算符；子变量条件（嵌套）；变量类型感知 |
| Iteration | 数组迭代执行子工作流 | 迭代器变量选择；并行模式（1-10 并发）；错误处理（terminated/continue-on-error/remove-abnormal-output）；输出扁平化 |
| Loop | 条件循环执行 | 循环次数上限；中断条件（break_conditions）；循环变量定义（label/type/value）；错误处理同 Iteration |
| Human-Input | 暂停等待人工审批/输入 | 投递方式（WebApp/Email/Slack/Teams/Discord）；Email 配置（收件人/主题/正文）；自定义操作按钮（Primary/Default/Accent/Ghost）；表单输入项；超时设置（小时/天） |

**数据处理节点（8 种）**：

| 节点 | 功能 | 关键配置 |
|------|------|---------|
| Code | 执行自定义代码 | 语言：Python3/JavaScript/JSON；输入变量映射；代码编辑器；输出变量定义（类型声明） |
| Template-Transform | Jinja2 模板转换 | 变量列表；模板字符串 |
| HTTP-Request | 发送 HTTP 请求 | 方法：GET/POST/HEAD/PATCH/PUT/DELETE；Body 类型：none/form-data/x-www-form-urlencoded/raw-text/json/binary；认证：无/API Key（basic/bearer/custom）；超时（connect/read/write 独立）；CURL 导入；SSL 验证开关 |
| Variable-Assigner | 多变量聚合为一个输出 | 分组模式（group_enabled）；多组变量聚合 |
| Assigner | 变量写操作 | 写入模式：overwrite/clear/append/extend/set/+=/-=/*=/ /=/remove-first/remove-last；输入类型：variable/constant；多操作批量执行 |
| List-Operator | 列表过滤/排序/截取 | 多条件组合过滤；按序号提取；排序（ASC/DESC + 排序键）；数量限制 |
| Document-Extractor | 从文件提取文本 | 变量选择器；数组文件支持 |
| Knowledge-Retrieval | 知识库检索 | 检索模式：单路/多路；多路配置（Top-K/Score 阈值/Reranking 模型/权重）；元数据过滤（disabled/automatic/manual + AND/OR 条件组合 + 20+ 比较运算符） |

**集成节点（3 种）**：

| 节点 | 功能 | 关键配置 |
|------|------|---------|
| Tool | 调用工具插件 | 动态表单；结构化输出；插件版本管理 |
| Data-Source | 通过插件连接外部数据源 | 插件 ID；Provider；数据源名称；参数；文件扩展名过滤 |
| Knowledge-Base | 知识库索引构建 | Chunk 结构（general/parent_child/question_answer）；索引技术；嵌入模型；检索设置；摘要索引 |

**输出节点（2 种）**：

| 节点 | 功能 |
|------|------|
| End | Workflow 终止节点，定义最终输出变量列表 |
| Answer | Chatflow 流式回答，支持变量插值 |

**辅助节点（5 种）**：Iteration-Start、Loop-Start、Loop-End、Data-Source-Empty（占位）、Note（便签）

---

#### 3.6.2 画布交互系统

**右键菜单（4 种）**：

| 菜单 | 触发位置 | 功能项 |
|------|---------|--------|
| 画布右键菜单 | 空白画布 | 添加节点、粘贴节点、运行工作流/调试预览、添加便签、添加评论、导出 DSL、导入 DSL |
| 节点右键菜单 | 节点上 | 运行此步骤、更换节点类型（Change Block）、复制、复制副本、删除、打开关联应用、帮助链接 |
| 连线右键菜单 | 连线上 | 删除连线 |
| 多选右键菜单 | 多选节点后 | 对齐（上/中/下/左/居中/右）、分布（水平均分/垂直均分） |

**快捷键系统（21 个）**：

| 分类 | 快捷键 |
|------|--------|
| 编辑 | Delete 删除、⌘C 复制、⌘V 粘贴、⌘D 复制副本 |
| 历史 | ⌘Z 撤销、⌘Y 重做 |
| 模式 | V 指针、H 手型、C 评论 |
| 画布 | ⌘O 自动整理、F 全屏切换、⌘1 适应画布、⇧1 缩放100%、⇧5 缩放50%、⌘+ 放大、⌘- 缩小 |
| 运行 | ⌥R 打开测试运行菜单 |
| 其他 | ⌘⇧L 下载导入日志、Shift 暗化其他节点、⌘⇧H 版本历史、⌘Enter 确认 JSON Schema |

**控制模式（3 种）**：指针模式（选择拖拽）、手型模式（平移画布）、评论模式（放置评论）

**连线系统**：自定义贝塞尔曲线渲染（线性渐变）；连线状态（hovering/bundled/running/waiting）

**辅助线**：节点拖拽时自动显示对齐辅助线

**候选节点**：从连接点拖出时显示待添加节点预览

---

#### 3.6.3 面板系统（11 个面板）

| 面板 | 触发方式 | 功能 |
|------|---------|------|
| 节点配置面板 | 点击节点 | 右侧 380px 抽屉；通用组件：标题描述输入、变量引用选择器、代码编辑器、模型选择器、错误处理配置（none/fail-branch/default-value）、重试配置（max_retries/interval/enabled）、下一步连接、运行前表单、Vision 配置、Memory 配置、文件上传设置、Agent 策略选择器、插件版本切换、输出变量展示 |
| 运行调试面板 | 运行工作流后 | 三 Tab：RESULT（输出）/ DETAIL（耗时/Token/状态）/ TRACING（节点执行链路）；特殊日志：Agent 日志、迭代日志、循环日志、重试日志；循环结果面板；并行 ID 悬停检测 |
| 调试与预览面板 | Chatflow 模式 | 对话调试界面；用户输入表单；会话变量弹窗；可拖拽调整宽度；重启对话 |
| 变量检查面板 | 运行时 | 实时查看变量值；左右分栏（变量列表/值内容）；代码/预览切换；Markdown/Chunks 预览；大数据告警；监听状态指示 |
| 环境变量面板 | Header 按钮 | 管理工作流环境变量（string/number/secret）；变量列表；编辑弹窗 |
| 会话变量面板 | Header 按钮（Chatflow） | 管理会话级变量（Number/String/Boolean/Object/Array[*]） |
| 全局变量面板 | Header 按钮 | 管理全局变量（string/number/integer） |
| 版本历史面板 | Header 按钮 | 版本列表；筛选器；恢复确认弹窗；删除确认弹窗；操作菜单 |
| 评论面板 | 侧边按钮 | 查看画布上所有评论的列表视图 |
| 聊天记录面板 | 调试面板内 | 查看历史对话记录 |
| 人工输入表单面板 | 工作流暂停时 | 展示人工输入节点的表单和已填写表单 |

---

#### 3.6.4 Header 功能区

| 功能 | 描述 |
|------|------|
| Header 三种模式 | Normal（正常编辑）/ ViewHistory（查看历史）/ Restoring（恢复中） |
| 编辑标题 | 工作流名称可编辑 |
| 在线用户 | 显示当前在线协作用户头像列表；点击跳转到其光标位置；用户颜色标识 |
| 运行与历史 | 运行按钮（RunMode）/ 预览按钮（Chatflow）/ 查看历史 / 检查清单 |
| 测试运行菜单 | 触发类型选择（UserInput/Schedule/Webhook/Plugin/All）；快捷键 ⌥R；运行中显示停止按钮；运行前检查 Checklist |
| 检查清单 | 检测工作流配置问题；分类：插件缺失项 + 节点配置问题；点击跳转到问题节点 |
| 撤销/重做 | 基于 zustand temporal；按钮禁用状态感知 |
| 版本历史按钮 | 快捷键提示；触发版本历史面板 |
| 滚动到选中节点 | 快速定位到当前选中的节点 |

---

#### 3.6.5 协作功能

| 功能 | 描述 |
|------|------|
| WebSocket 连接 | 实时协作通信管道 |
| 在线用户感知 | 实时显示在线编辑者（user_id/username/avatar） |
| 光标同步 | 实时显示其他用户的鼠标位置；可切换显示/隐藏 |
| 节点面板占用感知 | 显示哪个用户正在编辑哪个节点 |
| 协作事件（13 种） | mouse_move、workflow_update、vars_and_features_update、comments_update、node_panel_presence、app_state_update、app_meta_update、sync_request、graph_resync_request、workflow_restore_intent、workflow_restore_complete、workflow_history_action、app_publish_update、mcp_server_update |

---

#### 3.6.6 操作工具栏（底部）

| 功能 | 描述 |
|------|------|
| 控制面板 | 按钮：添加节点、指针模式、手型模式、评论模式、添加便签、自动整理、全屏切换、更多操作 |
| 缩放控件 | 缩放百分比显示；预设级别（25%/50%/75%/100%/200%）；适应画布 |
| 切换项 | MiniMap 显示/隐藏；用户光标显示/隐藏；用户评论显示/隐藏 |
| 更多操作 | 导出图片（PNG/JPEG/SVG）；导出范围（当前视口/完整工作流）；图片预览 |

---

#### 3.6.7 节点选择器（Block Selector）

| 功能 | 描述 |
|------|------|
| 标签页 | Start（触发器）/ Blocks（节点）/ Tools（工具）/ Sources（数据源） |
| 节点分类 | 问题理解 / 逻辑控制 / 数据转换 / 工具 |
| 工具类型 | All / BuiltIn / Custom / Workflow / MCP |
| 搜索过滤 | 关键词搜索 + 分类过滤 |
| 精选推荐 | 精选工具、精选触发器、RAG 工具推荐 |
| 插件市场入口 | 跳转到插件市场安装新工具 |
| 视图切换 | 列表视图 / 网格视图 |

---

#### 3.6.8 评论系统

| 功能 | 描述 |
|------|------|
| 创建评论 | 评论模式下点击画布放置评论 |
| 评论图标 | 画布上的评论标记（可折叠） |
| 评论预览 | 悬停显示评论摘要 |
| 评论线程 | 完整评论对话；回复、编辑、删除 |
| 解决评论 | 标记评论为已解决 |
| @提及用户 | 在评论中 @提及协作者 |
| 前后导航 | 在评论间快速跳转 |

---

#### 3.6.9 便签节点（Note Node）

| 功能 | 描述 |
|------|------|
| 主题颜色 | 6 种：blue/cyan/green/yellow/pink/violet |
| 富文本编辑器 | 基于 Lexical；工具栏：字体大小、颜色、格式命令 |
| 链接编辑 | 插入和编辑链接 |
| 可调大小 | 拖拽调整便签尺寸 |
| 作者显示 | 可选显示/隐藏作者信息 |

---

#### 3.6.10 DSL 导入/导出

| 功能 | 描述 |
|------|------|
| DSL 导出确认弹窗 | 确认是否包含 Secret 类型环境变量；Checkbox 选择 |
| DSL 导入弹窗 | 上传文件 → 验证 → 确认导入 → 处理插件依赖；备份当前版本；导入模式选择 |
| 同步数据弹窗 | 数据同步中的加载状态展示 |

---

#### 3.6.11 工作流预览模式

只读模式下的工作流可视化预览：
- 自定义节点渲染（普通节点、便签节点、简单节点、迭代/循环起始节点）
- MiniMap、缩放控件、背景网格
- 错误处理状态显示

---

#### 3.6.12 Chatflow 功能面板（Features）

Chatflow 专属功能配置：
- 开场白（opening_statement）及建议问题（suggested_questions）
- 回答后建议问题（suggested_questions_after_answer）
- 文字转语音（text_to_speech）
- 语音转文字（speech_to_text）
- 引用来源（retriever_resource）
- 文件上传（file_upload）
- 敏感词审查（sensitive_word_avoidance）
- 自动同步到服务端 + WebSocket 广播

---

#### 3.6.13 变量系统

**变量类型（VarType）**：string、number、integer、secret、boolean、object、file、array、arrayString、arrayNumber、arrayObject、arrayBoolean、arrayFile、any、arrayAny

**系统内置变量**：
- 通用：sys.user_id、sys.app_id、sys.workflow_id、sys.workflow_run_id
- Chatflow 专属：sys.dialogue_count、sys.conversation_id
- Workflow 专属：sys.timestamp

**环境变量**：string/number/secret 三种类型，支持加密存储

**对话变量**：Chatflow 专属，跨轮次持久化

**全局变量**：string/number/integer 三种类型

---

#### 3.6.14 节点基础能力（所有节点共享）

| 能力 | 描述 |
|------|------|
| 错误处理 | 策略：none / fail-branch / default-value；默认值表单按输出变量类型设置 |
| 重试机制 | 启用开关、最大重试次数、重试间隔 |
| 变量引用系统 | 变量引用选择器（搜索/路径展示/类型过滤）；变量列表；变量引用弹窗；类型选择器；常量字段；对象子树面板；完整路径面板 |
| 下一步连接 | 添加后续节点、连接线管理 |
| 运行前表单 | 单步运行时的输入表单 |
| 节点状态 | NotStart/Waiting/Listening/Running/Succeeded/Failed/Exception/Retry/Stopped/Paused |

---

#### 3.6.15 插件依赖管理

- 检测工作流所需的插件
- 缺失插件提示和安装界面
- 插件版本切换

---

#### 3.6.16 工作流历史（撤销/重做）

- 基于 zustand temporal 的事件溯源
- 事件类型：NodeAdd/Delete/Update/Move 等
- pastStates / futureStates 状态管理

---

### 3.7 个人助理

个人 AI 助手，提供日常工作支持。
- 左侧：会话列表（创建/切换/删除）
- 右侧：对话界面（消息列表 + 输入框）
- 预设问题模板、快捷操作按钮

### 3.8 安全审核

安全审核和权限管理。
- 待审核列表（表格形式）
- 审核类型筛选：Agent 发布 / Skill 发布 / 知识库访问 / 权限变更
- 风险等级标签：低（绿）/ 中（黄）/ 高（红）
- 审核详情弹窗：资源信息、风险评估、批准/拒绝按钮

### 3.9 成员管理

管理平台用户和权限。
- 成员列表表格：姓名、邮箱、部门、角色、状态、最后活跃时间
- 角色：Admin / Developer / User / Auditor
- 邀请成员弹窗、编辑角色、启用/禁用

### 3.10 租户管理（平台级 SaaS）

平台运营方管理多个企业租户。

**租户列表页**：统计卡片 + 租户表格 + 行操作（DropdownMenu）+ 批量操作

**开通企业表单（全屏抽屉，4 区块）**：
1. 企业基本信息：名称、编码、简称、行业、规模、地区、时区、Logo
2. 联系人信息：姓名、职位、邮箱、电话
3. 套餐与配额：套餐类型、计费模式、Token 配额、QPS 限制、存储配额
4. 高级设置：服务有效期、MCP 开关、数据隔离级别、备注

**多级页面**：企业详情页（5 Tab）、配额管理页、账单管理页、模型配置页、MCP 审批页

### 3.11 租户内部管理（企业级）

企业租户管理员自主管理内部组织和人员。

**子模块**：
- 组织架构管理：部门树形结构、部门 CRUD、资源配额
- 人员管理：用户列表、单个创建/批量导入/企微同步、生命周期管理
- 角色权限管理：预设角色 + 自定义角色、权限矩阵
- 访问控制：SSO（SAML/OAuth/OIDC）、MFA、会话管理、登录安全
- 资源配额管理：企业级/部门级/用户级配额分配和监控
- 审计日志：多条件查询、导出、保留策略

---

## 4. 全局交互规范

- 列表页：统计卡片 + 筛选器 + 搜索 + 数据列表 + 分页
- 详情页：面包屑导航 + Tab 切换 + 内容区
- 创建/编辑：Dialog（简单）或 Drawer（复杂）
- 删除确认：二次确认弹窗
- 最小支持宽度：1280px
- 侧边栏可折叠

---

## 5. 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Next.js 16 |
| UI 组件库 | Radix UI + shadcn/ui |
| 图标 | Lucide React |
| 图表 | Recharts |
| 工作流画布 | ReactFlow |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS 4 |
| 实时通信 | WebSocket |

---

**文档结束**
