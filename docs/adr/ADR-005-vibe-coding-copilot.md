# ADR-005：Vibe Coding（AI Copilot）执行架构——范围收缩版

- 状态：**已采纳**（2026-07-18，Perry 拍板；范围由用户明确收缩）
- 取代：`docs/design/VibeCoding-执行架构确认页.html` 中的原 Q1-Q7 方案（页面保留为决策存档）
- 关联：ADR-001（单体）、ADR-003（Kimi 2.5）、ADR-004（MCP 治理）、PRD v1.07 §2.11

## 范围定义（用户拍板的边界）

**vibe coding 仅限于通过对话创建/修改平台资产**：Skill、Workflow/Chatflow、Agent 三类。
**明确排除**：任何通用软件开发能力——不提供文件系统、终端、依赖安装、构建部署，不产出平台资产之外的任何代码工程。

## 核心结论：不需要沙盒隔离

沙盒隔离的对象是"任意代码执行"。范围收缩后，AI 的产出物是**结构化配置数据**（Skill config JSON / Workflow 图 JSON / Agent 配置字段），入库前过 Schema 校验，永远不作为代码在服务器执行。因此：

- ❌ 不需要会话级 Docker 沙盒、不需要独立执行服务、不需要在服务器部署 Claude Code client
- ✅ 原 Q6 的架构豁免**撤销**，回归 ADR-001 Next.js 单体
- ✅ 服务器（43.173.99.218）只跑 Next.js 应用，无新增运维面

### 安全模型：从"沙盒隔离"转为"四道防线"

| # | 防线 | 说明 |
|---|------|------|
| 1 | Schema 严格校验 | 生成产物必须通过 zod/图结构校验才能落库；非法结构直接拒绝 |
| 2 | 权限边界 | 用户只能生成其权限内可创建的资产类型；引用 MCP 受 `my_mcp_servers` 过滤（ADR-004 原样生效）；Copilot 无任何越权捷径 |
| 3 | 状态机 | AI 生成的资产一律落 **draft** 态，照走审核→发布流程；**AI 不能触发发布**（防提示注入直达生产） |
| 4 | 审计 | 每次生成/修改写 audit_logs（action=copilot.generate，含 prompt 摘要与产物 ID） |

### 三个残余风险点及对策

1. **Workflow 的 Code/Template 任意代码节点（PRD 2.5）**——唯一能让任意代码执行"从后门回来"的地方。**首版禁用**（节点面板不提供、服务端校验拒绝含此类节点的图）。将来开放时另立 ADR 设计受限执行器（isolated-vm / 执行池），属工作流引擎议题，与 Copilot 无关。
2. **HTTP-Request 节点 SSRF**——出网白名单（禁内网段/元数据地址），切片 4 实现时落地。
3. **DB 类 Skill**——维持 ADR-004：只读账号、库表白名单、select-only、行数上限、脱敏。

## 技术方案

- **生成引擎**：Next.js 后端内的 LLM tool-calling 循环，直调 Kimi 2.5（ADR-003 通路复用）。工具集为平台内部函数：
  `create_skill_draft / update_workflow_graph / validate_graph / create_agent_draft / test_run_draft / list_my_mcp_servers / list_my_skills`
- **产品形态**：编辑器内嵌 **Copilot 面板**——Skill 创建页、Workflow/Chatflow 画布、Agent 配置页各带"AI 帮我建"侧栏（描述需求 → 生成草稿 → 画布/表单实时可见 → 用户改/AI 迭代 → 提交审核）；个人助理支持"帮我建一个 XX Agent"直达入口。
- **test_run_draft**：草稿态资产的试运行走既有引擎（Agent 对话/Workflow 执行/Skill 调用测试），权限按发起用户本人计算。
- **Claude Code client 的最终定位**：仅员工个人终端开发工具（Coding Plan 订阅，见 2026-07-18 对话记录）；与平台运行时无耦合。

## 交互协议（2026-07-18 增补，对应 PRD v1.09 交互场景规范）

1. **意图路由**：全局对话入口的编排循环前置意图分类（create_workflow / create_chatflow / create_skill / create_agent / 普通对话）。命中创建意图 → 后端建 draft → 前端携会话上下文跳转对应编辑页；右侧 Copilot 栏首条消息为用户原文，左侧画布流式生成。
2. **澄清协议**：工具注册表新增一对工具——
   - `request_user_input`：模型对缺失配置产出问题清单 `{questions:[{id, node_ref, field, label, type: single_select|multi_select|text|resource_select, options[], required}]}`，前端渲染为**画布下方底部交互面板**；
   - `submit_user_input`：用户勾选确认后结构化回传 → 循环生成 patch 回填对应节点配置。
   联动规则：未决项在节点挂"待配置"徽标（与面板双向定位）；用户手改节点配置 → 对应问题自动消失（单一状态源）。
3. **Dify 兼容硬约束**：Copilot 图操作 patch 仅允许产出符合 Dify 风格 DSL 的结构（BlockEnum 节点类型 + 各节点既有 config schema + 画布连线规则），与手工编辑产物同构——AI 适配画布，画布零改动适配 AI；澄清面板是底部布局增量（Dify 底部面板先例），不改画布交互范式。

## 排期（并入既有切片，不再新增独立切片）

| 任务 | 内容 | 切片 |
|------|------|------|
| 4.1.6 | Agent Copilot（配置页侧栏，最简版：描述→生成配置草稿） | 切片 1 末 |
| 4.3.3 | Skill Copilot（含 MCP 封装建议：按用户可见 Server 推荐白名单） | 切片 3 |
| 4.4.5 | Workflow/Chatflow Copilot（描述→生成节点图草稿→校验→画布渲染） | 切片 4 |

## 复审条件

用户要求开放通用软件开发能力（重启沙盒设计，原确认页 Q2/Q3/Q5 参数复用）；开放 Code 节点；Copilot 生成质量需要更强模型时（换模型走 ADR-003 的 config.model 机制）。

## 附录：面向未来 vibe coding 升级的两项工程预留（开发时强制遵守）

1. **工具注册表模式**：Copilot 编排层实现为独立模块 `lib/copilot/`，工具集采用注册表（registry）结构——每个工具是一个注册条目（name / schema / handler / 权限要求）。未来升级 vibe coding = 注册 `read_file` / `write_file` / `run_command` 等新工具并把 handler 路由到沙盒执行器，**tool-calling 循环本身零改动**。禁止把工具逻辑硬编码进循环。
2. **Nginx 结构预留**（任务 0.7 执行时落实）：对外仅暴露 Next.js 一个入口；内网端口段预留给未来的独立执行服务（原 Q6 方案 A），届时加进程不改网络拓扑。
