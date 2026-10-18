import { describe, expect, it } from 'vitest'
import { isTextLayerHint, splitKnowledgeSourceErrorMessage } from '../source-text-layer-hint.util'

describe('isTextLayerHint', () => {
  it('should treat backend extract notes as a text-layer hint', () => {
    expect(isTextLayerHint('1033 页中有 1 页没有文本层')).toBe(true)
    expect(isTextLayerHint('112 页几乎无文本层')).toBe(true)
    expect(isTextLayerHint('3 pages lack a text layer')).toBe(true)
    expect(isTextLayerHint('扫描件 2 / 10 页缺文字层')).toBe(true)
    expect(isTextLayerHint('页数未知，禁止标 ready')).toBe(false)
  })
})

describe('splitKnowledgeSourceErrorMessage', () => {
  it('should keep a text-layer note as a hint instead of an error', () => {
    expect(splitKnowledgeSourceErrorMessage('1033 页中有 1 页没有文本层')).toEqual({
      error: null,
      hint: '1033 页中有 1 页没有文本层'
    })
  })

  it('should split a real failure from a joined text-layer hint', () => {
    expect(
      splitKnowledgeSourceErrorMessage('embedding-not-configured；1033 页中有 1 页没有文本层')
    ).toEqual({
      error: 'embedding-not-configured',
      hint: '1033 页中有 1 页没有文本层'
    })
  })

  it('should keep a real failure intact when there is no hint', () => {
    expect(splitKnowledgeSourceErrorMessage('embedding-not-configured')).toEqual({
      error: 'embedding-not-configured',
      hint: null
    })
  })
})
