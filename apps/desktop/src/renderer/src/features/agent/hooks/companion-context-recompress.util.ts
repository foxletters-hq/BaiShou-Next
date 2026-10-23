type ContextDialogStateLike = {
  compressedContent?: string
  flatEntries?: Array<{ kind?: string; summaryText?: string }>
}

export function applyCompanionContextRecompressResult<T extends ContextDialogStateLike>(
  prev: T,
  summaryText: string
): T {
  return {
    ...prev,
    compressedContent: summaryText,
    flatEntries: prev.flatEntries?.map((entry) =>
      entry.kind === 'compression-summary' ? { ...entry, summaryText } : entry
    )
  }
}
