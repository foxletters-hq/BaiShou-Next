/** RAG 检索召回数量上限（Top-K） */
export const RAG_TOP_K_MIN = 1
export const RAG_TOP_K_MAX = 200
export const RAG_TOP_K_DEFAULT = 20

/**
 * 移动端相似度阈值滑条使用 0–100 整数步进（与 Top-K 等 SettingsSliderRow 一致），
 * 落库时除以该刻度得到 0.00–1.00。
 */
export const RAG_SIMILARITY_SLIDER_SCALE = 100
export const RAG_SIMILARITY_DEFAULT = 0.4

export function clampRagTopK(value: unknown, fallback = RAG_TOP_K_DEFAULT): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(RAG_TOP_K_MAX, Math.max(RAG_TOP_K_MIN, Math.round(parsed)))
}

export function clampRagSimilarityThreshold(
  value: unknown,
  fallback = RAG_SIMILARITY_DEFAULT
): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}
