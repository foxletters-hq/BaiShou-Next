export interface CachedSummaryDetail {
  id?: number
  type: string
  startDate: string
  endDate: string
  content: string
  sourceIds?: string | null
  generatedAt?: string
  updatedAt?: string
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
  const prev = contentPatches.get(String(summary.id))
  contentPatches.set(String(summary.id), {
    ...prev,
    ...summary,
    // 未显式带上时保留旧 patch / 勿把时间字段抹成 undefined
    generatedAt: summary.generatedAt ?? prev?.generatedAt,
    updatedAt: summary.updatedAt ?? prev?.updatedAt
  })
  setPendingSummaryDetail(contentPatches.get(String(summary.id))!)
  emitPatchChange()
}

function generatedAtMs(value: string | undefined): number {
  if (!value) return 0
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : 0
}

/**
 * 列表刷新后合并 patch：
 * - DB 仍空时保留本地已保存正文，避免预览被清空
 * - DB 已有不同正文时：仅当本地 patch 的 generatedAt 更新才覆盖，否则采信 DB（同步/再生）
 * - 同时清理已不在列表中的过期 patch
 */
export function reconcileSummaryContentPatches<
  T extends { id?: string | number; content: string; generatedAt?: string; updatedAt?: string }
>(items: T[]): T[] {
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
      const merged = { ...item }
      if (patch.generatedAt && generatedAtMs(patch.generatedAt) > generatedAtMs(item.generatedAt)) {
        merged.generatedAt = patch.generatedAt
      }
      if (patch.updatedAt && generatedAtMs(patch.updatedAt) > generatedAtMs(item.updatedAt)) {
        merged.updatedAt = patch.updatedAt
      }
      return merged
    }
    // DB 仍空：保留 patch，避免保存后预览回退
    if (!item.content && patch.content) {
      return {
        ...item,
        content: patch.content,
        ...(patch.generatedAt ? { generatedAt: patch.generatedAt } : {}),
        ...(patch.updatedAt ? { updatedAt: patch.updatedAt } : {})
      }
    }
    // DB 已有不同正文：仅本地更新时间更新时才压过（否则清 patch，避免挡住同步/再生）
    if (item.content && patch.content && item.content !== patch.content) {
      const patchTs = Math.max(generatedAtMs(patch.updatedAt), generatedAtMs(patch.generatedAt))
      const itemTs = Math.max(generatedAtMs(item.updatedAt), generatedAtMs(item.generatedAt))
      if (patchTs > itemTs) {
        return {
          ...item,
          content: patch.content,
          ...(patch.generatedAt ? { generatedAt: patch.generatedAt } : {}),
          ...(patch.updatedAt ? { updatedAt: patch.updatedAt } : {})
        }
      }
      contentPatches.delete(String(item.id))
      patchesChanged = true
      return item
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

export function applySummaryContentPatches<
  T extends { id?: string | number; content: string; generatedAt?: string; updatedAt?: string }
>(items: T[]): T[] {
  if (contentPatches.size === 0) return items
  return items.map((item) => {
    const patch = contentPatches.get(String(item.id))
    if (!patch) return item
    return {
      ...item,
      content: patch.content,
      ...(patch.generatedAt ? { generatedAt: patch.generatedAt } : {}),
      ...(patch.updatedAt ? { updatedAt: patch.updatedAt } : {})
    }
  })
}

type SummaryLike = {
  id?: string | number
  type: string
  startDate: string
  endDate: string
  content: string
  generatedAt?: string
  updatedAt?: string
}

export function resolveSummaryForNavigation(
  id: string,
  fallback?: SummaryLike
): CachedSummaryDetail | null {
  const patch = peekSummaryDetailPatch(id)
  if (patch) {
    return {
      id: patch.id ?? (fallback ? Number(fallback.id) : undefined),
      type: patch.type || fallback?.type || '',
      startDate: patch.startDate || fallback?.startDate || '',
      endDate: patch.endDate || fallback?.endDate || '',
      content: patch.content || fallback?.content || '',
      sourceIds: patch.sourceIds,
      generatedAt: patch.generatedAt ?? fallback?.generatedAt,
      updatedAt: patch.updatedAt ?? fallback?.updatedAt
    }
  }
  if (!fallback) return null
  return {
    id: typeof fallback.id === 'number' ? fallback.id : Number(fallback.id),
    type: fallback.type,
    startDate: fallback.startDate,
    endDate: fallback.endDate,
    content: fallback.content,
    generatedAt: fallback.generatedAt,
    updatedAt: fallback.updatedAt
  }
}
