import { describe, expect, it } from 'vitest'
import {
  hasUnpairedSurrogates,
  sanitizeSurrogatesDeep,
  sanitizeUnpairedSurrogates,
  truncateTextSafe
} from '../text-safety.util'

describe('text-safety.util', () => {
  it('detects lone high and low surrogates', () => {
    expect(hasUnpairedSurrogates('hello')).toBe(false)
    expect(hasUnpairedSurrogates('hi 😀')).toBe(false)
    expect(hasUnpairedSurrogates('bad \ud83d')).toBe(true)
    expect(hasUnpairedSurrogates('bad \ude00')).toBe(true)
    expect(hasUnpairedSurrogates('mid \ud83d text')).toBe(true)
  })

  it('replaces only unpaired surrogates and keeps valid pairs', () => {
    expect(sanitizeUnpairedSurrogates('a \ud83d b')).toBe('a \uFFFD b')
    expect(sanitizeUnpairedSurrogates('a \ude00 b')).toBe('a \uFFFD b')
    expect(sanitizeUnpairedSurrogates('ok 😀')).toBe('ok 😀')
  })

  it('returns the original string reference when nothing needs fixing', () => {
    const clean = 'ok 😀'
    expect(sanitizeUnpairedSurrogates(clean)).toBe(clean)
  })

  it('truncates without splitting a surrogate pair', () => {
    // '😀' occupies two UTF-16 code units at index 1..2
    const text = 'a😀bcd'
    expect(truncateTextSafe(text, 2)).toBe('a')
    expect(truncateTextSafe(text, 3)).toBe('a😀')
    expect(truncateTextSafe(text, 2, '…')).toBe('a…')
  })

  it('leaves short text untouched and appends suffix only when truncated', () => {
    expect(truncateTextSafe('abc', 10, '…')).toBe('abc')
    expect(truncateTextSafe('abcdef', 3, '…')).toBe('abc…')
  })

  it('sanitizes nested messages deeply without cloning clean branches', () => {
    const cleanPart = { type: 'text', text: 'ok' }
    const prompt = [
      { role: 'user', content: 'hi \ud83d' },
      { role: 'assistant', content: [cleanPart] }
    ]
    const result = sanitizeSurrogatesDeep(prompt)

    expect(result).not.toBe(prompt)
    expect(result[0]!.content).toBe('hi \uFFFD')
    expect(result[1]!.content[0]).toBe(cleanPart)
  })

  it('keeps non-plain objects untouched', () => {
    const date = new Date()
    const bytes = new Uint8Array([1, 2, 3])
    const input = { date, bytes }
    expect(sanitizeSurrogatesDeep(input)).toBe(input)
  })

  it('returns the same object when all strings are clean', () => {
    const input = { role: 'user', content: 'hello 😀' }
    expect(sanitizeSurrogatesDeep(input)).toBe(input)
  })
})
