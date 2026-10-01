import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const bubbleSrc = readFileSync(join(here, '../ChatBubble.tsx'), 'utf8')
const streamSrc = readFileSync(join(here, '../../StreamingBubble/StreamingBubble.tsx'), 'utf8')
const attachSrc = readFileSync(join(here, '../NativeChatBubbleAttachments.tsx'), 'utf8')

describe('Native chat sticker chrome', () => {
  it('should render assistant stickers after markdown and wait until the text stream ends', () => {
    expect(bubbleSrc.indexOf('AssistantDisplayTimeline')).toBeLessThan(
      bubbleSrc.lastIndexOf('NativeChatBubbleAttachments')
    )
    expect(bubbleSrc).toContain('!markdownStreaming')
    expect(bubbleSrc).toContain('display="sticker"')
    expect(streamSrc).toContain('showStickerAttachments')
    expect(streamSrc).toContain('hasAttachments && !isTextStreaming')
    expect(streamSrc.indexOf('<AssistantDisplayTimeline')).toBeLessThan(
      streamSrc.indexOf('display="sticker"')
    )
    expect(attachSrc).toContain("display === 'sticker'")
    expect(attachSrc).toContain('stickerImage')
  })

  it('should stream think markdown while live reasoning is arriving', () => {
    expect(bubbleSrc).toContain('liveStream.isThinkStreaming')
    expect(bubbleSrc).toContain('isThinkStreaming={Boolean(liveStream?.isThinkStreaming)')
    expect(streamSrc).toContain('isThinkStreaming={(isThinkStreaming || isReasoning) && !error}')
  })

  it('should wrap assistant markdown with the citation dialog instead of stacking excerpts', () => {
    expect(bubbleSrc).toContain('<KnowledgeCitationBlock citations={knowledgeCitations}')
    expect(bubbleSrc).toContain('decorateKnowledgeCitedTexts')
    expect(bubbleSrc).not.toContain(
      '{isAssistant && knowledgeCitations.length > 0 ? (\n          <KnowledgeCitationBlock citations={knowledgeCitations} />'
    )
  })
})
