/** 已导入资料是否适合做按页试抽（仅 PDF）。 */
export function isKnowledgePdfSource(source: {
  sourceKind?: string | null
  relativePath?: string | null
  title?: string | null
}): boolean {
  const kind = String(source.sourceKind || '').trim()
  if (kind && kind !== 'file') return false
  const name = `${source.relativePath || ''}`.trim() || `${source.title || ''}`.trim()
  return /\.pdf$/i.test(name)
}

/**
 * 试抽页码：第 1 页、中间页、最后一页。
 * 不足三页时去重后全抽。
 */
export function pickExtractProbePages(pageCount: number): number[] {
  const n = Math.floor(Number(pageCount))
  if (!Number.isFinite(n) || n <= 0) return []
  if (n === 1) return [1]
  const mid = Math.ceil(n / 2)
  return [...new Set([1, mid, n])].sort((a, b) => a - b)
}
