import { describe, it, expect } from 'vitest'
import { findWordRangeAtPosition, snapTouchSelectPos } from '../extensions/wordBoundaryAtPos'

describe('findWordRangeAtPosition', () => {
  const sample = '下午去水果店买了个大西瓜，老板帮忙挑的，说保甜。'

  it('selects Chinese word at 西瓜', () => {
    const index = sample.indexOf('西瓜')
    expect(index).toBeGreaterThanOrEqual(0)
    const mid = index + 1
    const range = findWordRangeAtPosition(sample, mid)
    expect(sample.slice(range.from, range.to)).toBe('西瓜')
  })

  it('selects 西瓜 inside a long document via local window', () => {
    const prefix = '\n\n今天天气挺热的，夏天正式发力了。\n\n'
    const full = prefix + sample
    const pos = prefix.length + sample.indexOf('西')
    const range = findWordRangeAtPosition(full, pos)
    expect(full.slice(range.from, range.to)).toBe('西瓜')
  })

  it('merges single-char han segments when segmenter splits 西瓜', () => {
    const doc = '买了个大西瓜，'
    const pos = doc.indexOf('西')
    const range = findWordRangeAtPosition(doc, pos)
    expect(doc.slice(range.from, range.to)).toBe('西瓜')
  })

  it('selects Chinese word at 水果', () => {
    const index = sample.indexOf('水果')
    expect(index).toBeGreaterThanOrEqual(0)
    const range = findWordRangeAtPosition(sample, index + 1)
    const word = sample.slice(range.from, range.to)
    expect(['水果', '水果店']).toContain(word)
  })

  it('selects bold content without markdown markers', () => {
    const doc = '明天**继续**前进'
    const pos = doc.indexOf('继')
    const range = findWordRangeAtPosition(doc, pos)
    expect(doc.slice(range.from, range.to)).toBe('继续')
  })

  it('snaps from asterisk to word inside bold', () => {
    const doc = '明天**继续**'
    const star = doc.indexOf('*')
    expect(snapTouchSelectPos(doc, star)).toBe(doc.indexOf('继'))
    const range = findWordRangeAtPosition(doc, star)
    expect(doc.slice(range.from, range.to)).toBe('继续')
  })

  it('prefers real word over weak particle 了', () => {
    const doc = '冰镇了半小时再吃'
    const pos = doc.indexOf('了')
    const range = findWordRangeAtPosition(doc, pos)
    expect(doc.slice(range.from, range.to)).toBe('冰镇了')
  })

  it('selects english word', () => {
    const doc = 'say hello world'
    const pos = doc.indexOf('hello')
    const range = findWordRangeAtPosition(doc, pos + 2)
    expect(doc.slice(range.from, range.to)).toBe('hello')
  })

  it('expands single han when segmenter only yields one char (Android ICU)', () => {
    const doc = '买了个大西瓜，老板'
    const pos = doc.indexOf('西')
    const range = findWordRangeAtPosition(doc, pos)
    expect(doc.slice(range.from, range.to)).toBe('西瓜')
  })

  it('does not over-select across punctuation', () => {
    const doc = '买了个大西瓜，老板帮忙'
    const pos = doc.indexOf('老')
    const range = findWordRangeAtPosition(doc, pos)
    expect(doc.slice(range.from, range.to)).toBe('老板')
  })
})
