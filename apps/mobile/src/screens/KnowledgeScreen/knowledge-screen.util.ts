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
      return t('knowledge.status_stored', '仅原文')
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
