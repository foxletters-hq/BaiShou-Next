import { describe, expect, it } from 'vitest'
import { resolveSummaryTimeDisplay } from '../summary-timestamp.util'

describe('resolveSummaryTimeDisplay', () => {
  it('shows generated when never manually saved', () => {
    expect(
      resolveSummaryTimeDisplay({
        generatedAt: '2026-01-01T10:00:00.000Z',
        updatedAt: null
      })
    ).toEqual({
      kind: 'generated',
      labelKey: 'summary.generated_at',
      at: '2026-01-01T10:00:00.000Z'
    })
  })

  it('shows saved when updatedAt is later than generatedAt', () => {
    expect(
      resolveSummaryTimeDisplay({
        generatedAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-02T12:00:00.000Z'
      })
    ).toEqual({
      kind: 'saved',
      labelKey: 'summary.saved_at',
      at: '2026-01-02T12:00:00.000Z'
    })
  })

  it('keeps generated when updatedAt is not meaningfully later', () => {
    expect(
      resolveSummaryTimeDisplay({
        generatedAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.500Z'
      })?.kind
    ).toBe('generated')
  })
})
