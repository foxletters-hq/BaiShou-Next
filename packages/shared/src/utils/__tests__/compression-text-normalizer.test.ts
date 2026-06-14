import { describe, it, expect } from 'vitest'
import { normalizeCompressionOutput } from '../compression-text-normalizer'

describe('normalizeCompressionOutput', () => {
  it('extracts think block and summary body from mixed text stream', () => {
    const raw =
      '<' +
      'think>The user is satisfied with the search.</' +
      'think><' +
      'summary>## 对话概览\n用户查询了天气。</' +
      'summary>'

    const { summaryText, reasoningText } = normalizeCompressionOutput(raw, '')

    expect(reasoningText).toContain('user is satisfied')
    expect(summaryText).toContain('对话概览')
    expect(summaryText).not.toContain('think>')
    expect(summaryText).not.toContain('summary>')
  })

  it('preserves native reasoning and cleans summary only', () => {
    const { summaryText, reasoningText } = normalizeCompressionOutput('纯摘要正文', '已有思考')
    expect(summaryText).toBe('纯摘要正文')
    expect(reasoningText).toBe('已有思考')
  })

  it('strips assistant reply before rolling summary header', () => {
    const raw =
      '确实会慢喵，但这正是 Legacy Mode 的魅力。\n\n' +
      '更新后的滚动摘要（基于2026-06-14对话 + 新讨论）\n' +
      '用户反馈 Legacy Mode 感觉慢，推荐混合策略。'

    const { summaryText } = normalizeCompressionOutput(raw, '')
    expect(summaryText).toContain('用户反馈 Legacy Mode')
    expect(summaryText).not.toContain('确实会慢喵')
    expect(summaryText).not.toContain('更新后的滚动摘要')
  })
})
