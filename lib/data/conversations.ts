import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 个人助理会话/消息数据层（切片1）：请求级客户端 + org RLS；再按 user_id + source='assistant'
// 过滤 → 私人会话仅本人可见（用户级 RLS 加固留二期）。ADR-008：唯一访问 conversations/messages 的层。

export type AssistantConversation = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export type Citation = { documentId: string; filename: string; snippet: string; similarity: number }
export type AssistantMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  citations: Citation[]
  createdAt: string
}

type ConvRow = { id: string; title: string | null; created_at: string | null; updated_at: string | null }

function mapConv(r: ConvRow): AssistantConversation {
  return {
    id: r.id,
    title: r.title || '新对话',
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  }
}

/** 列出本人的个人助理会话（最近更新在前）。 */
export async function listConversations(ctx: RequestContext): Promise<AssistantConversation[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversations')
    .select('id,title,created_at,updated_at')
    .eq('user_id', ctx.userId)
    .eq('source', 'assistant')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as ConvRow[] | null) ?? []).map(mapConv)
}

/** 新建个人助理会话。 */
export async function createConversation(ctx: RequestContext, title?: string): Promise<AssistantConversation> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversations')
    .insert({ org_id: ctx.orgId, user_id: ctx.userId, source: 'assistant', title: title?.trim() || '新对话' })
    .select('id,title,created_at,updated_at')
    .single()
  if (error) throw new Error(error.message)
  return mapConv(data as ConvRow)
}

/** 校验会话归属（本人 + assistant）；返回 id 或 null。 */
export async function getOwnedConversation(ctx: RequestContext, id: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', id)
    .eq('user_id', ctx.userId)
    .eq('source', 'assistant')
    .is('deleted_at', null)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export async function renameConversation(ctx: RequestContext, id: string, title: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('conversations')
    .update({ title: title.trim() || '新对话', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', ctx.userId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

export async function deleteConversation(ctx: RequestContext, id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('conversations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', ctx.userId)
  if (error) throw new Error(error.message)
}

/** 列出某会话的消息（时间正序）。调用方须先 getOwnedConversation 校验归属。 */
export async function listMessages(ctx: RequestContext, conversationId: string): Promise<AssistantMessage[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('id,role,content,citations,created_at')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  type Row = { id: string; role: string; content: string; citations: unknown; created_at: string | null }
  return ((data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    role: r.role as AssistantMessage['role'],
    content: r.content,
    citations: Array.isArray(r.citations) ? (r.citations as Citation[]) : [],
    createdAt: r.created_at ?? '',
  }))
}

/** 追加一条消息，并更新会话 updated_at。 */
export async function appendMessage(
  ctx: RequestContext,
  conversationId: string,
  msg: { role: 'user' | 'assistant'; content: string; tokens?: number; citations?: Citation[] },
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    org_id: ctx.orgId,
    conversation_id: conversationId,
    role: msg.role,
    content: msg.content,
    tokens: msg.tokens ?? 0,
    citations: msg.citations ?? [],
  })
  if (error) throw new Error(error.message)
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
}
