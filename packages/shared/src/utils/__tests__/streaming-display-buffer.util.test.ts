import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildStreamingDisplayText,
  createStreamingTextDisplayBuffer,
  splitStreamingRevealUnits,
  splitStreamingTextLines,
  STREAM_LINE_REVEAL_MS,
  STREAM_SEGMENT_MAX_CHARS
} from '../streaming-display-buffer.util'

describe('splitStreamingTextLines', () => {
  it('splits complete and partial lines', () => {
    expect(splitStreamingTextLines('a\nb\nc')).toEqual({
      completeLines: ['a', 'b'],
      partialLine: 'c'
    })
  })

  it('treats trailing newline as empty partial', () => {
    expect(splitStreamingTextLines('a\nb\n')).toEqual({
      completeLines: ['a', 'b'],
      partialLine: ''
    })
  })
})

describe('splitStreamingRevealUnits', () => {
  it('splits on newline and sentence punctuation', () => {
    expect(splitStreamingRevealUnits('你好。世界')).toEqual({
      completeUnits: ['你好。'],
      partialUnit: '世界'
    })
  })

  it('splits long text without punctuation by max chars', () => {
    const long = 'a'.repeat(STREAM_SEGMENT_MAX_CHARS + 10)
    const { completeUnits, partialUnit } = splitStreamingRevealUnits(long)
    expect(completeUnits).toEqual(['a'.repeat(STREAM_SEGMENT_MAX_CHARS)])
    expect(partialUnit).toBe('a'.repeat(10))
  })
})

describe('buildStreamingDisplayText', () => {
  it('reveals units progressively', () => {
    const buffer = 'line1\nline2\nline3'
    expect(buildStreamingDisplayText(buffer, 0, false)).toBe('')
    expect(buildStreamingDisplayText(buffer, 1, false)).toBe('line1\n')
    expect(buildStreamingDisplayText(buffer, 2, false)).toBe('line1\nline2\n')
    expect(buildStreamingDisplayText(buffer, 2, true)).toBe('line1\nline2\nline3')
  })
})

describe('createStreamingTextDisplayBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reveals units one by one instead of per character', () => {
    const displays: string[] = []
    const buffer = createStreamingTextDisplayBuffer((text) => displays.push(text))

    buffer.push('第一行\n')
    vi.advanceTimersByTime(STREAM_LINE_REVEAL_MS)
    expect(displays.at(-1)).toBe('第一行\n')

    buffer.push('第二行\n')
    vi.advanceTimersByTime(STREAM_LINE_REVEAL_MS)
    expect(displays.at(-1)).toBe('第一行\n第二行\n')
  })

  it('does not show partial text until flush', () => {
    const displays: string[] = []
    const buffer = createStreamingTextDisplayBuffer((text) => displays.push(text))

    buffer.push('你')
    vi.advanceTimersByTime(2000)
    expect(displays).toHaveLength(0)

    buffer.push('好')
    vi.advanceTimersByTime(2000)
    expect(displays).toHaveLength(0)

    buffer.flush()
    expect(displays.at(-1)).toBe('你好')
  })

  it('flush shows full text immediately', () => {
    const displays: string[] = []
    const buffer = createStreamingTextDisplayBuffer((text) => displays.push(text))

    buffer.push('a\nb\nc')
    buffer.flush()
    expect(displays.at(-1)).toBe('a\nb\nc')
    expect(buffer.getFullText()).toBe('a\nb\nc')
  })

  it('reset clears buffered content', () => {
    const displays: string[] = []
    const buffer = createStreamingTextDisplayBuffer((text) => displays.push(text))

    buffer.push('hello')
    buffer.reset()
    expect(displays.at(-1)).toBe('')
    expect(buffer.getFullText()).toBe('')
  })

  it('immediate mode emits full buffer on every push (XMarkdown path)', () => {
    const displays: string[] = []
    const buffer = createStreamingTextDisplayBuffer((text) => displays.push(text), {
      immediate: true
    })

    buffer.push('# Hel')
    expect(displays.at(-1)).toBe('# Hel')

    buffer.push('lo\n')
    expect(displays.at(-1)).toBe('# Hello\n')
    expect(buffer.getDisplayText()).toBe('# Hello\n')
  })

  it('reveals partial text by minimum chunk size instead of per character', () => {
    const displays: string[] = []
    const buffer = createStreamingTextDisplayBuffer((text) => displays.push(text), {
      showPartialDuringGap: true,
      partialRevealMinChars: 3,
      partialRevealMs: 1000,
      segmentMaxChars: 20
    })

    buffer.push('你')
    expect(displays).toHaveLength(0)

    buffer.push('好')
    expect(displays).toHaveLength(0)

    buffer.push('呀')
    expect(displays.at(-1)).toBe('你好呀')

    buffer.push('啊')
    expect(displays.at(-1)).toBe('你好呀')

    buffer.push('哈')
    expect(displays.at(-1)).toBe('你好呀')

    buffer.push('哈')
    expect(displays.at(-1)).toBe('你好呀啊哈哈')
  })

  it('reveals a short partial after the wait threshold', () => {
    const displays: string[] = []
    const buffer = createStreamingTextDisplayBuffer((text) => displays.push(text), {
      showPartialDuringGap: true,
      partialRevealMinChars: 10,
      partialRevealMs: 120,
      segmentMaxChars: 20
    })

    buffer.push('hi')
    expect(displays).toHaveLength(0)

    vi.advanceTimersByTime(119)
    expect(displays).toHaveLength(0)

    vi.advanceTimersByTime(1)
    expect(displays.at(-1)).toBe('hi')
  })
})
