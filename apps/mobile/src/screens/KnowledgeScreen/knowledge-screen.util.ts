import { knowledgeGraphStepDetail, localizeAiApiErrorMessage } from '@baishou/shared'

export type KnowledgeNotebookListRow = {
  id: string
  name: string
  description?: string
  sortOrder?: number
  createdAt?: number
  coverTone?: string
  coverIcon?: string
  coverImage?: string
}

export function sortNotebooksForMobileList<T extends KnowledgeNotebookListRow>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const sa = a.sortOrder ?? 0
    const sb = b.sortOrder ?? 0
    if (sa !== sb) return sa - sb
    const ca = b.createdAt ?? 0
    const cb = a.createdAt ?? 0
    if (ca !== cb) return ca - cb
    return String(a.id).localeCompare(String(b.id))
  })
}

export function resolveNotebookRename(current: string, draft: string): string | null {
  const next = draft.trim()
  if (!next || next === current.trim()) return null
  return next
}

export function moveNotebookByOffset<T extends { id: string }>(
  list: T[],
  index: number,
  offset: number
): T[] | null {
  const to = index + offset
  if (index < 0 || to < 0 || to >= list.length) return null
  const next = [...list]
  const [row] = next.splice(index, 1)
  if (!row) return null
  next.splice(to, 0, row)
  return next
}

export type KnowledgeNotebookStats = {
  sources: number
  chunks: number
  pendingJobs: number
  originalBytes: number
  totalBytes: number
}

export function formatKnowledgeBytesMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0'
  return (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)
}

export function knowledgeSourceCanRetry(status: string): boolean {
  return status === 'failed' || status === 'needs_ocr'
}

export function knowledgeSourceCanReembedGraph(status: string): boolean {
  return status === 'ready' || status === 'partial'
}

export function knowledgeSourceCanEmbed(status: string): boolean {
  return status === 'stored'
}

export function knowledgeSourceCanCancelExtract(source: {
  status: string
  extractEngine?: string | null
}): boolean {
  const isOcrEngine = source.extractEngine === 'ocr' || source.extractEngine === 'vision'
  return source.status === 'extracting' || (source.status === 'pending' && isOcrEngine)
}

export function knowledgeSourceNeedsOcr(status: string): boolean {
  return status === 'needs_ocr' || status === 'partial'
}

const SOURCE_NOT_EMBEDDED = 'source-not-embedded'

export function knowledgeIngestUserMessage(
  raw: unknown,
  t: (key: string, fallback: string) => string
): string {
  const message = raw instanceof Error ? raw.message : String(raw ?? '')
  const detail = knowledgeGraphStepDetail(message).trim() || message.trim()
  if (detail === SOURCE_NOT_EMBEDDED || message.trim() === SOURCE_NOT_EMBEDDED) {
    return t(
      'knowledge.source_not_embedded',
      '这份资料还没有完成向量。请先完成向量，再抽取图关系。'
    )
  }
  if (detail === 'knowledge-model-mismatch' || message.trim() === 'knowledge-model-mismatch') {
    return t(
      'knowledge.model_mismatch_hard_block',
      '提问已硬拦截。请重建索引后再问，否则答案会错得很像样。'
    )
  }
  return localizeAiApiErrorMessage(detail, t)
}

export function knowledgeSourceStatusLabel(
  status: string,
  t: (key: string, fallback: string) => string
): string {
  switch (status) {
    case 'pending':
      return t('knowledge.status_pending', '等待中')
    case 'extracting':
      return t('knowledge.status_extracting', '提取中')
    case 'needs_ocr':
      return t('knowledge.status_needs_ocr', '需 OCR')
    case 'partial':
      return t('knowledge.status_partial', '部分文本')
    case 'embedding':
      return t('knowledge.status_embedding', '索引中')
    case 'ready':
      return t('knowledge.status_ready', '就绪')
    case 'failed':
      return t('knowledge.status_failed', '失败')
    case 'stored':
      return t('knowledge.status_stored', '待整理')
    default:
      return status
  }
}

export const NOTEBOOK_TONE_COLORS: Record<string, string> = {
  lavender: '#c4b5fd',
  cream: '#fde68a',
  peach: '#fdba74',
  mint: '#6ee7b7',
  sky: '#7dd3fc',
  rose: '#fda4af',
  lilac: '#d8b4fe',
  sand: '#d6d3d1'
}
