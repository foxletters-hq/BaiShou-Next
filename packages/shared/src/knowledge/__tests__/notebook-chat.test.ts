import { describe, expect, it } from 'vitest'
import {
  notebookChatTitleFromQuestion,
  parseNotebookChatCitations,
  parseNotebookChatReasoning
} from '../notebook-chat'

describe('notebook-chat', () => {
  it('shortens the first question into a session title', () => {
    expect(notebookChatTitleFromQuestion('  这几篇里对齐的主要分歧是什么？  ')).toBe(
      '这几篇里对齐的主要分歧是什么？'
    )
    expect(
      notebookChatTitleFromQuestion('一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十')
    ).toContain('…')
    expect(notebookChatTitleFromQuestion('   ')).toBe('')
  })

  it('keeps citation rows that have a title', () => {
    expect(
      parseNotebookChatCitations([
        { title: '报告', excerpt: '摘要', page: 2, sourceId: 's1' },
        { excerpt: '没标题' },
        null
      ])
    ).toEqual([{ sourceId: 's1', title: '报告', excerpt: '摘要', page: 2 }])
  })

  it('keeps non-empty reasoning text', () => {
    expect(parseNotebookChatReasoning('  先对照来源再下结论  ')).toBe('先对照来源再下结论')
    expect(parseNotebookChatReasoning('   ')).toBeUndefined()
    expect(parseNotebookChatReasoning(null)).toBeUndefined()
  })
})
