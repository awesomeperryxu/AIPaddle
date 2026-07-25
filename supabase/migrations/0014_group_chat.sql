-- 4.1.21 / ADR-015：数字员工群聊 —— 多方群聊（参与者 = 人 + 数字员工/团队）。
-- 复用 conversations/messages 基础设施（ADR-008：仍只经 lib/data/* 访问）：
--   · conversations 加 kind 区分 群聊 vs 个人助理/agent 会话（默认 assistant，兼容存量）；
--   · messages 加发言者标注列（谁说的 + 触发原因 mention/proactive；存量/个人会话留空）；
--   · 新增参与者表 conversation_participants（人/数字员工/团队）。
-- RLS/org 写法参照 0013（数字员工团队）。本迁移不 apply，仅登记契约。

-- conversations：区分群聊。存量行默认 'assistant'，不影响个人助理会话（另按 source='assistant' 过滤）。
alter table public.conversations
  add column kind text not null default 'assistant'
  check (kind in ('assistant','group'));

-- messages：发言者标注（群聊用）。人类发言 speaker_type='user'；数字员工发言 'agent' + reason。
alter table public.messages
  add column speaker_type text check (speaker_type in ('user','agent')),
  add column speaker_id   uuid,
  add column speak_reason text check (speak_reason in ('mention','proactive'));

-- 群聊参与者：人(user) / 数字员工(agent) / 数字员工团队(team)。团队读取时展开为其成员数字员工。
create table public.conversation_participants (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.tenants(id),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  participant_type text not null check (participant_type in ('user','agent','team')),
  participant_id   uuid not null,
  created_at       timestamptz not null default now(),
  unique (conversation_id, participant_type, participant_id)
);

alter table public.conversation_participants enable row level security;

-- RLS：仅本租户可见/可写（org 由可信会话推导，见 ADR-002；写法参照 0013 team_members）。
create policy conversation_participants_org_select on public.conversation_participants
  for select using (org_id = public.current_org_id());
create policy conversation_participants_org_insert on public.conversation_participants
  for insert with check (org_id = public.current_org_id());
create policy conversation_participants_org_update on public.conversation_participants
  for update using (org_id = public.current_org_id());

create index idx_conv_participants_conv on public.conversation_participants (conversation_id);
create index idx_conv_kind on public.conversations (kind) where deleted_at is null;
