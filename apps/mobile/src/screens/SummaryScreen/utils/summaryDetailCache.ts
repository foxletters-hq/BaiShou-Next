export interface CachedSummaryDetail {
  id?: number
  type: string
  startDate: string
  endDate: string
  content: string
  sourceIds?: string | null
  generatedAt?: string
}

let pendingSummary: CachedSummaryDetail | null = null

const contentPatches = new Map<string, CachedSummaryDetail>()
let patchVersion = 0
const patchListeners = new Set<() => void>()

function emitPatchChange(): void {
  patchVersion += 1
  patchListeners.forEach((listener) => listener())
}

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

/** 保存后立刻覆盖画廊列表预览，避免等全量 list() 才更新 */
export function patchSummaryDetailCache(summary: CachedSummaryDetail) {
  if (summary.id == null) return
  contentPatches.set(String(summary.id), summary)
  setPendingSummaryDetail(summary)
  emitPatchChange()
}

/**
 * 列表刷新后合并 patch：DB 仍空时保留本地已保存正文，避免预览被清空。
 * 同时清理已不在列表中的过期 patch。
 */
export function reconcileSummaryContentPatches<T extends { id?: string | number; content: string }>(
  items: T[]
): T[] {
  if (contentPatches.size === 0) return items

  const liveIds = new Set(items.map((item) => String(item.id)))
  let patchesChanged = false
  for (const id of [...contentPatches.keys()]) {
    if (!liveIds.has(id)) {
      contentPatches.delete(id)
      patchesChanged = true
    }
  }

  const next = items.map((item) => {
    const patch = contentPatches.get(String(item.id))
    if (!patch) return item
    if (item.content && item.content === patch.content) {
      contentPatches.delete(String(item.id))
      patchesChanged = true
      return item
    }
    // DB 仍空或尚未追上本地保存：保留 patch 正文，避免预览回退到旧内容
    if (patch.content && item.content !== patch.content) {
      return { ...item, content: patch.content }
    }
    return item
  })

  if (patchesChanged) emitPatchChange()
  return next
}

export function peekSummaryDetailPatch(summaryId: string): CachedSummaryDetail | null {
  return contentPatches.get(summaryId) ?? null
}

export function clearAllSummaryDetailPatches() {
  if (contentPatches.size === 0) return
  contentPatches.clear()
  emitPatchChange()
}

export function subscribeSummaryDetailPatches(listener: () => void): () => void {
  patchListeners.add(listener)
  return () => patchListeners.delete(listener)
}

export function getSummaryDetailPatchVersion(): number {
  return patchVersion
}

export function applySummaryContentPatches<T extends { id?: string | number; content: string }>(
  items: T[]
): T[] {
  if (contentPatches.size === 0) return items
  return items.map((item) => {
    const patch = contentPatches.get(String(item.id))
    return patch ? { ...item, content: patch.content } : item
  })
}

type SummaryLike = {
  id?: string | number
  type: string
  startDate: string
  endDate: string
  content: string
  generatedAt?: string
}

export function resolveSummaryForNavigation(
  id: string,
  fallback?: SummaryLike
): CachedSummaryDetail | null {
  const patch = peekSummaryDetailPatch(id)
  if (patch) return patch
  if (!fallback) return null
  return {
    id: typeof fallback.id === 'number' ? fallback.id : Number(fallback.id),
    type: fallback.type,
    startDate: fallback.startDate,
    endDate: fallback.endDate,
    content: fallback.content,
    generatedAt: fallback.generatedAt
  }
}
