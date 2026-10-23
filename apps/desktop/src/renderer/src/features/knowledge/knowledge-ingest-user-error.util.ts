import type { TFunction } from 'i18next'
import i18n from 'i18next'
import { knowledgeGraphStepDetail, localizeAiApiErrorMessage } from '@baishou/shared'

const INGEST_ERROR_COPY: Record<string, { key: string; fallback: string }> = {
  'source-not-embedded': {
    key: 'knowledge.source_not_embedded',
    fallback: i18n.t(
      'knowledge.source_not_embedded',
      '这份资料还没有完成向量。请先完成向量，再抽取图关系。'
    )
  },
  'graph-extract-not-configured': {
    key: 'knowledge.graph_extract_not_configured',
    fallback: i18n.t(
      'knowledge.graph_extract_not_configured',
      '还没配置图抽取模型。请先在设置里选好图抽取模型。'
    )
  },
  'extracted text missing': {
    key: 'knowledge.extracted_text_missing',
    fallback: i18n.t(
      'knowledge.extracted_text_missing',
      '这份资料还没有提取出文本，无法抽取图关系。'
    )
  },
  'embedding-not-configured': {
    key: 'knowledge.embedding_not_configured',
    fallback: i18n.t('knowledge.embedding_not_configured', '还没配置嵌入模型。')
  },
  'graph-extract-window-timeout': {
    key: 'knowledge.graph_extract_window_timeout',
    fallback: i18n.t(
      'knowledge.graph_extract_window_timeout',
      '这一窗图谱抽取超过 10 分钟没有完成，已中止。打开笔记本后会从检查点继续。'
    )
  }
}

function cleanIngestErrorMessage(message: string): string {
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()
}

/** 把摄入/抽图的内部错误码翻成用户能看懂的句子；未知错误去掉 IPC 前缀后原样返回。 */
export function knowledgeIngestUserMessage(raw: unknown, t: TFunction): string {
  const message = cleanIngestErrorMessage(raw instanceof Error ? raw.message : String(raw ?? ''))
  const detail = knowledgeGraphStepDetail(message).trim() || message
  const mapped = INGEST_ERROR_COPY[detail] || INGEST_ERROR_COPY[message]
  if (mapped) return t(mapped.key, mapped.fallback)
  return localizeAiApiErrorMessage(detail, t)
}
