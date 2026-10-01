import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const tsx = readFileSync(join(here, '../ChatBubble.tsx'), 'utf8')
const hook = readFileSync(join(here, '../useNativeAssistantTimeline.ts'), 'utf8')

describe('Native ChatBubble timeline chrome', () => {
  it('should render persisted assistant parts as a timeline instead of all tools then all text', () => {
    expect(hook).toContain('buildAssistantDisplayTimelineFromParts')
    expect(hook).toContain("gateSurface: 'companion'")
    expect(tsx).toContain('useNativeAssistantTimeline')
    expect(tsx).toContain('AssistantDisplayTimeline')
    expect(tsx.indexOf('useNativeAssistantTimeline')).toBeLessThan(
      tsx.indexOf('showPersistedTools')
    )
  })

  it('should prefer a live timeline over flattening think then tools then text', () => {
    expect(hook).toContain('groupStreamTimelineForDisplay')
    expect(hook).toContain('assistantStreamTimelineSignature')
    expect(tsx).toContain('liveStream?.timeline')
  })

  it('should keep a confirmed permission inside the assistant timeline, not above it', () => {
    expect(hook).toContain('buildAssistantDisplayTimelineFromParts')
    expect(tsx).not.toContain('<AgentGatePartCard')
  })

  it('should render assistant stickers after the stream timeline', () => {
    const attachIdx = tsx.lastIndexOf('NativeChatBubbleAttachments')
    expect(attachIdx).toBeGreaterThan(tsx.indexOf('<AssistantDisplayTimeline'))
    expect(tsx).toContain('display="sticker"')
    expect(tsx).toContain('placement="after"')
  })
})
