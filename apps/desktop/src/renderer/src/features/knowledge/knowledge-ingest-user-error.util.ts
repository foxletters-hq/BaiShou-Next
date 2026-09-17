import type { TFunction } from 'i18next'

const SOURCE_NOT_EMBEDDED = 'source-not-embedded'

function cleanIngestErrorMessage(message: string): string {
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim()
}

/** 仅翻译 source-not-embedded；其余错误原样返回，不扩大映射面。 */
export function knowledgeIngestUserMessage(raw: unknown, t: TFunction): string {
  const message = raw instanceof Error ? raw.message : String(raw ?? '')
  if (cleanIngestErrorMessage(message) === SOURCE_NOT_EMBEDDED) {
    return t(
      'knowledge.source_not_embedded',
      '这份资料还没有完成向量。请先完成向量，再抽取图关系。'
    )
  }
  return message
}
