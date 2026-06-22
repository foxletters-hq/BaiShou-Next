import { describe, it, expect } from 'vitest'
import { deleteMarkdownRange, isLikelyEditorBundleLeak } from '../diary-cm-content.util'

describe('deleteMarkdownRange', () => {
  it('removes image markdown range', () => {
    const content = 'before\n![a](attachment/x.png)\nafter'
    const from = content.indexOf('![')
    const to = from + '![a](attachment/x.png)'.length
    expect(deleteMarkdownRange(content, from, to)).toBe('before\n\nafter')
  })

  it('clamps out-of-range offsets', () => {
    expect(deleteMarkdownRange('abc', -5, 100)).toBe('')
  })
})

describe('isLikelyEditorBundleLeak', () => {
  it('detects minified bundle fragments', () => {
    const leaked =
      'function xm(n){let e=Object.create(null); matchBefore; Object.defineProperty; createDiaryCodeMirror; ReactNativeWebView; ' +
      'x'.repeat(200)
    expect(isLikelyEditorBundleLeak(leaked)).toBe(true)
  })

  it('ignores normal diary markdown', () => {
    expect(isLikelyEditorBundleLeak('# 标题\n\n今天天气不错 ![img](attachment/a.png)')).toBe(false)
  })
})
