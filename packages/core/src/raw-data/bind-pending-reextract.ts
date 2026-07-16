import type { ShadowIndexRepository } from '@baishou/database'
import type { DerivedFreshnessService } from './derived-freshness.service'
import type { GraphRawManager } from './managers/graph.raw-manager'
import type { GraphExtractStateRawRecord } from './raw-data-source.types'

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '')
}

/**
 * Bind extract-state cursor + shadow journal listing onto DerivedFreshnessService.
 */
export function bindPendingReextractCollaborators(options: {
  freshness: DerivedFreshnessService
  graphManager: GraphRawManager
  shadowRepo: ShadowIndexRepository
  getVaultName: () => string | Promise<string>
}): void {
  const { freshness, graphManager, shadowRepo, getVaultName } = options

  freshness.bindPendingReextract({
    loadExtractHashes: async () => {
      const rows = await graphManager.readAllCollapsedExtractStates()
      const byPath = new Map<string, GraphExtractStateRawRecord>()
      for (const row of rows) {
        const key = normalizeFilePath(row.filePath)
        const existing = byPath.get(key)
        if (!existing || (row.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
          byPath.set(key, row)
        }
      }
      const out = new Map<string, string>()
      for (const [key, row] of byPath) {
        out.set(key, row.sourceContentHash)
      }
      return out
    },
    listJournals: async () => {
      const rows = await shadowRepo.listAll({ orderBy: 'desc' })
      return rows
        .filter((r) => r.filePath && r.contentHash)
        .map((r) => ({
          filePath: normalizeFilePath(r.filePath),
          contentHash: r.contentHash,
          date: r.date
        }))
    },
    writeExtractState: async (filePath, contentHash) => {
      const vaultName = await getVaultName()
      const now = Date.now()
      const key = normalizeFilePath(filePath)
      const id = `extract:${key}`
      const record: GraphExtractStateRawRecord = {
        id,
        schemaVersion: 1,
        vaultName,
        filePath: key,
        sourceContentHash: contentHash,
        extractedAt: now,
        updatedAt: now,
        deletedAt: null
      }
      await graphManager.writeRecord(record, { collection: 'extract-state' })
    }
  })
}
