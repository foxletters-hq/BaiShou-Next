import { describe, expect, it } from 'vitest'
import { formatVectorPendingValue } from '../memory-readiness-chip.util'

function translate(_key: string, fallback: string, options?: Record<string, unknown>): string {
  if (!options) return fallback
  return Object.entries(options).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
    fallback
  )
}

describe('formatVectorPendingValue', () => {
  it('shows the graph backlog instead of 0 entries when only graph work remains', () => {
    expect(formatVectorPendingValue({ embedPending: 0, pendingGraphCount: 2 }, translate)).toBe(
      '待整理 2 篇'
    )
  })

  it('shows both counts when embedding and graph work remain', () => {
    expect(formatVectorPendingValue({ embedPending: 3, pendingGraphCount: 2 }, translate)).toBe(
      '未整理 3 篇 · 图谱 2 篇'
    )
  })

  it('keeps the embedding count when the graph is up to date', () => {
    expect(formatVectorPendingValue({ embedPending: 3, pendingGraphCount: 0 }, translate)).toBe(
      '未整理 3 篇'
    )
  })
})
