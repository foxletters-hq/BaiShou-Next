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

  it('should pick the bare-name node when companion lookup finds several same-name rows', () => {
    expect(src).toContain('findNodesByNameOrAlias')
    expect(src).toContain('pickBareGraphNameHit')
    expect(src).not.toContain('repo.findNodeByNameOrAlias(vaultId, name, nodeType)')
  })

  it('should pass edge id, source, validFrom and isCurrent to recall_relations', () => {
    expect(src).toContain('id: e.id')
    expect(src).toContain('sourceRef: e.sourceRef')
    expect(src).toContain('validFrom: e.validFrom')
    expect(src).toContain('isCurrent: e.isCurrent')
  })

  it('should inject a mobile skillsWriter so companion skill_write can persist', () => {
    expect(src).toContain('createMobileSkillsWriter')
    expect(src).toContain('skillsWriter: createMobileSkillsWriter()')
  })

  it('should inject skillsCatalog and skillsReader for on-demand skill bodies', () => {
    expect(src).toContain('mobileListSkillsCatalog')
    expect(src).toContain('skillsCatalog: await mobileListSkillsCatalog()')
    expect(src).toContain('createMobileSkillsReader')
    expect(src).toContain('skillsReader: createMobileSkillsReader()')
  })
})
