export function sourceMissingPageCount(input: {
  pageCount?: number | null
  textPageCount?: number | null
}): number | null {
  const pages = input.pageCount
  const textPages = input.textPageCount
  if (pages == null || textPages == null || pages <= textPages) return null
  return pages - textPages
}

export function isTextLayerHint(message: string): boolean {
  return /无文本层|没有文本层|几乎无文本层|lack a text layer|無文字層/.test(message)
}

export type SourceCardEvidence = { type: 'scan'; pageCount: number; missingPages: number }

export function sourceCardFailureReason(input: {
  status: string
  errorMessage?: string | null
}): string | null {
  if (input.status !== 'failed') return null
  const error = input.errorMessage?.trim() || ''
  return error || null
}

export function pickSourceCardEvidence(input: {
  pageCount?: number | null
  missingPages: number | null
  hideHints?: boolean
}): SourceCardEvidence | null {
  if (input.hideHints) return null
  if (input.missingPages != null && input.missingPages > 0 && input.pageCount != null) {
    return {
      type: 'scan',
      pageCount: input.pageCount,
      missingPages: input.missingPages
    }
  }
  return null
}
