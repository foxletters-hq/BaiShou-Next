import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-pending-embed-counts.ts'),
  'utf8'
)

describe('mobile pending embed counts notebook nodes', () => {
  it('should count notebook graph nodes separately from knowledge sources', () => {
    expect(src).toContain('listUnembeddedLiveNodes')
    expect(src).toContain('missingNotebookGraphNodeCount')
    expect(src).toContain('countPendingNotebookGraphNodes')
    expect(src).toContain('countPendingKnowledgeSources')
    expect(src).toContain('hasPendingCountSource')
    expect(src).toContain('if (!hasPendingCountSource(memoryManager))')
  })

  it('should expose graph extract and disambiguate counts for organize snapshot', () => {
    expect(src).toContain('export async function getOrganizePendingSnapshot')
    expect(src).toContain('graphExtract')
    expect(src).toContain('graphDisambiguate')
    expect(src).toContain('countPendingGraphExtract')
    expect(src).toContain('countPendingGraphDisambiguate')
    expect(src).toContain("stages: ['graph']")
    expect(src).toContain('collectSuspectSignals')
  })
})
