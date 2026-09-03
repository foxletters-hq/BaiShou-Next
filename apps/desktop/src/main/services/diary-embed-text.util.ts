import {
  buildDiaryEmbeddingGroupId,
  buildDiaryEmbeddingSourceId,
  buildDiaryEmbeddingTextArgs,
  coerceDiaryCalendarDate,
  diaryDateToSourceCreatedSeconds
} from '@baishou/shared'

export function resolveDesktopDiaryEmbedText(content: string, date: Date | string) {
  return buildDiaryEmbeddingTextArgs(content, date)
}

export function buildDesktopDiaryReEmbedArgs(params: {
  content: string
  date: Date | string
  vaultId: string
  diaryId: number | string
  updatedAt: Date | number
  skipIndexPrep?: boolean
}): {
  text: string
  chunkPrefix: string
  sourceType: 'diary'
  sourceId: string
  groupId: string
  vaultId: string
  metadataJson: string
  sourceCreatedAt: number
  skipIndexPrep?: boolean
} {
  const { text, chunkPrefix } = resolveDesktopDiaryEmbedText(params.content, params.date)
  const d = coerceDiaryCalendarDate(params.date)
  const updatedAtMs =
    params.updatedAt instanceof Date ? params.updatedAt.getTime() : params.updatedAt

  return {
    text,
    chunkPrefix,
    sourceType: 'diary',
    sourceId: buildDiaryEmbeddingSourceId(params.vaultId, params.diaryId),
    groupId: buildDiaryEmbeddingGroupId(),
    vaultId: params.vaultId,
    metadataJson: JSON.stringify({ updated_at: updatedAtMs }),
    sourceCreatedAt: d ? diaryDateToSourceCreatedSeconds(d) * 1000 : Date.now(),
    ...(params.skipIndexPrep ? { skipIndexPrep: true } : {})
  }
}
