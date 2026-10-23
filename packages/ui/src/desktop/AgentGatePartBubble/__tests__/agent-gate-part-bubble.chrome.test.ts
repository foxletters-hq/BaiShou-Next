import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentGatePartBubble.tsx'),
  'utf8'
)

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AgentGatePartBubble.module.css'),
  'utf8'
)

describe('AgentGatePartBubble chrome', () => {
  it('should skip companion_ask history cards', () => {
    expect(src).toContain('shouldRenderAgentGateHistoryCard')
    expect(src).toContain('return null')
  })

  it('should stay collapsed until the row is clicked and avoid a filled card', () => {
    expect(src).toContain('useState(false)')
    expect(src).toContain('aria-expanded')
    expect(src).toContain('styles.row')
    expect(css).toContain('background: transparent')
    expect(css).not.toContain('border-radius: 12px')
  })
})
