import { describe, expect, it } from 'vitest'
import {
  buildGraphFragmentItems,
  buildVectorFragmentItem
} from '../knowledge-source-fragment.util'

describe('buildGraphFragmentItems', () => {
  it('should attach loaded window text and keep excerpts', () => {
    const items = buildGraphFragmentItems(
      [{ sourceId: 'src1', windowIndex: 2, excerpts: ['甲认识乙'] }],
      [{ sourceId: 'src1', windowIndex: 2, sourceTitle: '一本书', text: '窗口正文' }]
    )
    expect(items).toEqual([
      {
        id: 'src1#2',
        sourceTitle: '一本书',
        kind: 'graph-window',
        index: 2,
        excerpts: ['甲认识乙'],
        text: '窗口正文'
      }
    ])
  })

  it('should fall back to source id when loaded title is missing', () => {
    const items = buildGraphFragmentItems(
      [{ sourceId: 'src9', windowIndex: 0, excerpts: [] }],
      []
    )
    expect(items[0]?.sourceTitle).toBe('src9')
    expect(items[0]?.text).toBeNull()
  })
})

describe('buildVectorFragmentItem', () => {
  it('should wrap a chunk as a vector fragment', () => {
    expect(
      buildVectorFragmentItem({
        chunkId: 'src1_3',
        sourceTitle: '笔记',
        chunkIndex: 3,
        chunkText: '  嵌入正文  '
      })
    ).toEqual({
      id: 'src1_3',
      sourceTitle: '笔记',
      kind: 'vector-chunk',
      index: 3,
      excerpts: [],
      text: '嵌入正文'
    })
  })
})
