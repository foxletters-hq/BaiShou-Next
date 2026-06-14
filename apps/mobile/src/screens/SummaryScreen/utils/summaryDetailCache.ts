interface CachedSummaryDetail {
  id?: number
  type: string
  startDate: string
  endDate: string
  content: string
  sourceIds?: string | null
  generatedAt?: string
}

let pendingSummary: CachedSummaryDetail | null = null

export function setPendingSummaryDetail(summary: CachedSummaryDetail) {
  pendingSummary = summary
}

export function consumePendingSummaryDetail(summaryId: string): CachedSummaryDetail | null {
  if (!pendingSummary || String(pendingSummary.id) !== summaryId) {
    return null
  }
  const summary = pendingSummary
  pendingSummary = null
  return summary
}
