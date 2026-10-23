import { describe, expect, it } from 'vitest'
import {
  collectVisionExtractHints,
  pickVisionExtractHintReason,
  type KnowledgeExtractHint
} from '../extract-hint'

function hint(
  partial: Partial<KnowledgeExtractHint> & Pick<KnowledgeExtractHint, 'fileName'>
): KnowledgeExtractHint {
  return {
    recommendVision: false,
    reason: null,
    sampledPages: 3,
    usableTextPages: 3,
    garbledPages: 0,
    emptyPages: 0,
    visionConfigured: true,
    ...partial
  }
}

describe('collectVisionExtractHints', () => {
  it('should keep only files that should prompt for vision', () => {
    const rows = collectVisionExtractHints([
      hint({ fileName: '讲义.pdf' }),
      hint({
        fileName: '教材.pdf',
        recommendVision: true,
        reason: 'garbled-text-layer',
        usableTextPages: 0,
        garbledPages: 3
      })
    ])
    expect(rows.map((row) => row.fileName)).toEqual(['教材.pdf'])
    expect(pickVisionExtractHintReason(rows)).toBe('garbled-text-layer')
  })

  it('should prefer garbled over empty when both exist', () => {
    expect(
      pickVisionExtractHintReason([
        hint({
          fileName: 'a.pdf',
          recommendVision: true,
          reason: 'empty-text-layer'
        }),
        hint({
          fileName: 'b.pdf',
          recommendVision: true,
          reason: 'garbled-text-layer'
        })
      ])
    ).toBe('garbled-text-layer')
  })
})
