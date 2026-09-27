import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-pending-embed-counts.ts'),
  'utf8'
)

describe('mobile pending embed counts stay on the memory system', () => {
  it('should not count notebook vectors or notebook graph nodes for memory pending embeds', () => {
    expect(src).not.toContain('missingNotebookGraphNodeCount')
    expect(src).not.toContain('countPendingNotebookGraphNodes')
    expect(src).not.toContain('countPendingKnowledgeSources')
    expect(src).not.toContain("stages: ['graph']")
    expect(src).toContain('hasPendingCountSource')
    expect(src).toContain('if (!hasPendingCountSource(memoryManager))')
    expect(src).toContain('countUnindexedDiariesForActiveVault')
  })

  it('should expose diary graph extract counts and keep disambiguate at zero', () => {
    expect(src).toContain('export async function getOrganizePendingSnapshot')
    expect(src).toContain('graphExtract')
    expect(src).toContain('countPendingGraphExtract')
    expect(src).not.toContain('countPendingGraphDisambiguate')
    expect(src).not.toContain('collectSuspectSignals')
    expect(src).toContain('graphDisambiguate: 0')
  })

  it('should notify subscribers after pending counts are invalidated on purpose', () => {
    expect(src).toContain('export function notifyMobilePendingEmbedCountsChanged')
    expect(src).toContain('export function subscribeMobilePendingEmbedCountsChanged')
    const write = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-rag-memory-write.helpers.ts'), 'utf8')
    expect(write).toContain('notifyMobilePendingEmbedCountsChanged')
    expect(write).toContain('finally')
  })
})
