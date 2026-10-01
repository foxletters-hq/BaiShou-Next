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
})
