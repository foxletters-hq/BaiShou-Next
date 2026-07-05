import { describe, it, expect } from 'vitest'
import { resolveInlineEnterInsertPos } from '../extensions/inlineMarkEnterKeymap'

describe('resolveInlineEnterInsertPos', () => {
  it('moves newline past closing ** when cursor is on closing delimiter', () => {
    const text = '**bold**'
    expect(resolveInlineEnterInsertPos(text, 6)).toBe(8)
    expect(resolveInlineEnterInsertPos(text, 7)).toBe(8)
  })

  it('does not move when cursor is after full mark', () => {
    expect(resolveInlineEnterInsertPos('**bold**', 8)).toBeNull()
  })

  it('does not move when cursor is inside mark content', () => {
    expect(resolveInlineEnterInsertPos('**bold**', 4)).toBeNull()
  })

  it('handles trailing text after mark', () => {
    const text = '**bold** tail'
    expect(resolveInlineEnterInsertPos(text, 6)).toBe(8)
    expect(resolveInlineEnterInsertPos(text, 8)).toBeNull()
  })

  it('handles inline code and emphasis', () => {
    expect(resolveInlineEnterInsertPos('`code`', 5)).toBe(6)
    expect(resolveInlineEnterInsertPos('*em*', 3)).toBe(4)
  })
})
