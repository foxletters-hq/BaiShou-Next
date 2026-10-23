import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-agent-gate.service.ts'),
  'utf8'
)

describe('mobile agent gate inbox bridge', () => {
  it('should remove the question card when the gate is cancelled', () => {
    expect(src).toContain("event.type === 'agent_gate.cancelled'")
    expect(src).toContain('removeCancelled(event.requestIds)')
  })
})
