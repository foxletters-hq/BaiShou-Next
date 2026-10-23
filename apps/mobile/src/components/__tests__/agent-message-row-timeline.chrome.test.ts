import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentMessageRow.tsx'),
  'utf8'
)

describe('AgentMessageRow timeline chrome', () => {
  it('should pass persisted parts into ChatBubble so the assistant timeline keeps think/tool order', () => {
    expect(src).toContain('parts: item.parts')
    expect(src).toContain('liveStream={liveStream}')
  })

  it('should not stack a permission card above the bubble when ChatBubble already renders the timeline', () => {
    expect(src).not.toContain('<AgentGatePartCard')
  })
})
