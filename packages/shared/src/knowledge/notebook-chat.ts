export type NotebookChatRole = 'user' | 'assistant'

export interface NotebookChatSessionRecord {
  id: string
  notebookId: string
  assistantId: string
  title: string
  pinned?: boolean
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

export interface NotebookChatCitation {
  sourceId?: string
  title: string
  excerpt?: string
  page?: number
  offset?: number
  chunkIndex?: number
}

export interface NotebookChatMessageRecord {
  id: string
  sessionId: string
  role: NotebookChatRole
  text: string
  reasoning?: string
  citations?: NotebookChatCitation[]
  createdAt: number
}

export type NotebookAskProgressPhase = 'retrieving' | 'thinking' | 'answering' | 'tool'

export type NotebookAskToolStatus = 'running' | 'done' | 'failed'

export interface NotebookAskToolState {
  name: string
  displayName?: string
  status: NotebookAskToolStatus
  result?: string
}

export interface NotebookAskProgress {
  notebookId: string
  phase: NotebookAskProgressPhase
  text?: string
  reasoning?: string
  toolName?: string
  toolStatus?: NotebookAskToolStatus
  tools?: NotebookAskToolState[]
}

export function notebookChatTitleFromQuestion(question: string): string {
  const trimmed = question.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  return trimmed.length > 28 ? `${trimmed.slice(0, 28)}…` : trimmed
}

export function parseNotebookChatCitations(value: unknown): NotebookChatCitation[] {
  if (!Array.isArray(value)) return []
  const out: NotebookChatCitation[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const title = typeof rec.title === 'string' ? rec.title.trim() : ''
    if (!title) continue
    const next: NotebookChatCitation = { title }
    if (typeof rec.sourceId === 'string') next.sourceId = rec.sourceId
    if (typeof rec.excerpt === 'string') next.excerpt = rec.excerpt
    if (typeof rec.page === 'number') next.page = rec.page
    if (typeof rec.offset === 'number') next.offset = rec.offset
    if (typeof rec.chunkIndex === 'number') next.chunkIndex = rec.chunkIndex
    out.push(next)
  }
  return out
}

export function parseNotebookChatReasoning(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text || undefined
}
