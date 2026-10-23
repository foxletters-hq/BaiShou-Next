import { describe, expect, it } from 'vitest'
import {
  applyAlphaToColor,
  completeStreamingMarkdownSlice,
  computeStreamingRevealStep,
  computeStreamingTailAlpha,
  snapStreamingRevealIndex
} from '../agent-markdown-stream.util'
import { getStableAstNodeKey } from '../../MarkdownRenderer/legacy-markdown-streaming-tail'

describe('agent-markdown-stream.util', () => {
  it('computes adaptive reveal step size based on backlog and streaming state', () => {
    expect(computeStreamingRevealStep(0, true)).toBe(0)
    expect(computeStreamingRevealStep(6, true)).toBe(5)
    expect(computeStreamingRevealStep(20, true)).toBe(7)
    expect(computeStreamingRevealStep(48, true)).toBe(10)
    expect(computeStreamingRevealStep(120, true)).toBe(14)
    expect(computeStreamingRevealStep(400, true)).toBe(28)
    expect(computeStreamingRevealStep(20, false)).toBe(6)
    expect(computeStreamingRevealStep(160, false)).toBe(16)
  })

  it('snaps reveal cursor past surrogate pairs, markdown markers, and link URLs', () => {
    const emojiText = '你好😀世界'
    // '你好' length 2, '😀' is index 2..4 (surrogate pair)
    expect(snapStreamingRevealIndex(emojiText, 3)).toBe(4)

    const boldText = '这是 **重点** 内容'
    // index 4 lands inside '**'
    expect(snapStreamingRevealIndex(boldText, 4)).toBe(5)

    const linkText = '查看 [引用](baishou-cite://turn/1) 详情'
    // index 8 lands inside '(baishou-cite://turn/1)'
    const snappedLink = snapStreamingRevealIndex(linkText, 12)
    expect(linkText.slice(0, snappedLink)).toBe('查看 [引用](baishou-cite://turn/1)')
  })

  it('auto-closes unclosed code fences and inline emphasis during partial streaming', () => {
    expect(completeStreamingMarkdownSlice('```ts\nconst x = 1', true)).toBe(
      '```ts\nconst x = 1\n```'
    )
    expect(completeStreamingMarkdownSlice('这是 **加粗中', true)).toBe('这是 **加粗中**')
    expect(completeStreamingMarkdownSlice('调用 `foo.bar', true)).toBe('调用 `foo.bar`')
    expect(completeStreamingMarkdownSlice('已完成 **加粗** 文本', false)).toBe(
      '已完成 **加粗** 文本'
    )
  })

  it('computes monotonically decreasing tail alpha from solid boundary to tip and applies color alpha', () => {
    const nearSolid = computeStreamingTailAlpha(0, 28)
    const middle = computeStreamingTailAlpha(13, 28)
    const atTip = computeStreamingTailAlpha(27, 28)

    expect(nearSolid).toBeGreaterThan(middle)
    expect(middle).toBeGreaterThan(atTip)
    expect(atTip).toBeGreaterThanOrEqual(0.08)
    expect(nearSolid).toBeLessThanOrEqual(1)

    expect(applyAlphaToColor('#1F2937', 0.5)).toBe('rgba(31, 41, 55, 0.500)')
    expect(applyAlphaToColor('rgb(255, 255, 255)', 0.25)).toBe('rgba(255, 255, 255, 0.250)')
    expect(applyAlphaToColor('#1F2937', 1)).toBe('#1F2937')
  })

  it('produces stable positional keys for markdown AST nodes', () => {
    const root = { type: 'body', index: 0 }
    const para = { type: 'paragraph', index: 2 }
    const textGroup = { type: 'textgroup', index: 0 }
    const leaf = { type: 'text', index: 1 }

    expect(getStableAstNodeKey(leaf, [textGroup, para, root])).toBe('md_2_0_1_text')
    expect(getStableAstNodeKey(para, [root])).toBe('md_2_paragraph')
  })
})
