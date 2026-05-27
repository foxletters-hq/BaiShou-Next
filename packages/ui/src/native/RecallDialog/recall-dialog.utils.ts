import type { SimilarityColorSet } from './recall-dialog.types'

export const SIMILARITY_COLORS = {
  high: {
    bg: 'rgba(34, 197, 94, 0.1)',
    border: 'rgba(34, 197, 94, 0.3)',
    fg: 'rgb(34, 197, 94)'
  },
  mid: {
    bg: 'rgba(59, 130, 246, 0.1)',
    border: 'rgba(59, 130, 246, 0.3)',
    fg: 'rgb(59, 130, 246)'
  },
  low: {
    bg: 'rgba(100, 116, 139, 0.1)',
    border: 'rgba(100, 116, 139, 0.3)',
    fg: 'rgb(100, 116, 139)'
  }
} satisfies Record<'high' | 'mid' | 'low', SimilarityColorSet>

export function getSimilarityColors(score: number | undefined): SimilarityColorSet | null {
  if (score === undefined) return null
  if (score >= 0.85) return SIMILARITY_COLORS.high
  if (score >= 0.7) return SIMILARITY_COLORS.mid
  return SIMILARITY_COLORS.low
}
