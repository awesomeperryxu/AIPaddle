import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

// 数据层（ADR-008 / 4.1.21 / ADR-015）：唯一访问 群聊会话/参与者/群消息 的地方。
// 首参 ctx，用请求级客户端（RLS 生效），按租户隔离。参与者/发言者门控在 API 层（不信前端）。
// 复用 conversations(kind='group') + messages(speaker_* 列) + conversation_participants。

export type ParticipantType = 'user' | 'agent' | 'team'
export type GroupParticipant = { type: ParticipantType; id: string }

export type Group = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  participants: GroupParticipant[]
  /** team 展开后本群全部数字员工 id（去重）——供发言判定用。 */
  agentIds: string[]
}

export type GroupMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  speakerType: 'user' | 'agent' | null
  speakerId: string | null
  reason: 'mention' | 'proactive' | null
  createdAt: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ConvRow = { id: string; title: string | null; created_at: string | null; updated_at: string | null }

function mapGroupBasic(r: ConvRow): Omit<Group, 'participants' | 'agentIds'> {
  return { id: r.id, name: r.title || '新群聊', createdAt: r.created_at ?? '', updatedAt: r.updated_at ?? '' }
}

/** 列出本租户群聊（最近更新在前，不含参与者/消息明细）。RLS 隔离本租户。 */
export async function listGroups(_ctx: RequestContext): Promise<Omit<Group, 'participants' | 'agentIds'>[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversations')
    .select('id,title,created_at,updated_at')
    .eq('kind', 'group')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data as ConvRow[] | null) ?? []).map(mapGroupBasic)
}

/** 创建群聊：建 kind='group' 会话 + 写参与者（去重，仅合法 UUID）。participants 已由 API 层门控。 */
export async function createGroup(
  ctx: RequestContext,
  input: { name: string; participants: GroupParticipant[] },
): Promise<Group> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversations')
    .insert({ org_id: ctx.orgId, user_id: ctx.userId, kind: 'group', source: 'agents', title: input.name.trim() || '新群聊' })
    .select('id,title,created_at,updated_at')
    .single()
  if (error) throw new Error(error.message)
  const conv = data as ConvRow

  const seen = new Set<string>()
  const rows = input.participants
    .filter((p) => UUID_RE.test(p.id))
    .filter((p) => {
      const k = `${p.type}:${p.id}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map((p) => ({ org_id: ctx.orgId, conversation_id: conv.id, participant_type: p.type, participant_id: p.id }))
  if (rows.length > 0) {
    const { error: pErr } = await supabase.from('conversation_participants').insert(rows)
    if (pErr) throw new Error(pErr.message)
  }
  const group = await getGroup(ctx, conv.id)
  return group ?? { ...mapGroupBasic(conv), participants: [], agentIds: [] }
}

/** 取单个群聊（含参与者；team 展开为其成员数字员工）。RLS 兜底：他租户/不存在 → null。 */
export async function getGroup(_ctx: RequestContext, id: string): Promise<Group | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversations')
    .select('id,title,created_at,updated_at')
    .eq('id', id)
    .eq('kind', 'group')
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const { data: pRows, error: pErr } = await supabase
    .from('conversation_participants')
    .select('participant_type,participant_id')
    .eq('conversation_id', id)
  if (pErr) throw new Error(pErr.message)
  const participants: GroupParticipant[] = ((pRows as { participant_type: ParticipantType; participant_id: string }[] | null) ?? [])
    .map((r) => ({ type: r.participant_type, id: r.participant_id }))

  const agentIds = new Set<string>(participants.filter((p) => p.type === 'agent').map((p) => p.id))
  const teamIds = participants.filter((p) => p.type === 'team').map((p) => p.id)
  if (teamIds.length > 0) {
    const { data: mem, error: mErr } = await supabase
      .from('team_members')
      .select('agent_id')
      .in('team_id', teamIds)
    if (mErr) throw new Error(mErr.message)
    for (const m of (mem as { agent_id: string }[] | null) ?? []) agentIds.add(m.agent_id)
  }

  return { ...mapGroupBasic(data as ConvRow), participants, agentIds: [...agentIds] }
}

type MsgRow = {
  id: string
  role: string
  content: string
  speaker_type: string | null
  speaker_id: string | null
  speak_reason: string | null
  created_at: string | null
}

function mapMsg(r: MsgRow): GroupMessage {
  return {
    id: r.id,
    role: r.role as GroupMessage['role'],
    content: r.content,
    speakerType: (r.speaker_type as GroupMessage['speakerType']) ?? null,
    speakerId: r.speaker_id ?? null,
    reason: (r.speak_reason as GroupMessage['reason']) ?? null,
    createdAt: r.created_at ?? '',
  }
}

/** 列出某群聊消息（时间正序）。调用方须先 getGroup 校验归属。 */
export async function listMessages(_ctx: RequestContext, groupId: string): Promise<GroupMessage[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('id,role,content,speaker_type,speaker_id,speak_reason,created_at')
    .eq('conversation_id', groupId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data as MsgRow[] | null) ?? []).map(mapMsg)
}

/** 追加一条群消息（人类/数字员工），并更新会话 updated_at。返回新消息。 */
export async function addMessage(
  ctx: RequestContext,
  groupId: string,
  msg: {
    role: 'user' | 'assistant'
    content: string
    speakerType: 'user' | 'agent'
    speakerId: string
    reason?: 'mention' | 'proactive'
  },
): Promise<GroupMessage> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .insert({
      org_id: ctx.orgId,
      conversation_id: groupId,
      role: msg.role,
      content: msg.content,
      speaker_type: msg.speakerType,
      speaker_id: msg.speakerId,
      speak_reason: msg.reason ?? null,
    })
    .select('id,role,content,speaker_type,speaker_id,speak_reason,created_at')
    .single()
  if (error) throw new Error(error.message)
  await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', groupId)
  return mapMsg(data as MsgRow)
}
