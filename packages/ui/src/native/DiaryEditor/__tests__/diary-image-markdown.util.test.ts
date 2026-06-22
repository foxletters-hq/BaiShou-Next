import { describe, it, expect } from 'vitest'
import {
  stripImageWidthInMarkdown,
  parseImageSrcWithoutWidth,
  parseDiaryContentBlocks,
  serializeDiaryContentBlocks,
  extractDiaryAttachmentSrcs,
  stripLegacyInlineImageSlots
} from '../diary-image-markdown.util'

const LEGACY_SLOT_LINES = 9

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

describe('stripLegacyInlineImageSlots', () => {
  it('collapses legacy preview placeholder blank lines after images', () => {
    const image = '![a](attachment/a.png)'
    const legacy = `${image}\n${'\n'.repeat(LEGACY_SLOT_LINES)}after`
    expect(stripLegacyInlineImageSlots(legacy)).toBe(`${image}\n\nafter`)
  })

  it('leaves short blank runs after images unchanged', () => {
    const content = '![a](attachment/a.png)\n\nafter'
    expect(stripLegacyInlineImageSlots(content)).toBe(content)
  })
})
