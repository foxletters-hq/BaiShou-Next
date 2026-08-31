import { describe, expect, it } from 'vitest'
import {
  isGarbledExtractText,
  pickNotebookChatCitations,
  selectCitedReferences,
  shouldRetrieveNotebookSources
} from '../notebook-ask.util'

describe('notebook-ask.util', () => {
  it('does not retrieve for greetings and does retrieve for source questions', () => {
    expect(shouldRetrieveNotebookSources('hi')).toBe(false)
    expect(shouldRetrieveNotebookSources('你好')).toBe(false)
    expect(shouldRetrieveNotebookSources('这篇的结论是什么？')).toBe(true)
    expect(shouldRetrieveNotebookSources('hi，这本书讲了什么')).toBe(true)
  })

  it('keeps only citation numbers that appear in the answer', () => {
    const citations = [{ title: '一' }, { title: '二' }, { title: '三' }]
    expect(selectCitedReferences('先看[2]，再对照[2]。', citations)).toEqual([{ title: '二' }])
    expect(selectCitedReferences('哟，来了啊。', citations)).toEqual([])
  })

  it('hides garbled excerpts even when the answer cites them', () => {
    expect(
      pickNotebookChatCitations('见[1]和[2]', [
        {
          title: '坏页',
          excerpt:
            '和 1 AR 1 次 兴 SN=A I E 4 人 人 0 0 加 Ar 区，和 0 人 0 人 N S ee 1 1 由 0 | 人 0 0 人 RE'
        },
        { title: '好页', excerpt: '视听语言是电影艺术的基础，蒙太奇通过镜头组接创造新的意义。' }
      ])
    ).toEqual([
      {
        title: '好页',
        excerpt: '视听语言是电影艺术的基础，蒙太奇通过镜头组接创造新的意义。',
        displayIndex: 2
      }
    ])
  })

  it('treats replacement-character soup as garbled', () => {
    expect(isGarbledExtractText('结论是对齐仍有分歧。')).toBe(false)
    expect(isGarbledExtractText(`\uFFFD\uFFFD 视听语言是电影艺术的基础。`)).toBe(true)
  })
})
