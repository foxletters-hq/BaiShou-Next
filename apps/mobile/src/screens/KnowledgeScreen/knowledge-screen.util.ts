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

const SOURCE_NOT_EMBEDDED = 'source-not-embedded'

export function knowledgeIngestUserMessage(
  raw: unknown,
  t: (key: string, fallback: string) => string
): string {
  const message = raw instanceof Error ? raw.message : String(raw ?? '')
  if (message.trim() === SOURCE_NOT_EMBEDDED) {
    return t(
      'knowledge.source_not_embedded',
      '这份资料还没有完成向量。请先完成向量，再抽取图关系。'
    )
  }
  return message
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
