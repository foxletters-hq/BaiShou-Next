import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const imageSrc = readFileSync(join(here, '../ChatAttachmentImage.tsx'), 'utf8')
const css = readFileSync(join(here, '../ChatBubble.module.css'), 'utf8')

describe('ChatBubble sticker chrome', () => {
  it('should load sticker images from the original file instead of the 96px jpeg thumbnail', () => {
    expect(imageSrc).toContain("display === 'sticker'")
    expect(imageSrc).toContain('resolveChatAttachmentSrc')
    expect(imageSrc).toContain('getChatAttachmentFullImage')
    expect(imageSrc.indexOf('resolveChatAttachmentSrc')).toBeLessThan(
      imageSrc.indexOf('getChatAttachmentThumbnail')
    )
    expect(imageSrc).toContain('styles.attStickerImage')
  })

  it('should display stickers with contain fit and a larger cap than the thumb tile', () => {
    const stickerRule = css.slice(
      css.indexOf('.attStickerImage {'),
      css.indexOf('.attStickerPlaceholder {')
    )
    expect(stickerRule).toContain('object-fit: contain')
    expect(stickerRule).toContain('max-width: min(320px, 100%)')
    expect(stickerRule).not.toContain('object-fit: cover')
    expect(css).toContain('.attachmentsWrapAfter')
  })
})
