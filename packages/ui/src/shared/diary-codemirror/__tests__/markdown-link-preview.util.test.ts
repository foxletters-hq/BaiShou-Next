import { describe, expect, it } from 'vitest'
import {
  markdownInlineLinkPreviewRanges,
  selectionTouchesLinkRange
} from '../extensions/markdown-link-preview.util'

describe('markdownInlineLinkPreviewRanges', () => {
  it('hides brackets and destination for inline links', () => {
    const raw = '[每日经济新闻](https://www.nbd.com.cn/articles/2026-08-18/4545630.html)'
    const parts = markdownInlineLinkPreviewRanges(raw, 1)
    expect(parts).not.toBeNull()
    expect(raw.slice(parts!.labelFrom - 1, parts!.labelTo - 1)).toBe('每日经济新闻')
    expect(parts!.hideRanges).toEqual([
      { from: 1, to: 2 },
      { from: 1 + raw.indexOf(']('), to: 1 + raw.length }
    ])
  })

  it('keeps a title inside the hidden destination', () => {
    const raw = '[文档](https://example.com "来源")'
    const parts = markdownInlineLinkPreviewRanges(raw, 0)
    expect(parts?.hideRanges[1]).toEqual({ from: raw.indexOf(']('), to: raw.length })
  })

  it('handles balanced brackets in the label', () => {
    const raw = '[see [note]](https://example.com)'
    const parts = markdownInlineLinkPreviewRanges(raw, 0)
    expect(raw.slice(parts!.labelFrom, parts!.labelTo)).toBe('see [note]')
    expect(parts!.hideRanges[1].from).toBe(raw.lastIndexOf(']('))
  })

  it('supports reference links', () => {
    const raw = '[文字][ref]'
    const parts = markdownInlineLinkPreviewRanges(raw, 0)
    expect(raw.slice(parts!.labelFrom, parts!.labelTo)).toBe('文字')
    expect(parts!.hideRanges[1]).toEqual({ from: raw.indexOf(']['), to: raw.length })
  })

  it('ignores images and angle autolinks', () => {
    expect(markdownInlineLinkPreviewRanges('![图](a.png)', 0)).toBeNull()
    expect(markdownInlineLinkPreviewRanges('<https://example.com>', 0)).toBeNull()
  })
})

describe('selectionTouchesLinkRange', () => {
  const link = { from: 10, to: 40 }

  it('expands when the caret is inside the link, not after it', () => {
    expect(selectionTouchesLinkRange([{ from: 10, to: 10 }], link.from, link.to)).toBe(true)
    expect(selectionTouchesLinkRange([{ from: 25, to: 25 }], link.from, link.to)).toBe(true)
    expect(selectionTouchesLinkRange([{ from: 40, to: 40 }], link.from, link.to)).toBe(false)
    expect(selectionTouchesLinkRange([{ from: 9, to: 9 }], link.from, link.to)).toBe(false)
  })

  it('expands when a selection overlaps the link', () => {
    expect(selectionTouchesLinkRange([{ from: 5, to: 12 }], link.from, link.to)).toBe(true)
    expect(selectionTouchesLinkRange([{ from: 1, to: 8 }], link.from, link.to)).toBe(false)
  })
})
