# 知识库模块设计 Spec（切片 2：4.2.1 / 4.2.2 / 4.2.3）

- 状态：设计稿（2026-07-20，D 道知识库前置，非阻塞）
- 对应任务：ROADMAP 4.2.1 上传存储 · 4.2.2 解析向量化 · 4.2.3 RAG 问答
- 依据：PRD 2.4 知识库模块 · migration 0001（`knowledge_bases/documents/chunks`）· ADR-008 数据层 · ADR-009 嵌入（通义 text-embedding-v3 @1536）· ADR-006 办公文件通道①共用解析管线
- 说明：本 spec 是"地基就绪后照着写"的施工图；落地依赖 3.3 租户上下文 + 3.5 数据层，实现时进行。

---

## 1. 端到端管线总览

```
上传(4.2.1)                解析向量化(4.2.2)                    检索问答(4.2.3)
浏览器 → Next.js API         异步任务：拉文件→抽文本→切块        提问 → 向量化 query
  → 校验(类型/大小)            →批量 embed→写 chunks              → pgvector cosine top-k
  → Storage(服务端上传)       文档 status: parsing→active         → 阈值过滤(拒答)
  → documents 落库(uploading)                                    → 拼上下文+引用 → Qwen 回答
```

文档状态机（对齐 schema `documents.status`）：`uploading → parsing → active`（失败 → `error` + `error_msg`）。
知识库状态（`knowledge_bases.status`）：`active`（就绪）/`indexing`（有文档在解析）/`error`。

---

## 2. 存储布局（4.2.1）

- **私有桶**：Supabase Storage 建**私有** bucket `kb-documents`（非 public）。浏览器**不直连 Storage**（ADR-001）——上传与下载都经 Next.js 服务端中转/签名。
- **路径约定**：`kb-documents/{org_id}/{kb_id}/{document_id}/{filename}`。`org_id` 打头，便于隔离与排障；`documents.storage_path` 存这个相对路径。
- **桶 RLS / 隔离**：Storage 的 `storage.objects` 也按 `org_id`（路径首段）加策略；但因服务端用请求级客户端访问（ADR-002），主隔离仍由应用层 + 路径约定保证。**下载一律走服务端签名 URL**（短期有效），不暴露长期公开链接。
- **限制**（4.2.1 首版）：只收 **PDF**（ROADMAP 4.2.1 明确）；单文件 ≤ 20MB（可配）；类型用魔数校验不只看后缀。

**上传流程**（权限 `kb:upload`，ADR-007）：
1. 浏览器 `POST /api/kb/{kbId}/documents`（multipart）→ 经 `lib/api/client.ts`。
2. 服务端校验类型/大小 → 生成 `document_id` → 服务端把文件传进 Storage 上述路径。
3. `documents` 插一行 `status='uploading'`→上传成功置 `parsing` → 触发解析任务。
4. 返回文档元信息；前端列表可见（对齐 PRD 2.4「上传文档/文档数量」）。

---

## 3. 解析 · 切块 · 向量化（4.2.2）

**异步执行**：解析耗时，不阻塞上传请求。首版用 **Next.js Route Handler 内的后台任务**（或轻量队列表 poll）；一篇文档一个任务，失败置 `error`。

**① 抽取文本**：PDF → 文本（按页保留页码）。抽取失败/扫描件无文本层 → `error`（首版不做 OCR，记 `error_msg`，二期再加）。

**② 切块（chunking）——默认参数（可调）**：
| 参数 | 默认值 | 说明 |
|------|--------|------|
| 切块大小 | ~600 字符（中文）| 兼顾语义完整与召回粒度 |
| 重叠 overlap | ~80 字符（约 13%）| 避免跨块语义被切断 |
| 切分策略 | 递归：段落 → 句子 → 硬切 | 优先在自然边界断开 |
| metadata | `{page, para_index}` | 存 `chunks.metadata`，供引用定位 |

**③ 向量化**：调 `lib/llm/embedding.ts`（ADR-009，通义 `text-embedding-v3`，`dimensions=1536`）。
- **批处理**：每批 N 条（按供应商上限），减少请求数；失败重试（指数退避）；用量写 `call_logs`。
- 写 `chunks`：`content` + `metadata` + `embedding vector(1536)`；`document_id` 关联。
- 建议 A 道给 `chunks` 补 `embedding_model` / `embedding_dim`（ADR-009），记录向量来源，便于将来换模型识别重灌。

**④ 完成**：全部 chunk 入库 → 文档置 `active`；该 KB 若无其它在解析文档 → `knowledge_bases.status='active'`。

**索引**：`chunks` 已有 HNSW cosine 索引（`idx_chunks_embedding using hnsw (embedding vector_cosine_ops)`，migration 0001），无需新建。

> **与 ADR-006 办公文件通道①（4.2.4）共用**：抽文本/解析管线复用同一套，仅出口不同（知识库入库 vs 直接返回处理结果）。

---

## 4. 检索与问答（4.2.3 RAG）

**检索**：
1. 用户问题 → 同模型 `text-embedding-v3 @1536` 向量化（**必须与入库同模型同维同归一化**，否则相似度失真）。
2. pgvector cosine：`order by embedding <=> :q limit k`（默认 `k=5`），带 `org_id` + `kb_id` 过滤（RLS 兜底租户隔离）。
3. **相似度阈值拒答**：top 结果低于阈值（默认 cosine 距离阈值待金标准调参）→ 回"知识库中未找到"，不硬编。
4. 只检索 `deleted_at is null` 且所属文档 `status='active'` 的 chunk。

**回答 + 引用**（PRD 2.4「检索结果展示/相关性评分」，验收 4.2.3「答对≥4/5 且引用正确」）：
- 把 top-k chunk 作为上下文喂 Qwen，提示词要求**基于给定资料作答、给出引用**；
- 返回结构含**引用列表**：`{document_id, filename, page, snippet, score}`，前端可点开定位。
- **删除即失效**：软删文档 → 级联软删其 chunks（`documents` cascade + `deleted_at`）→ 检索自动不再命中（验收「删除文档后不再引用」）。

**RAG 提示词模板**（切片 2 开发时定稿，金标准把关，ADR-003 待办项）：拒答规则 + 引用格式 + 防幻觉约束。

---

## 5. 其它操作

- **删除文档**：软删 `documents.deleted_at` + 级联 chunks；Storage 文件可延迟清理（定时任务，service 客户端）。
- **重新索引**（PRD 2.4）：清该文档旧 chunks → 重跑 ②③；用于换切块参数或修复 `error`。
- **测试检索**（PRD 2.4「知识库问答/检索结果展示」）：详情页内直接试问，展示命中 chunk + 分数，不落对话。

---

## 6. 数据层接口（ADR-008，`lib/data/knowledge.ts`，均首参 `ctx`）

```ts
import 'server-only'
listKnowledgeBases(ctx): KnowledgeBase[]
createKnowledgeBase(ctx, {name, description, department}): KnowledgeBase   // 需 kb:create
uploadDocument(ctx, kbId, file): Document                                 // 需 kb:upload；4.2.1
listDocuments(ctx, kbId): Document[]
deleteDocument(ctx, kbId, docId): void                                    // 软删+级联
reindexDocument(ctx, kbId, docId): void
retrieve(ctx, kbId, query, k?): RetrievedChunk[]                          // 4.2.3 检索
// 解析任务：parseAndEmbed(docId) —— 内部任务，非直接 API
```
- 权限动作（`kb:create/upload/read`）由 API 入口 `requirePermission`（ADR-007）；数据隔离由 RLS 兜底（ADR-002）。
- 组件只经 `/api/kb/*` 或数据层，不直连 Storage/Supabase（ADR-008）。

---

## 7. 落地依赖与交接

| 依赖 | 归属 | 现状 |
|------|------|------|
| 3.3 租户上下文 `ctx` | A 道 | ⬜ 未建 |
| 3.5 数据层脚手架 `lib/data` | A 道 | ⬜ 未建 |
| `lib/llm/embedding.ts`（通义 v3） | 本切片/LLM 道 | ⬜ ADR-009 已定，待写 |
| Storage 私有桶 `kb-documents` + 路径策略 | A 道（Supabase 配置） | ⬜ |
| `chunks` 加 `embedding_model/dim` migration | A 道（仅 A 道可动 migration） | ⬜ 建议补 |
| E2E：切片 2 用例（金标准问答、删除失效） | C 测试道 | 见 tests/e2e stages |

**本 spec 不含任何需即时拍板项**——参数（切块大小、top-k、阈值）均给默认值，切片 2 开发时按金标准评测微调。
