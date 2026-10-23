import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AssistantDisplayTimeline.tsx'),
  'utf8'
)

describe('Native AssistantDisplayTimeline chrome', () => {
  it('should render think, tools, text and permission cards in timeline order', () => {
    expect(src).toContain("item.kind === 'reasoning'")
    expect(src).toContain("item.kind === 'text'")
    expect(src).toContain("item.kind === 'gate'")
    expect(src).toContain('<AgentThinkSection')
    expect(src).toContain('<AgentToolChainSection')
    expect(src).toContain('<AgentMarkdownRenderer')
    expect(src).toContain('<AgentGatePartCard')
  })

  it('should only keep the last non-gate segment in the streaming state', () => {
    expect(src).toContain('restIsOnlyGates')
    expect(src).toContain('isMarkdownStreaming={isThinkStreaming && streamingHere}')
  })

  it('should spin the think header only while reasoning is still being generated', () => {
    expect(src).toContain('isThinkLoading')
    expect(src).toContain('isLoading={isThinkLoading && streamingHere}')
    expect(src).not.toContain('isLoading={isStreaming && streamingHere}')
  })

  it('should keep tool rows collapsed while they are running', () => {
    expect(src).not.toContain('defaultExpanded')
  })

  it('should coalesce reasoning and tools with AgentProcessSection', () => {
    expect(src).toContain('coalesceTimelineItemsForDisplay')
    expect(src).toContain('<AgentProcessSection')
    expect(src).toContain('hasAnswerText={coalesced.hasSubsequentText}')
    expect(src).toContain('hasPrecedingText={coalesced.hasPrecedingText}')
    expect(src).not.toContain('variant="ancillary"')
  })
})
