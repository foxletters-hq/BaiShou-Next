import { describe, it, expect } from 'vitest'
import { buildCompressionPreviousSummaryBlock } from '../compression-previous-summary'

describe('buildCompressionPreviousSummaryBlock', () => {
  it('returns null when no previous summary', () => {
    expect(buildCompressionPreviousSummaryBlock()).toBeNull()
    expect(buildCompressionPreviousSummaryBlock('  ')).toBeNull()
  })

  it('wraps previous summary as data-only block', () => {
    const block = buildCompressionPreviousSummaryBlock('旧摘要内容')
    expect(block).toContain('<previous-summary>')
    expect(block).toContain('旧摘要内容')
    expect(block).not.toContain('Goal')
  })
})
