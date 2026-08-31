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
    expect(formatted).toContain('[1] 视听语言')
    expect(formatted).not.toContain('SN=A')
    expect(citationsFromKnowledgeHits([
      {
        chunkId: 'c-ok',
        sourceId: 'src1',
        notebookId: 'nb1',
        chunkIndex: 1,
        chunkText: '视听语言是电影艺术的基础，蒙太奇通过镜头组接创造新的意义。',
        score: 0.8,
        title: '视听语言'
      }
    ])[0]?.title).toBe('视听语言')
  })
})
