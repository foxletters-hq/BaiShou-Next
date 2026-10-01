import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'StreamingBubble.tsx'),
  'utf8'
)

describe('Native StreamingBubble timeline chrome', () => {
  it('should render the live stream from timeline groups instead of flattening think then tools then text', () => {
    expect(src).toContain('timeline')
    expect(src).toContain('groupStreamTimelineForDisplay')
    expect(src).toContain('assistantStreamTimelineSignature')
    expect(src).toContain('AssistantDisplayTimeline')
    expect(src.indexOf('groupStreamTimelineForDisplay')).toBeLessThan(
      src.indexOf('hasReasoning &&')
    )
    expect(src).not.toMatch(/groupStreamTimelineForDisplay\([^)]+\),\s*\[timeline\]/)
  })

  it('should place a live permission confirmation inside the stream timeline, not above it', () => {
    expect(src).toContain('gateParts')
    expect(src).toContain('groupStreamTimelineForDisplay(liveTimeline, gateParts)')
    expect(src).not.toContain('<AgentGatePartCard')
  })

  it('should wait until the text stream ends before showing stickers after the timeline', () => {
    expect(src).toContain('showStickerAttachments')
    expect(src).toContain('hasAttachments && !isTextStreaming')
    expect(src.indexOf('<AssistantDisplayTimeline')).toBeLessThan(
      src.indexOf('<NativeChatBubbleAttachments')
    )
    expect(src).toContain('display="sticker"')
    expect(src).toContain('placement="after"')
  })
})
