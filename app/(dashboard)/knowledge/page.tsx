import { redirect } from 'next/navigation'
import { getRequestContext } from '@/lib/context'
import { KnowledgeQaView } from '@/components/views/knowledge-qa-view'

// 知识库问答（RAG）：真实检索增强问答页
export default async function Page() {
  const ctx = await getRequestContext()
  if (!ctx) redirect('/login')
  return <KnowledgeQaView />
}
