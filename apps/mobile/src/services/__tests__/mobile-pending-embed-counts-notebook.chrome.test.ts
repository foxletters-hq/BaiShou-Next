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

  it('should count pending graph extract in parallel with embed counts and keep a peekable snapshot', () => {
    expect(src).toContain('export async function getOrganizePendingSnapshot')
    expect(src).toContain('countPendingGraphExtract')
    expect(src).toContain('mobileListPendingReextract')
    expect(src).toContain('alignShadowJournalVaultId')
    expect(src).toContain('export function peekOrganizePendingSnapshot')
    expect(src).toContain('export async function hydrateOrganizePendingSnapshot')
    expect(src).toContain('Promise.all([embedPromise, extractPromise])')
    expect(src).not.toContain('getMobileDerivedFreshness()?.listPendingReextract()')
    expect(src).not.toContain('countPendingGraphDisambiguate')
    expect(src).not.toContain('collectSuspectSignals')
    expect(src).toContain('graphDisambiguate: 0')
  })

  it('should notify subscribers after pending counts are invalidated on purpose', () => {
    expect(src).toContain('export function notifyMobilePendingEmbedCountsChanged')
    expect(src).toContain('export function subscribeMobilePendingEmbedCountsChanged')
    expect(src).toContain('invalidateGraphExtractCache()')
    const write = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile-rag-memory-write.helpers.ts'),
      'utf8'
    )
    expect(write).toContain('notifyMobilePendingEmbedCountsChanged')
    expect(write).toContain('finally')
  })

  it('should preserve restored agent database file during archive import instead of quarantining it', () => {
    const archiveBridge = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'providers',
        'baishou-provider',
        'archive-db-bridge.ts'
      ),
      'utf8'
    )
    const reloadDb = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'providers',
        'baishou-provider',
        'reload-agent-database.ts'
      ),
      'utf8'
    )
    expect(archiveBridge).toContain(
      'reloadAgentDatabaseRef.current({ preserveExistingFile: true })'
    )
    expect(reloadDb).toContain('if (options?.preserveExistingFile)')
    expect(reloadDb).toContain('verifyExpoAgentDatabaseIntegrity')
  })
})
