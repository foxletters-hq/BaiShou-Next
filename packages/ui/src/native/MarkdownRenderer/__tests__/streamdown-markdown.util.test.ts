import { describe, it, expect } from 'vitest'
import {
  buildStreamdownMarkdownStyle,
  prepareNativeStreamdownMarkdown,
  markdownNeedsLegacyImageRenderer,
  preserveChatDisplayNewlines,
  estimateChatMarkdownMinHeight
} from '../streamdown-markdown.util'

const mockColors = {
  textPrimary: '#111',
  textSecondary: '#666',
  primary: '#0a7',
  bgSurface: '#fff',
  bgSurfaceHighest: '#eee',
  borderSubtle: '#ccc'
} as const

describe('buildStreamdownMarkdownStyle', () => {
  it('keeps preview h4-h6 at or above body size', () => {
    const style = buildStreamdownMarkdownStyle(mockColors, 'preview')
    expect(style.paragraph?.fontSize).toBe(15)
    expect(style.h4?.fontSize).toBeGreaterThanOrEqual(16)
    expect(style.h5?.fontSize).toBeGreaterThanOrEqual(15)
    expect(style.h6?.fontSize).toBeGreaterThanOrEqual(15)
  })
})

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

describe('estimateChatMarkdownMinHeight', () => {
  it('grows with line count for long chat prose', () => {
    const short = estimateChatMarkdownMinHeight('你好')
    const long = estimateChatMarkdownMinHeight(
      '**拉提：** 今天的两项模块边界已经梳理完成——桌面插件的扩展机制已经顺利落地，社区贡献的二次开发规范也全部整理清楚了。这套架构设计确实非常清晰，现在是不是可以继续检查界面细节、然后准备发版本啦？'
    )
    expect(long).toBeGreaterThan(short)
    expect(long).toBeGreaterThanOrEqual(24 * 4)
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

  it('softens decorative backticks in chat mode', () => {
    const raw = 'changelog还在等呢 (´・ω・`)'
    expect(prepareNativeStreamdownMarkdown(raw, undefined, { chat: true })).toBe(
      "changelog还在等呢 (´・ω・')"
    )
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
