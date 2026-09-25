import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const bubbleSrc = readFileSync(join(here, '../ChatBubble.tsx'), 'utf8')
const streamSrc = readFileSync(
  join(here, '../../StreamingBubble/StreamingBubble.tsx'),
  'utf8'
)
const attachSrc = readFileSync(join(here, '../NativeChatBubbleAttachments.tsx'), 'utf8')

describe('Native chat sticker chrome', () => {
  it('should render assistant stickers after markdown and wait until the text stream ends', () => {
    expect(bubbleSrc.indexOf('AgentMarkdownRenderer')).toBeLessThan(
      bubbleSrc.lastIndexOf('NativeChatBubbleAttachments')
    )
    expect(bubbleSrc).toContain('!markdownStreaming')
    expect(bubbleSrc).toContain('display="sticker"')
    expect(streamSrc).toContain('showStickerAttachments')
    expect(streamSrc).toContain('hasAttachments && !isTextStreaming')
    expect(streamSrc.indexOf('AgentMarkdownRenderer')).toBeLessThan(
      streamSrc.indexOf('display="sticker"')
    )
  })

  it('should use contain fit for sticker images instead of the cropped thumb tile', () => {
    expect(attachSrc).toContain("display === 'sticker'")
    expect(attachSrc).toContain("resizeMode={isSticker ? 'contain' : 'cover'}")
    expect(attachSrc).toContain('stickerImage')
  })
})
