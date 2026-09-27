import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const tsx = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'ChatBubbleAiRow.tsx'),
  'utf8'
)

describe('ChatBubble AI timeline chrome', () => {
  it('should keep a confirmed permission inside the assistant timeline, not above it', () => {
    expect(tsx).toContain('buildAssistantDisplayTimelineFromParts')
    expect(tsx).toContain("gateSurface: props.gateSurface ?? 'companion'")
    expect(tsx).not.toContain('<AgentGatePartBubble')
  })

  it('should render persisted assistant parts as a timeline instead of all tools then all text', () => {
    expect(tsx).toContain('buildAssistantDisplayTimelineFromParts')
    expect(tsx).toContain('AssistantDisplayTimeline')
    expect(tsx.indexOf('buildAssistantDisplayTimelineFromParts')).toBeLessThan(
      tsx.indexOf('ToolResultGroup')
    )
  })

  it('should wrap assistant markdown with the citation dialog instead of stacking excerpts', () => {
    expect(tsx).toContain('<KnowledgeCitationBlock citations={citations} anchorKey={message.id}>')
    expect(tsx).not.toContain(
      '<KnowledgeCitationBlock citations={citations} anchorKey={message.id} />'
    )
  })

  it('should render assistant stickers after the stream timeline using original files', () => {
    const attachIdx = tsx.indexOf('<ChatBubbleAttachments')
    expect(attachIdx).toBeGreaterThan(tsx.indexOf('<AssistantDisplayTimeline'))
    expect(attachIdx).toBeGreaterThan(tsx.indexOf('<AgentMarkdownRenderer'))
    expect(tsx).toContain('display="sticker"')
    expect(tsx).toContain('placement="after"')
  })
})
