export interface KnowledgePageBoundary {
  page: number
  start: number
  end: number
}

/**
 * 从页边界表反查偏移所在页码（L2）。
 * 区间为 [start, end)；落在末页 end 上时仍归入该页。
 */
export function resolvePageForOffset(
  pages: KnowledgePageBoundary[] | null | undefined,
  offset: number | undefined
): number | undefined {
  if (offset == null || !pages?.length) return undefined
  for (const p of pages) {
    if (offset >= p.start && offset < p.end) return p.page
  }
  const last = pages[pages.length - 1]
  if (last && offset === last.end) return last.page
  return undefined
}
