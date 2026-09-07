import {
  buildDiaryEmbeddingGroupId,
  buildDiaryEmbeddingSourceId,
  buildDiaryEmbeddingTextArgs,
  coerceDiaryCalendarDate,
  diaryDateToSourceCreatedSeconds,
  hashEmbedSourceContent,
  mergeEmbedContentHashIntoMetadata
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
  contentHash?: string
}): {
  text: string
  chunkPrefix: string
  sourceType: 'diary'
  sourceId: string
  groupId: string
  vaultId: string
  metadataJson: string
  sourceCreatedAt: number
  contentHash: string
  skipIndexPrep?: boolean
} {
  const { text, chunkPrefix } = resolveDesktopDiaryEmbedText(params.content, params.date)
  const d = coerceDiaryCalendarDate(params.date)
  const updatedAtMs =
    params.updatedAt instanceof Date ? params.updatedAt.getTime() : params.updatedAt
  const contentHash = params.contentHash?.trim() || hashEmbedSourceContent(params.content)

  return {
    text,
    chunkPrefix,
    sourceType: 'diary',
    sourceId: buildDiaryEmbeddingSourceId(params.vaultId, params.diaryId),
    groupId: buildDiaryEmbeddingGroupId(),
    vaultId: params.vaultId,
    metadataJson: mergeEmbedContentHashIntoMetadata(
      JSON.stringify({ updated_at: updatedAtMs }),
      contentHash
    ),
    sourceCreatedAt: d ? diaryDateToSourceCreatedSeconds(d) * 1000 : Date.now(),
    contentHash,
    ...(params.skipIndexPrep ? { skipIndexPrep: true } : {})
  }
}
