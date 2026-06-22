import { describe, it, expect } from 'vitest'
import {
  stripImageWidthInMarkdown,
  parseImageSrcWithoutWidth,
  parseDiaryContentBlocks,
  serializeDiaryContentBlocks,
  extractDiaryAttachmentSrcs,
  buildInlineImageInsertSnippet,
  ensureInlineImagePreviewSlots,
  getCursorOffsetAfterInlineImage,
  getLineIndexForOffset,
  getInlineImageBlocks,
  maskImageMarkdownLines,
  mergeMaskedEditorContent,
  DIARY_INLINE_IMAGE_SLOT_LINES
} from '../diary-image-markdown.util'

describe('parseDiaryContentBlocks', () => {
  it('splits text and image blocks', () => {
    const content = 'hello\n\n![alt](attachment/a.png | 283)\n\nworld'
    const blocks = parseDiaryContentBlocks(content)
    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ type: 'text', content: 'hello\n\n' })
    expect(blocks[1]).toMatchObject({
      type: 'image',
      src: 'attachment/a.png',
      width: 283,
      raw: '![alt](attachment/a.png | 283)'
    })
    expect(blocks[2]).toMatchObject({ type: 'text', content: '\n\nworld' })
  })

  it('round-trips through serialize', () => {
    const content = '![x](attachment/y.png | 120)'
    expect(serializeDiaryContentBlocks(parseDiaryContentBlocks(content))).toBe(content)
  })
})

describe('extractDiaryAttachmentSrcs', () => {
  it('collects attachment sources', () => {
    expect(
      extractDiaryAttachmentSrcs('![a](attachment/one.png | 1)\n![b](attachment/two.jpg)')
    ).toEqual(['attachment/one.png', 'attachment/two.jpg'])
  })
})

describe('stripImageWidthInMarkdown', () => {
  it('strips pipe width from image markdown', () => {
    const input = '![pasted.png](attachment/pasted.png | 283)'
    expect(stripImageWidthInMarkdown(input)).toBe('![pasted.png](attachment/pasted.png)')
  })

  it('leaves images without width unchanged', () => {
    const input = '![alt](attachment/foo.png)'
    expect(stripImageWidthInMarkdown(input)).toBe(input)
  })

  it('only strips width in image syntax', () => {
    const input = 'text | 123\n![a](b.png | 50)'
    expect(stripImageWidthInMarkdown(input)).toBe('text | 123\n![a](b.png)')
  })
})

describe('parseImageSrcWithoutWidth', () => {
  it('strips pipe suffix', () => {
    expect(parseImageSrcWithoutWidth('attachment/foo.png | 283')).toBe('attachment/foo.png')
  })

  it('strips query width param', () => {
    expect(parseImageSrcWithoutWidth('attachment/foo.png?width=283')).toBe('attachment/foo.png')
  })

  it('decodes encoded pipe', () => {
    expect(parseImageSrcWithoutWidth('attachment/foo.png%7C283')).toBe('attachment/foo.png')
  })

  it('returns plain src unchanged', () => {
    expect(parseImageSrcWithoutWidth('attachment/foo.png')).toBe('attachment/foo.png')
  })
})

describe('inline image editor helpers', () => {
  it('buildInlineImageInsertSnippet reserves preview blank lines', () => {
    const snippet = buildInlineImageInsertSnippet('![a](attachment/a.png)')
    expect(snippet).toBe(`![a](attachment/a.png)\n${'\n'.repeat(DIARY_INLINE_IMAGE_SLOT_LINES)}`)
  })

  it('getLineIndexForOffset maps global offset to line index', () => {
    const content = 'line0\nline1\nline2'
    expect(getLineIndexForOffset(content, 0)).toBe(0)
    expect(getLineIndexForOffset(content, 6)).toBe(1)
    expect(getLineIndexForOffset(content, content.length)).toBe(2)
  })

  it('getCursorOffsetAfterInlineImage skips preview slot lines', () => {
    const image = '![a](attachment/a.png)'
    const content = `${image}\n${'\n'.repeat(DIARY_INLINE_IMAGE_SLOT_LINES)}after`
    const blocks = getInlineImageBlocks(content)
    expect(blocks).toHaveLength(1)
    const offset = getCursorOffsetAfterInlineImage(content, blocks[0]!)
    expect(content.slice(offset)).toBe('after')
  })

  it('ensureInlineImagePreviewSlots adds blank lines between consecutive images', () => {
    const content = '![a](attachment/a.png)\n![b](attachment/b.png)'
    const normalized = ensureInlineImagePreviewSlots(content)
    const lines = normalized.split('\n')
    expect(lines[0]).toBe('![a](attachment/a.png)')
    expect(lines.slice(1, DIARY_INLINE_IMAGE_SLOT_LINES).every((line) => line === '')).toBe(true)
    expect(lines[DIARY_INLINE_IMAGE_SLOT_LINES]).toBe('![b](attachment/b.png)')
  })

  it('maskImageMarkdownLines hides image syntax without changing length', () => {
    const content = 'hello\n![a](attachment/a.png)\nworld'
    const masked = maskImageMarkdownLines(content)
    expect(masked.length).toBe(content.length)
    expect(masked).toBe(`hello\n${' '.repeat('![a](attachment/a.png)'.length)}\nworld`)
  })

  it('mergeMaskedEditorContent restores image lines from mask', () => {
    const content = 'hello\n![a](attachment/a.png)\nworld'
    const masked = maskImageMarkdownLines(content)
    const edited = masked.replace('world', 'world!')
    expect(mergeMaskedEditorContent(content, edited)).toBe(
      'hello\n![a](attachment/a.png)\nworld!'
    )
  })
})
