import { describe, expect, it } from 'vitest'
import {
  collectVisionExtractHints,
  describeVisionExtractHint,
  pickVisionExtractHintReason
} from '../extract-engine-hint.util'

describe('extract-engine-hint.util', () => {
  it('keeps only files that should prompt for vision', () => {
    const rows = collectVisionExtractHints([
      {
        recommendVision: false,
        reason: null,
        sampledPages: 3,
        usableTextPages: 3,
        garbledPages: 0,
        emptyPages: 0,
        fileName: '讲义.pdf',
        visionConfigured: true
      },
      {
        recommendVision: true,
        reason: 'garbled-text-layer',
        sampledPages: 3,
        usableTextPages: 0,
        garbledPages: 3,
        emptyPages: 0,
        fileName: '教材.pdf',
        visionConfigured: true
      }
    ])
    expect(rows.map((row) => row.fileName)).toEqual(['教材.pdf'])
    expect(pickVisionExtractHintReason(rows)).toBe('garbled-text-layer')
    expect(describeVisionExtractHint('garbled-text-layer')).toContain('损坏')
    expect(describeVisionExtractHint('empty-text-layer')).toContain('扫描件')
  })
})
