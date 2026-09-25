import type { KnowledgeIngestProgress } from './notebook-job-progress.util'

type Translate = (key: string, fallback: string, options?: Record<string, number>) => string

export function knowledgeIngestProgressLabel(
  t: Translate,
  progress?: KnowledgeIngestProgress | null
): string | null {
  if (!progress) return null
  const page = Math.max(0, progress.page)
  const total = Math.max(0, progress.total)
  if (progress.phase === 'embed') {
    if (total <= 0) return t('knowledge.status_embedding', '正在建立索引')
    return t('knowledge.status_embed_progress', '正在建立索引 {{page}}/{{total}}', { page, total })
  }
  if (progress.phase === 'parse') {
    if (total > 0) {
      return t('knowledge.status_pdf_parse_progress', '正在读取 PDF {{page}}/{{total}}', {
        page,
        total
      })
    }
    if (page > 0) return t('knowledge.status_pdf_parse_page', '正在读取 PDF 第 {{page}} 页', { page })
    return t('knowledge.status_pdf_parse', '正在读取 PDF')
  }
  if (progress.phase === 'render') {
    if (total > 0) {
      return t('knowledge.status_pdf_render_progress', '正在渲染页面 {{page}}/{{total}}', {
        page,
        total
      })
    }
    return t('knowledge.status_pdf_render', '正在渲染页面')
  }
  if (progress.phase === 'recognize') {
    if (total > 0) {
      return t('knowledge.status_recognize_progress', '正在识图 {{page}}/{{total}}', { page, total })
    }
    return t('knowledge.status_recognize', '正在识图')
  }
  if (total <= 0) return t('knowledge.status_extracting', '正在提取文本')
  return t('knowledge.status_ocr_progress', 'OCR 中 {{page}}/{{total}}', { page, total })
}
