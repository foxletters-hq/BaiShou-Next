import { describe, expect, it } from 'vitest'
import { EMPTY_PENDING_EMBED_COUNTS, type PendingEmbedCounts } from '@baishou/shared'
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

  const parts = (patch: Partial<PendingEmbedCounts>): PendingEmbedCounts => ({
    ...EMPTY_PENDING_EMBED_COUNTS,
    ...patch
  })

  it('counts only diaries as articles when parts are provided', () => {
    expect(
      formatVectorPendingValue(
        {
          embedPending: 3,
          pendingGraphCount: 0,
          parts: parts({ diaries: 2, memories: 1, total: 3 })
        },
        translate
      )
    ).toBe('未整理 2 篇')
  })

  it('shows companion memories and graph node vectors in their own units when no diary is pending', () => {
    expect(
      formatVectorPendingValue(
        { embedPending: 1, pendingGraphCount: 0, parts: parts({ memories: 1, total: 1 }) },
        translate
      )
    ).toBe('伙伴记忆 1 条')
    expect(
      formatVectorPendingValue(
        {
          embedPending: 3,
          pendingGraphCount: 0,
          parts: parts({ memories: 1, graphNodes: 2, total: 3 })
        },
        translate
      )
    ).toBe('伙伴记忆 1 条 · 图谱节点向量 2 个')
  })
})
