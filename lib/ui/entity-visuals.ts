// 列表卡片的共用视觉：首字 Avatar 配色 + 状态 pill 样式。
//
// 抽出来是因为 Agent 管理页与 Plugin 各 Provider 页要求「布局相同」——
// 两处各存一份色板与状态样式，改一处忘一处就会立刻视觉分叉。

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-orange-400',
  'bg-emerald-500', 'bg-rose-500', 'bg-cyan-600', 'bg-amber-500',
]

/** 确定性配色：同一名称永远同一颜色（by 名称首字符码） */
export function getAvatarBg(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length]
}

/** Agent 与 Plugin 共用同一套状态机命名（draft/pending/published/offline） */
export type EntityStatus = 'draft' | 'pending' | 'published' | 'offline'

export const STATUS_PILL: Record<EntityStatus, { label: string; dotClass: string; pillClass: string }> = {
  draft:     { label: '草稿',   dotClass: 'bg-muted-foreground', pillClass: 'text-muted-foreground' },
  pending:   { label: '待审核', dotClass: 'bg-amber-500',        pillClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
  published: { label: '已发布', dotClass: 'bg-green-500',        pillClass: 'text-green-600 bg-green-50 dark:bg-green-950/40' },
  offline:   { label: '已下线', dotClass: 'bg-destructive',      pillClass: 'text-destructive bg-destructive/10' },
}
