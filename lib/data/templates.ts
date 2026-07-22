import 'server-only'
import type { RequestContext } from '@/lib/context'
import { createClient } from '@/lib/supabase/server'

export type TemplateType = 'agent' | 'assistant' | 'chatflow' | 'workflow' | 'text-generation'

export type Template = {
  id: string
  name: string
  type: TemplateType
  category: string
  description: string | null
  icon: string
  iconBackground: string
  tags: string[]
  dsl: Record<string, unknown>
  source: string
  license: string
  isBuiltIn: boolean
  createdAt: string
}

type Row = {
  id: string
  name: string
  type: string
  category: string
  description: string | null
  icon: string
  icon_background: string
  tags: string[]
  dsl: Record<string, unknown>
  source: string
  license: string
  is_built_in: boolean
  created_at: string
}

function toTemplate(row: Row): Template {
  return {
    id: row.id,
    name: row.name,
    type: row.type as TemplateType,
    category: row.category,
    description: row.description,
    icon: row.icon,
    iconBackground: row.icon_background,
    tags: row.tags ?? [],
    dsl: row.dsl ?? {},
    source: row.source,
    license: row.license,
    isBuiltIn: row.is_built_in,
    createdAt: row.created_at,
  }
}

export type ListTemplatesInput = {
  type?: TemplateType
  category?: string
  search?: string
}

export async function listTemplates(
  _ctx: RequestContext,
  input: ListTemplatesInput = {},
): Promise<Template[]> {
  const supabase = await createClient()
  let query = supabase
    .from('templates')
    .select('id,name,type,category,description,icon,icon_background,tags,dsl,source,license,is_built_in,created_at')
    .order('type')
    .order('name')

  if (input.type) query = query.eq('type', input.type)
  if (input.category) query = query.eq('category', input.category)
  if (input.search) {
    query = query.or(`name.ilike.%${input.search}%,description.ilike.%${input.search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(`listTemplates 失败: ${error.message}`)
  return (data ?? []).map(toTemplate)
}

export async function getTemplate(
  _ctx: RequestContext,
  id: string,
): Promise<Template | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('templates')
    .select('id,name,type,category,description,icon,icon_background,tags,dsl,source,license,is_built_in,created_at')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`getTemplate 失败: ${error.message}`)
  return data ? toTemplate(data as Row) : null
}
