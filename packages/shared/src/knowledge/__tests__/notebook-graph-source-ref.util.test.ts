import { describe, expect, it } from 'vitest'
import {
  collectNotebookGraphSourceWindows,
  parseNotebookGraphSourceWindowRef
} from '../notebook-graph-source-ref.util'

describe('parseNotebookGraphSourceWindowRef', () => {
  it('should parse source id and window index when ref uses hash form', () => {
    expect(parseNotebookGraphSourceWindowRef('src_ab12#0')).toEqual({
      sourceId: 'src_ab12',
      windowIndex: 0
    })
  })

  it('should return null when window index is missing or not a number', () => {
    expect(parseNotebookGraphSourceWindowRef('src_ab12')).toBeNull()
    expect(parseNotebookGraphSourceWindowRef('src_ab12#')).toBeNull()
    expect(parseNotebookGraphSourceWindowRef('src_ab12#x')).toBeNull()
    expect(parseNotebookGraphSourceWindowRef('')).toBeNull()
    expect(parseNotebookGraphSourceWindowRef(null)).toBeNull()
  })
})

describe('collectNotebookGraphSourceWindows', () => {
  it('should keep first-seen windows and merge unique excerpts', () => {
    const windows = collectNotebookGraphSourceWindows([
      { sourceRef: 'src1#0', sourceExcerpt: '甲认识乙' },
      { sourceRef: 'src1#2', sourceExcerpt: '后来分开' },
      { sourceRef: 'src1#0', sourceExcerpt: '甲认识乙' },
      { sourceRef: 'src1#0', sourceExcerpt: '同一窗另一句' },
      { sourceRef: 'bad', sourceExcerpt: '丢弃' }
    ])
    expect(windows).toEqual([
      { sourceId: 'src1', windowIndex: 0, excerpts: ['甲认识乙', '同一窗另一句'] },
      { sourceId: 'src1', windowIndex: 2, excerpts: ['后来分开'] }
    ])
  })

  it('should return empty when no edge has a window ref', () => {
    expect(
      collectNotebookGraphSourceWindows([{ sourceRef: 'src1', sourceExcerpt: '只有摘录' }])
    ).toEqual([])
  })
})
