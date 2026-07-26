-- 4.2.8：知识库可配置检索参数（原 topK=5 / 阈值=0.28 硬编码于 lib/kb/rag）。
-- searchMethod 目前仅 'vector' 生效；'fulltext'/'hybrid' + rerank 待 M 道模型供应商与 tsvector 索引就绪后启用。
alter table public.knowledge_bases
  add column retrieval_config jsonb not null
    default '{"topK":5,"scoreThreshold":0.28,"searchMethod":"vector"}'::jsonb;

comment on column public.knowledge_bases.retrieval_config is
  '检索参数：{topK,scoreThreshold,searchMethod}。RAG 检索/命中测试读取；knowledge:create 可改。';
