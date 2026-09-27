import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AssistantDisplayTimeline.tsx'),
  'utf8'
)

describe('AssistantDisplayTimeline chrome', () => {
  it('should render permission confirmations in timeline order with the tool rows', () => {
    expect(src).toContain("item.kind === 'gate'")
    expect(src).toContain('<AgentGatePartBubble')
    expect(src).toContain("item.kind === 'reasoning'")
  })
})
