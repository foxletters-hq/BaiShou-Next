import { describe, it, expect } from 'vitest'
import {
  prepareNativeStreamdownMarkdown,
  markdownNeedsLegacyImageRenderer,
  preserveChatDisplayNewlines
} from '../streamdown-markdown.util'

describe('preserveChatDisplayNewlines', () => {
  it('converts trailing newlines to hard breaks', () => {
    expect(preserveChatDisplayNewlines('hello\n')).toBe('hello  \n')
    expect(preserveChatDisplayNewlines('hello\n\n')).toBe('hello  \n  \n')
  })

  it('converts inline single newlines within a paragraph', () => {
    expect(preserveChatDisplayNewlines('hello\nworld')).toBe('hello  \nworld')
  })

  it('leaves content without newlines unchanged', () => {
    expect(preserveChatDisplayNewlines('hello')).toBe('hello')
  })

  it('preserves paragraph breaks', () => {
    expect(preserveChatDisplayNewlines('line one\nline two\n\npara two')).toBe(
      'line one  \nline two\n\npara two'
    )
  })
})

describe('prepareNativeStreamdownMarkdown', () => {
  it('strips zero-width chars and image width syntax', () => {
    expect(prepareNativeStreamdownMarkdown('hello\u200B\n\n![a](x.png | 120)')).toBe(
      'hello\n\n![a](x.png)'
    )
  })

  it('rewrites sync-resolvable attachment URIs', () => {
    const out = prepareNativeStreamdownMarkdown('![img](attachment/a.png)', (src) =>
      src === 'attachment/a.png' ? 'file:///data/a.png' : null
    )
    expect(out).toBe('![img](file:///data/a.png)')
  })
})

describe('markdownNeedsLegacyImageRenderer', () => {
  it('returns true when attachment image needs async loader', () => {
    expect(
      markdownNeedsLegacyImageRenderer(
        '![x](attachment/foo.png)',
        undefined,
        async () => 'data:image/png;base64,abc'
      )
    ).toBe(true)
  })

  it('returns false when sync URI is displayable', () => {
    expect(
      markdownNeedsLegacyImageRenderer(
        '![x](attachment/foo.png)',
        () => 'file:///data/foo.png',
        async () => null
      )
    ).toBe(false)
  })
})
