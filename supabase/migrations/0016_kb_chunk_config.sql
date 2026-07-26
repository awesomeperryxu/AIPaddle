-- 4.2.7：知识库可配置切块参数（原 800/100 硬编码于 lib/kb/ingest）。
-- 以 jsonb 存放，便于后续扩展（分段模式/预处理规则等）；合法值由应用层校验。
alter table public.knowledge_bases
  add column chunk_config jsonb not null
    default '{"chunkSize":800,"chunkOverlap":100,"separator":"\n\n"}'::jsonb;

comment on column public.knowledge_bases.chunk_config is
  '切块参数：{chunkSize,chunkOverlap,separator}。入库时 lib/kb/ingest 读取；knowledge:create 可改。';
