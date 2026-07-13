import { describe, it, expect } from 'vitest'
import {
  deleteMarkdownRange,
  isLikelyEditorBundleLeak,
  isStaleControlledContentEcho,
  looksLikeExternalContentReplace,
  commonPrefixLength
} from '../diary-cm-content.util'

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

describe('looksLikeExternalContentReplace', () => {
  it('treats incremental edits as in-session typing', () => {
    expect(looksLikeExternalContentReplace('hello world', 'hello worl')).toBe(false)
    expect(looksLikeExternalContentReplace('hello world', 'hello world!')).toBe(false)
  })

  it('treats wholly different bodies as external replace', () => {
    expect(looksLikeExternalContentReplace('hello world', '完全不同的日记正文')).toBe(true)
  })

  it('counts shared prefix length', () => {
    expect(commonPrefixLength('abcdef', 'abcxyz')).toBe(3)
  })
})

describe('isStaleControlledContentEcho', () => {
  it('detects RN lagging behind rapid delete', () => {
    expect(isStaleControlledContentEcho('hello worl', 'hello world')).toBe(true)
    expect(isStaleControlledContentEcho('', 'hello')).toBe(true)
  })

  it('detects RN lagging behind typing', () => {
    expect(isStaleControlledContentEcho('hello!', 'hello')).toBe(true)
  })

  it('allows unrelated document swaps', () => {
    expect(isStaleControlledContentEcho('hello world', '完全不同的日记正文')).toBe(false)
  })
})
