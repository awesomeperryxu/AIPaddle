import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import { listKnowledgeBases } from '@/lib/data/knowledge'
import { listDocuments } from '@/lib/data/documents'
import { listAgents } from '@/lib/data/agents'
import { KnowledgeAdminView } from '@/components/views/knowledge-admin-view'

// 真实库状态 → 原型视图的向量化状态
const VECTOR_STATUS: Record<string, 'processing' | 'completed' | 'failed'> = {
  active: 'completed',
  indexing: 'processing',
  error: 'failed',
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')

  const [kbs, docs, agentList] = await Promise.all([
    listKnowledgeBases(ctx),
    listDocuments(ctx),
    listAgents(ctx),
  ])

  // 各库存储大小
  const sizeByKb = new Map<string, number>()
  for (const d of docs) {
    sizeByKb.set(d.kbId, (sizeByKb.get(d.kbId) ?? 0) + (d.sizeBytes ?? 0))
  }

  const knowledgeBases = kbs.map((kb) => ({
    id: kb.id,
    name: kb.name,
    description: kb.description || '—',
    documents: kb.documentCount,
    vectorStatus: VECTOR_STATUS[kb.status] ?? 'completed',
    visibility: kb.visibility,
    lastUpdated: kb.createdAt,
    size: formatSize(sizeByKb.get(kb.id) ?? 0),
  }))

  const agents = agentList.map((a) => ({ id: a.id, name: a.name }))

  const documents = docs.map((d) => ({
    id: d.id,
    filename: d.filename,
    kbId: d.kbId,
    status: d.status,
    createdAt: d.createdAt,
  }))

  return (
    <KnowledgeAdminView
      knowledgeBases={knowledgeBases}
      documents={documents}
      agents={agents}
      canManage={can(ctx, 'knowledge:create')}
    />
  )
}
