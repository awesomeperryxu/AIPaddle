-- ============================================================
-- 0005：知识库可见性范围（4.2.8）
-- 1) knowledge_bases 增加 visibility：org=全员可见 / restricted=仅关联 Agent 可用
-- 2) match_chunks 增加可选 kb 过滤（按 documents.kb_id），供 RAG 按可访问范围检索
--    - filter_kb_ids 为 null → 不过滤（向后兼容）
--    - 为空数组 → 命中范围为空（无可访问 KB 时不应检索到任何块）
-- ============================================================

alter table public.knowledge_bases
  add column if not exists visibility text not null default 'org'
    check (visibility in ('org', 'restricted'));

-- 先删 0004 的 2 参旧版：加了参数的 create or replace 会建成重载而非替换，
-- 残留旧版会造成 2 参调用歧义。删后仅保留下面的 3 参版。
drop function if exists public.match_chunks(vector, int);

create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_count int default 5,
  filter_kb_ids uuid[] default null
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
  join public.documents d
    on d.id = c.document_id
   and d.deleted_at is null
  where c.deleted_at is null
    and c.embedding is not null
    and (filter_kb_ids is null or d.kb_id = any (filter_kb_ids))
  order by c.embedding <=> query_embedding
  limit match_count
$$;
