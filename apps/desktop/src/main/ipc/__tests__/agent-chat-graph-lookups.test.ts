import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../AgentChatService.ts'), 'utf8')

describe('AgentChatService companion graph lookups', () => {
  it('builds graphNodeLookup and graphEdgeLookup via createCompanionGraphLookups', () => {
    expect(src).toContain('createCompanionGraphLookups')
    expect(src).toContain('getNodeById')
    expect(src).toContain('getEdgeById')
    expect(src).toMatch(/graphNodeLookup,\s*graphEdgeLookup/)
    expect(src).not.toContain('new GraphNodeLookupAdapter')
    expect(src).not.toContain('new GraphEdgeLookupAdapter')
  })
})
