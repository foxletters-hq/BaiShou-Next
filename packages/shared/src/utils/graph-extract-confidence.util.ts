/** 抽取结果里的把握：模型可能给 0–100，也可能给 0–1。 */

export const GRAPH_EXTRACT_LOW_CONFIDENCE = 70

export function normalizeGraphExtractConfidence(raw: unknown, fallback: number): number {
  const parsed =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim()
        ? Number(raw)
        : Number.NaN
  const base = Number.isFinite(parsed) ? parsed : fallback
  const scaled = base > 0 && base <= 1 ? base * 100 : base
  return Math.max(0, Math.min(100, Math.round(scaled)))
}

export function looksLikeUnitIntervalConfidence(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value <= 1
}

export function graphReviewStatusFromConfidence(
  confidence: number
): 'approved' | 'pending' {
  return confidence < GRAPH_EXTRACT_LOW_CONFIDENCE ? 'pending' : 'approved'
}

function asFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** 入库和展示共用：纠正 0–1 误存，并按换算后的把握重算待确认。 */
export function normalizeGraphEdgeReviewFields(input: {
  confidence?: unknown
  reviewStatus?: string | null
  fallbackConfidence?: number
}): { confidence: number; reviewStatus: 'approved' | 'pending' | 'rejected' } {
  const raw = asFiniteNumber(input.confidence)
  const wasUnit = raw != null && looksLikeUnitIntervalConfidence(raw)
  const confidence = normalizeGraphExtractConfidence(
    input.confidence,
    input.fallbackConfidence ?? 100
  )
  const current = (input.reviewStatus || 'approved').trim()
  if (current === 'rejected') return { confidence, reviewStatus: 'rejected' }
  if (wasUnit && current === 'pending') {
    return { confidence, reviewStatus: graphReviewStatusFromConfidence(confidence) }
  }
  if (current === 'pending' || current === 'approved') {
    return { confidence, reviewStatus: current }
  }
  return { confidence, reviewStatus: 'approved' }
}

export function remapGraphViewReviewForDisplay<
  N extends { reviewStatus?: string },
  E extends { reviewStatus?: string; confidence?: number }
>(
  nodes: N[],
  edges: E[]
): { nodes: N[]; edges: E[] } {
  const nextEdges = edges.map((edge) => {
    const next = normalizeGraphEdgeReviewFields({
      confidence: edge.confidence,
      reviewStatus: edge.reviewStatus
    })
    return { ...edge, confidence: next.confidence, reviewStatus: next.reviewStatus }
  })
  const pending = edges.filter((edge) => edge.reviewStatus === 'pending')
  const misScaled =
    pending.length > 0 &&
    pending.every((edge) => looksLikeUnitIntervalConfidence(edge.confidence ?? 0))
  return {
    nodes: nodes.map((node) => ({
      ...node,
      reviewStatus:
        misScaled && node.reviewStatus === 'pending' ? 'approved' : node.reviewStatus
    })),
    edges: nextEdges
  }
}
