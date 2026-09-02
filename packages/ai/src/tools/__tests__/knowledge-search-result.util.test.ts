import { describe, expect, it } from 'vitest'
import {
  citationsFromKnowledgeHits,
  formatKnowledgeSearchHits
} from '../knowledge-search-result.util'

describe('knowledge-search-result.util', () => {
  it('drops garbled excerpts and numbers the usable ones', () => {
    const formatted = formatKnowledgeSearchHits('蒙太奇', [
      {
        chunkId: 'c-bad',
        sourceId: 'src1',
        notebookId: 'nb1',
        chunkIndex: 0,
        chunkText:
          '和 1 AR 1 次 兴 SN=A I E 4 人 人 0 0 加 Ar 区，和 0 人 0 人 N S ee 1 1 由 0 | 人 0 0 人 RE',
        score: 0.9,
        title: '坏页'
      },
      {
        chunkId: 'c-ok',
        sourceId: 'src1',
        notebookId: 'nb1',
        chunkIndex: 1,
        chunkText: '视听语言是电影艺术的基础，蒙太奇通过镜头组接创造新的意义。',
        score: 0.8,
        title: '视听语言'
      }
    ])
    expect(formatted).toContain('[1] nb1 · 视听语言')
    expect(formatted).not.toContain('SN=A')
    expect(citationsFromKnowledgeHits([
      {
        chunkId: 'c-ok',
        sourceId: 'src1',
        notebookId: 'nb1',
        notebookName: '手册',
        chunkIndex: 1,
        chunkText: '视听语言是电影艺术的基础，蒙太奇通过镜头组接创造新的意义。',
        score: 0.8,
        title: '视听语言'
      }
    ])[0]).toMatchObject({ title: '视听语言', notebookName: '手册', notebookId: 'nb1' })
  })

  it('groups by notebook and respects per-notebook / total quotas', () => {
    const hits = Array.from({ length: 8 }, (_, index) => ({
      chunkId: `a-${index}`,
      sourceId: 's1',
      notebookId: 'nb-a',
      notebookName: '制度',
      chunkIndex: index,
      chunkText: `制度片段 ${index} 足够长的正文。`,
      score: 1,
      title: '制度.pdf'
    })).concat(
      Array.from({ length: 8 }, (_, index) => ({
        chunkId: `b-${index}`,
        sourceId: 's2',
        notebookId: 'nb-b',
        notebookName: '手册',
        chunkIndex: index,
        chunkText: `手册片段 ${index} 足够长的正文。`,
        score: 1,
        title: '手册.pdf'
      }))
    )
    const formatted = formatKnowledgeSearchHits('试用期', hits)
    expect(formatted).toContain('### 制度')
    expect(formatted).toContain('### 手册')
    expect(formatted.match(/\[(\d+)\]/g)?.length).toBe(12)
    const citations = citationsFromKnowledgeHits(hits)
    expect(citations.filter((row) => row.notebookId === 'nb-a')).toHaveLength(6)
    expect(citations.filter((row) => row.notebookId === 'nb-b')).toHaveLength(6)
  })
})
