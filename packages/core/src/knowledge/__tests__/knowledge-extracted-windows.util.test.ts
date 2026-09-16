import { describe, expect, it, vi } from 'vitest'
import { joinPageTexts } from '../knowledge-extract'
import {
  loadExtractedKnowledgeWindows,
  MAX_EXTRACTED_WINDOW_QUERIES,
  normalizeExtractedWindowQueries
} from '../knowledge-extracted-windows.util'

describe('normalizeExtractedWindowQueries', () => {
  it('should drop invalid ids and keep first-seen windows up to the cap', () => {
    const extra = Array.from({ length: MAX_EXTRACTED_WINDOW_QUERIES + 2 }, (_, i) => ({
      sourceId: 'src1',
      windowIndex: i
    }))
    const queries = normalizeExtractedWindowQueries([
      { sourceId: '../hack', windowIndex: 0 },
      { sourceId: 'src1', windowIndex: 0 },
      { sourceId: 'src1', windowIndex: 0 },
      { sourceId: 'src1', windowIndex: -1 },
      ...extra.slice(1)
    ])
    expect(queries[0]).toEqual({ sourceId: 'src1', windowIndex: 0 })
    expect(queries).toHaveLength(MAX_EXTRACTED_WINDOW_QUERIES)
    expect(queries.at(-1)?.windowIndex).toBe(MAX_EXTRACTED_WINDOW_QUERIES - 1)
  })
})

describe('loadExtractedKnowledgeWindows', () => {
  it('should return the resolved window text for sources in the notebook', async () => {
    const text = 'abcdefghij'.repeat(20)
    const pages = Array.from({ length: 25 }, (_, i) => ({
      page: i + 1,
      start: i * 8,
      end: (i + 1) * 8
    }))
    const readExtractedText = vi.fn().mockResolvedValue(text)
    const readPagesJson = vi.fn().mockResolvedValue({ pages })
    const getSource = vi.fn().mockResolvedValue({ notebookId: 'nb1', title: '一本书' })

    const items = await loadExtractedKnowledgeWindows({
      notebookId: 'nb1',
      windows: [
        { sourceId: 'src1', windowIndex: 0 },
        { sourceId: 'src1', windowIndex: 0 }
      ],
      readExtractedText,
      readPagesJson,
      getSource
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.sourceTitle).toBe('一本书')
    expect(items[0]?.sourceRef).toBe('src1#0')
    expect(items[0]?.text?.length).toBeGreaterThan(0)
    expect(readExtractedText).toHaveBeenCalledTimes(1)
  })

  it('should return null text when source is missing or belongs to another notebook', async () => {
    const items = await loadExtractedKnowledgeWindows({
      notebookId: 'nb1',
      windows: [{ sourceId: 'src9', windowIndex: 0 }],
      readExtractedText: vi.fn(),
      readPagesJson: vi.fn(),
      getSource: vi.fn().mockResolvedValue({ notebookId: 'other', title: '别的本' })
    })
    expect(items).toEqual([
      {
        sourceId: 'src9',
        sourceTitle: 'src9',
        windowIndex: 0,
        sourceRef: 'src9#0',
        text: null
      }
    ])
  })

  it('should return null text when extracted body is missing', async () => {
    const items = await loadExtractedKnowledgeWindows({
      notebookId: 'nb1',
      windows: [{ sourceId: 'src1', windowIndex: 0 }],
      readExtractedText: vi.fn().mockResolvedValue('   '),
      readPagesJson: vi.fn().mockResolvedValue(null),
      getSource: vi.fn().mockResolvedValue({ notebookId: 'nb1', title: '空书' })
    })
    expect(items[0]?.text).toBeNull()
    expect(items[0]?.sourceTitle).toBe('空书')
  })

  it('should slice a page-backed window from joined extracted text', async () => {
    const { text, pages } = joinPageTexts(['第一窗内容足够长'.repeat(800), '第二窗'])
    const items = await loadExtractedKnowledgeWindows({
      notebookId: 'nb1',
      windows: [{ sourceId: 'src1', windowIndex: 1 }],
      readExtractedText: vi.fn().mockResolvedValue(text),
      readPagesJson: vi.fn().mockResolvedValue(pages),
      getSource: vi.fn().mockResolvedValue({ notebookId: 'nb1', title: '分页书' })
    })
    expect(items[0]?.text).toContain('第二窗')
    expect(items[0]?.text).not.toContain('第一窗')
  })
})
