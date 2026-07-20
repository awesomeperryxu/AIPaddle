# ADR-003：大模型接入方案

- 状态：**已采纳**（2026-07-18 初版；**2026-07-20 修订：默认模型 Kimi 2.5 → 通义 Qwen**，Perry 拍板）
- 对应任务：ROADMAP 2.7（并闭环 2.6 轮子清单的"模型网关"项）
- 关联：ADR-001（Supabase/pgvector）、数据模型 C5（向量 1536 维）、ADR-009（嵌入模型，同供应商）

## 修订记录

- **2026-07-20**：默认对话模型由 **Kimi 2.5（Moonshot）** 改为 **通义 Qwen（阿里云百炼/DashScope）**。原因：Kimi 与 DeepSeek 均**不提供 embedding 接口**（已查证官方文档），RAG 必须外接嵌入供应商；而**通义（百炼）同时提供对话（Qwen）与嵌入（text-embedding-v3），一个平台、一个 `DASHSCOPE_API_KEY`、一份账单**，是国产阵营里少数能"一家全包 chat+embedding"的方案。据此把 LLM 也统一到通义，嵌入选型（原待办）一并结案于 ADR-009。环境变量 `MOONSHOT_API_KEY` → `DASHSCOPE_API_KEY`。

## 决策

1. **默认对话模型：通义 Qwen（阿里云百炼 / DashScope）**，默认 `qwen-plus`（高质量场景可切 `qwen-max`）。百炼提供 **OpenAI 兼容模式**，服务端统一经 OpenAI 兼容客户端调用，`baseURL = https://dashscope.aliyuncs.com/compatible-mode/v1`。
2. **功能上可自主调配**：每个 Agent 可独立指定模型——`agents.config.model` 字段（jsonb，数据模型已预留），未指定则回落到租户默认 → 平台默认（`qwen-plus`）。切换模型/供应商不改代码，只改配置。
3. **API Key 管理**：所有模型 Key 仅存服务器环境变量（`DASHSCOPE_API_KEY`），绝不入库明文、不进前端、不进 git（延续 ADR-001 约定；切片 1 的 S1-CHAT-03 用例专门验证）。**对话与嵌入共用同一个 `DASHSCOPE_API_KEY`**。
4. **模型网关**：首版**不引入** LiteLLM 等网关——单一供应商直连即可，少一层运维。触发引入条件：接入第 3 家供应商、或需要成本/质量路由与统一计量时（PRD 2.9.2 的多模型 Fallback/路由属阶段 6）。
5. **用量记录**：每次调用写 `call_logs`（tokens_in/out、model、latency、success），对话与嵌入调用都计量，为 Dashboard 统计与将来计费（阶段 6）提供数据底座。

## 嵌入模型（原待办，已结案）

- **嵌入模型选型已锁定 → ADR-009**：通义 `text-embedding-v3`，输出 **1536 维**（对齐 `chunks.embedding vector(1536)`），OpenAI 兼容，与对话同供应商同 Key。
- RAG 拒答与引用的提示词模板（切片 2 开发时定稿，金标准评测把关）——仍为切片 2 落地项。

## 被否决的备选

| 方案 | 否决原因 |
|------|---------|
| 保持 Kimi 2.5 作默认 LLM | Kimi 无 embedding 接口，RAG 需再引一家嵌入供应商（多一个 Key/账单）；改用通义可一家全包 |
| DeepSeek 作默认 LLM | 同样**无 embedding 接口**（官方文档确认），无法一家全包；如需其推理优势可后续经 config.model 挂载 |
| 智谱 GLM 全包 | GLM 有 embedding-3，但官方档位 512/1024/2048，1536 维未确认可精确输出，且嵌入接口非 OpenAI 兼容；通义在维度与兼容性上更稳 |
| 首版即上 LiteLLM 网关 | 单供应商阶段纯增复杂度；触发条件明确后再上 |
| 模型 Key 存数据库供租户自配 | PRD 2.9.2 的租户级模型管理属阶段 6，首版平台统一管 Key |

## 复审条件

接入第 3 家模型供应商；出现租户自带 Key（BYOK）需求；通义 Qwen/text-embedding-v3 成本或质量不达预期（备选：LLM 切 DeepSeek/GLM，嵌入切智谱，见 ADR-009）。
