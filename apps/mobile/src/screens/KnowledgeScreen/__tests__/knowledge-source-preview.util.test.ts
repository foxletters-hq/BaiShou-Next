import { describe, expect, it } from 'vitest'
import {
  buildGraphFragmentItems,
  pickSourceCardEvidence,
  sourceMissingPageCount
} from '../knowledge-source-preview.util'

describe('sourceMissingPageCount', () => {
  it('should count missing text-layer pages', () => {
    expect(sourceMissingPageCount({ pageCount: 10, textPageCount: 3 })).toBe(7)
    expect(sourceMissingPageCount({ pageCount: 3, textPageCount: 3 })).toBeNull()
    expect(sourceMissingPageCount({ pageCount: null, textPageCount: 1 })).toBeNull()
  })
})

describe('pickSourceCardEvidence', () => {
  it('should hide scan evidence while OCR is running', () => {
    expect(pickSourceCardEvidence({ pageCount: 12, missingPages: 8, hideHints: true })).toBeNull()
    expect(pickSourceCardEvidence({ pageCount: 12, missingPages: 8 })).toEqual({
      type: 'scan',
      pageCount: 12,
      missingPages: 8
    })
  })
})

describe('buildGraphFragmentItems', () => {
  it('should keep window order and fill loaded text', () => {
    const items = buildGraphFragmentItems(
      [
        { sourceId: 's1', windowIndex: 0, excerpts: ['甲'] },
        { sourceId: 's1', windowIndex: 1, excerpts: [] }
      ],
      [
        { sourceId: 's1', windowIndex: 1, sourceTitle: '讲义', text: '第二节' },
        { sourceId: 's1', windowIndex: 0, sourceTitle: '讲义', text: '第一节' }
      ]
    )
    expect(items[0]).toMatchObject({
      id: 's1#0',
      sourceTitle: '讲义',
      index: 0,
      excerpts: ['甲'],
      text: '第一节'
    })
    expect(items[1]?.text).toBe('第二节')
  })
})
