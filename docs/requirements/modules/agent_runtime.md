# Agent 运行时服务 PRD(后端模块)

**文档版本**: v1.0
**创建日期**: 2026-07-12
**所属章节**: 主 PRD「10. 后端服务规格」
**状态**: 已评审确认(2026-07-12)

---

## 1. 模块概述

### 1.1 功能定位

本模块回答"一个 Agent 被调用时,服务端发生什么"。它是应用编排层的核心执行服务:前端 2.2 Agent 管理模块产生的所有配置(系统提示词、模型参数、工具列表、知识库引用),最终由本服务在运行时消费执行。

### 1.2 边界

- 本模块不负责模型推理(由 LLM 网关模块 `llm_gateway.md` 承担)
- 本模块不负责工具代码的实际执行(由 Skill 沙箱模块 `skill_sandbox.md` 承担)
- 本模块负责:会话管理、上下文组装、工具调用循环编排、流式输出、运行记录

---

## 2. 核心执行流程

一次对话调用的完整链路:

```
接收请求 → 鉴权(JWT / API Key)→ 加载 Agent 配置(锁定版本号)
→ 组装上下文:系统提示词 + 会话历史(窗口策略见 3.1)+ RAG 检索结果(若挂载知识库)
→ 经 LLM 网关调用模型 → 模型返回文本 或 工具调用请求
→ [工具循环] 执行 MCP 工具 → 结果回填上下文 → 再次调用模型
   (最多 10 轮,总时长 120 秒,可按 Agent 配置覆盖)
→ SSE 流式返回用户 → 全量落库(消息、工具调用记录、token 用量)
```

状态机:`pending → running → waiting_confirm(可选)→ succeeded / failed / stopped`

---

## 3. 关键规格(已确认)

### 3.1 上下文窗口策略

- 滑动窗口保留最近 **20 轮**对话
- 超限时对早期内容做**摘要压缩**(调用小模型生成摘要,摘要作为一条 system 消息置于历史头部)
- 摘要任务走网关的低优先级队列,不与实时对话争抢

### 3.2 工具调用循环

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 单次请求最大工具轮数 | 10 | 超过则终止并返回已有结果 + 提示 |
| 单次请求总时长上限 | 120s | 含模型与工具耗时 |
| 单个工具调用超时 | 30s | 超时该工具标记 error,不中断整体 |
| 工具失败处理 | 不中断 | 错误信息回填,由模型决定重试或绕过 |

### 3.3 高危工具人工确认

- 工具注册时可标记 `require_confirmation: true`(如 ERP 写操作)
- 触发时运行进入 `waiting_confirm` 状态,SSE 推送 `confirm_request` 事件
- 前端展示确认卡片(操作名、参数、影响说明);确认后恢复执行,拒绝则该工具调用标记 rejected
- 等待确认超时 10 分钟自动取消运行

### 3.4 流式输出(SSE)

事件类型(与 OpenAI 风格对齐):

```
message_delta   增量文本
tool_call       模型发起工具调用(名称+参数)
tool_result     工具执行结果摘要
confirm_request 高危工具等待人工确认
usage           本次运行 token 统计(结束前发送)
error           错误(含错误码)
done            结束标记
```

### 3.5 失败与重试

- 模型调用超时 30s:自动重试 1 次;再失败返回 `MODEL_TIMEOUT`
- 网关限流(429):返回排队提示,前端显示"高峰期排队中"
- 幂等:客户端携带 `request_id`,10 分钟内重复提交直接返回原运行结果

---

## 4. API 定义

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/v1/agents/{agent_id}/chat` | 发起对话,SSE 流式响应 |
| POST | `/v1/agents/{agent_id}/chat/{run_id}/confirm` | 高危工具人工确认(body: approve/reject) |
| GET | `/v1/conversations?agent_id=&page=` | 会话列表(分页) |
| GET | `/v1/conversations/{id}/messages` | 消息历史 |
| POST | `/v1/conversations/{id}/stop` | 中止正在执行的运行 |
| GET | `/v1/agents/{agent_id}/runs/{run_id}` | 运行详情(含完整工具调用链) |

错误码前缀:`AGT-`(如 `AGT-429-QUOTA`、`AGT-408-MODEL_TIMEOUT`、`AGT-409-DUPLICATE`)

---

## 5. 数据模型(新增 3 张表)

### conversations(会话)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| tenant_id / user_id / agent_id | uuid | 归属(多租户隔离键) |
| title | text | 首条消息自动生成 |
| created_at / updated_at | timestamptz | |
| deleted_at | timestamptz | 软删除 |

### messages(消息)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| conversation_id | uuid FK | |
| role | enum | system / user / assistant / tool |
| content | text | |
| tool_calls | jsonb | 模型发起的工具调用 |
| tokens_in / tokens_out | int | 用量 |
| created_at | timestamptz | |

### agent_runs(运行)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| conversation_id / agent_id / agent_version | | 版本锁定 |
| request_id | text UNIQUE | 幂等键 |
| status | enum | pending/running/waiting_confirm/succeeded/failed/stopped |
| tool_call_trace | jsonb | 完整工具调用链(审计用) |
| tokens_total / duration_ms | int | |
| error_code / error_message | text | |
| created_at / finished_at | timestamptz | |

---

## 6. 性能与验收标准

1. 首 token 延迟 P95 < 2s(不含网关排队时间)
2. 单实例支撑 200 并发会话;水平扩容线性
3. 任意运行记录可 100% 还原工具调用链(审计要求)
4. 中止操作 1s 内生效并释放资源
5. 服务重启时,running 状态的运行标记为 failed 并可查询,不出现悬挂状态

---

**关联模块**: `llm_gateway.md`(模型调用)· `skill_sandbox.md`(工具执行)· `rag_pipeline.md`(知识库检索)· `rbac_permission.md`(权限校验)
