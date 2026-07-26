import { redirect, notFound } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { can } from '@/lib/auth/permissions'
import {
  getKnowledgeBase,
  getKbChunkConfig,
  getKbRetrievalConfig,
  listKbAgents,
  DEFAULT_KB_CHUNK_CONFIG,
  DEFAULT_KB_RETRIEVAL_CONFIG,
} from '@/lib/data/knowledge'
import { listDocuments } from '@/lib/data/documents'
import { listAgents } from '@/lib/data/agents'
import { KnowledgeAdminDetailView } from '@/components/views/knowledge-admin-detail-view'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')

  const { id } = await params
  const [kb, docs, agentList, kbAgents, chunkConfig, retrievalConfig] = await Promise.all([
    getKnowledgeBase(ctx, id),
    listDocuments(ctx, id),
    listAgents(ctx),
    listKbAgents(ctx, id),
    getKbChunkConfig(ctx, id).catch(() => DEFAULT_KB_CHUNK_CONFIG),
    getKbRetrievalConfig(ctx, id).catch(() => DEFAULT_KB_RETRIEVAL_CONFIG),
  ])

  if (!kb) notFound()

  const agents = agentList.map(a => ({ id: a.id, name: a.name }))
  const linkedAgentIds = kbAgents.map(a => a.agentId)

  const documents = docs.map(d => ({
    id: d.id,
    filename: d.filename,
    kbId: d.kbId,
    status: d.status,
    sizeBytes: d.sizeBytes,
    createdAt: d.createdAt,
  }))

  return (
    <KnowledgeAdminDetailView
      kb={kb}
      documents={documents}
      agents={agents}
      initialChunkConfig={chunkConfig}
      initialRetrievalConfig={retrievalConfig}
      linkedAgentIds={linkedAgentIds}
      canManage={can(ctx, 'knowledge:create')}
    />
  )
}
