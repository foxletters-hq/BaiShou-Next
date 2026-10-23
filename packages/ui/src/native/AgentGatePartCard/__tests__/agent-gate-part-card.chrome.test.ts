import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentGatePartCard.tsx'),
  'utf8'
)

describe('AgentGatePartCard chrome', () => {
  it('should skip companion_ask history cards', () => {
    expect(src).toContain('shouldRenderAgentGateHistoryCard')
    expect(src).toContain('return null')
  })

  it('should render as a compact collapsible row matching tool items instead of a filled card', () => {
    expect(src).not.toContain('colors.primaryTrackMuted')
    expect(src).not.toContain('styles.badgeContainer')
    expect(src).toContain('useState(false)')
    expect(src).toContain('styles.statusRow')
    expect(src).toContain('CollapsibleHeight')
    expect(src).toContain('ThinkChevron')
  })
})
