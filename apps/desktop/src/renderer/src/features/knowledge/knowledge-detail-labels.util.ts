import type { KnowledgeSourceMenuAction } from './knowledge-source-menu.util'

export const OCR_LANGUAGE_PRESETS = [
  { value: 'chi_sim+eng', labelKey: 'knowledge.ocr_lang_chi_sim_eng' },
  { value: 'chi_tra+eng', labelKey: 'knowledge.ocr_lang_chi_tra_eng' },
  { value: 'eng', labelKey: 'knowledge.ocr_lang_eng' },
  { value: 'jpn+eng', labelKey: 'knowledge.ocr_lang_jpn_eng' }
] as const

type Translate = (key: string, fallback: string) => string

export function knowledgeSourceStatusLabel(t: Translate, status: string): string {
  switch (status) {
    case 'pending':
      return t('knowledge.status_pending', '等待整理')
    case 'extracting':
      return t('knowledge.status_extracting', '正在提取文本')
    case 'needs_ocr':
      return t('knowledge.status_needs_ocr', '需 OCR')
    case 'partial':
      return t('knowledge.status_partial', '部分文本')
    case 'embedding':
      return t('knowledge.status_embedding', '正在建立索引')
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

export function extractEngineShortLabel(t: Translate, engine: 'simple' | 'ocr' | 'vision'): string {
  if (engine === 'ocr') return t('knowledge.engine_ocr_short', '本地 OCR')
  if (engine === 'vision') return t('knowledge.engine_vision_short', '视觉模型')
  return t('knowledge.engine_simple_short', 'PDF 文字层')
}

export function knowledgeSourceMenuLabel(t: Translate, action: KnowledgeSourceMenuAction): string {
  switch (action) {
    case 'preview':
      return t('knowledge.preview_source', '预览')
    case 'embed':
      return t('knowledge.embed_source', '嵌入')
    case 'reembed':
      return t('knowledge.reembed_source', '重新嵌入')
    case 'reembed-vector':
      return t('knowledge.reembed_vector', '向量')
    case 'reembed-graph':
      return t('knowledge.reembed_graph', '图数据')
    case 'delete':
      return t('knowledge.delete_source', '删除')
    case 'cancel':
      return t('knowledge.cancel_extract', '取消')
    case 'retry':
      return t('knowledge.retry', '重试')
    case 'ocr':
      return t('knowledge.ocr_missing_pages', '只 OCR 缺失页')
  }
}

export function knowledgeSourceFileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() || name
  const idx = base.lastIndexOf('.')
  if (idx <= 0 || idx === base.length - 1) return ''
  return base.slice(idx + 1).toLowerCase()
}
