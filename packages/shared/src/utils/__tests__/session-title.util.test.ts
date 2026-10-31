import { describe, expect, it } from 'vitest'
import {
  buildBranchSessionTitle,
  deriveSessionTitleFromUserText,
  extractMessagePlainTextSnippet
} from '../session-title.util'

describe('deriveSessionTitleFromUserText', () => {
  it('returns empty string for blank input', () => {
    expect(deriveSessionTitleFromUserText('   ')).toBe('')
  })

  it('truncates to 10 characters by default', () => {
    expect(deriveSessionTitleFromUserText('这是一段比较长的用户首句内容')).toBe(
      '这是一段比较长的用户'
    )
    expect(deriveSessionTitleFromUserText('Hello world from user')).toBe('Hello worl')
  })

  it('supports custom max length', () => {
    expect(deriveSessionTitleFromUserText('abcdefgh', 5)).toBe('abcde')
  })
})

describe('extractMessagePlainTextSnippet', () => {
  it('should extract non-reasoning text from message parts and collapse whitespace', () => {
    const msg = {
      parts: [
        { type: 'text', data: { text: '思考过程', isReasoning: true } },
        { type: 'text', data: { text: '  第一行\n\n第二行内容超长测试文本  ' } }
      ]
    }
    expect(extractMessagePlainTextSnippet(msg, 8)).toBe('第一行 第二行内…')
  })

  it('should return empty string when message has no text parts', () => {
    expect(extractMessagePlainTextSnippet({ parts: [{ type: 'tool', data: {} }] })).toBe('')
  })
})

describe('buildBranchSessionTitle', () => {
  it('should prioritize originalTitle over assistantName and include branch point snippet', () => {
    const title = buildBranchSessionTitle({
      originalTitle: '周末旅行计划',
      assistantName: '小守',
      branchPointText: '那我们改去北海道看雪吧，机票怎么买？',
      branchLabel: '分支'
    })
    expect(title).toBe('周末旅行计划 (分支·那我们改去北海道看雪…)')
  })

  it('should strip existing branch suffix before appending new branch suffix', () => {
    const title = buildBranchSessionTitle({
      originalTitle: '周末旅行计划 (从此处创建分支)',
      assistantName: '小守',
      branchPointText: '住温泉酒店',
      branchLabel: '分支'
    })
    expect(title).toBe('周末旅行计划 (分支·住温泉酒店)')
  })

  it('should fallback to assistantName or defaultTitle when originalTitle is empty', () => {
    expect(
      buildBranchSessionTitle({
        originalTitle: '   ',
        assistantName: '小守',
        branchLabel: '分支'
      })
    ).toBe('小守 (分支)')
  })
})
