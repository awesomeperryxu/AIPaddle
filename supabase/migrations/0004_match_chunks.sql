-- ============================================================
-- 0004：pgvector 相似度检索函数（RAG · 4.2.3）
-- match_chunks：按 query_embedding 余弦相似度返回最相近的内容块。
-- SECURITY INVOKER（默认）→ 调用方用请求级客户端时 chunks 的 RLS 生效，
-- 自动只返回本租户的块（跨租户隔离，无需函数内再过滤 org）。
-- 用 hnsw(vector_cosine_ops) 索引（migration 0001 已建）加速 <=> 余弦距离。
-- ============================================================

create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.deleted_at is null
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count
$$;
