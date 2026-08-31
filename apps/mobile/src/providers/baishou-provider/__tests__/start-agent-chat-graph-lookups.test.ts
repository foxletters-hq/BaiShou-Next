import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../start-agent-chat.ts'),
  'utf8'
)

describe('start-agent-chat companion graph lookups', () => {
  it('spreads createCompanionGraphLookups so edge updates are not skipped', () => {
    expect(src).toContain('...createCompanionGraphLookups')
    expect(src).toContain('getNodeById')
    expect(src).toContain('getEdgeById')
    expect(src).not.toContain('new GraphNodeLookupAdapter')
    expect(src).not.toContain('new GraphEdgeLookupAdapter')
  })
})
