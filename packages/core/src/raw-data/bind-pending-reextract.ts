import type { ShadowIndexRepository } from '@baishou/database'
import type { DerivedFreshnessService } from './derived-freshness.service'
import type { GraphRawManager } from './managers/graph.raw-manager'
import type { GraphExtractStateRawRecord } from './raw-data-source.types'

const JOURNAL_DATE_IN_PATH = /(?:^|\/)(\d{4}-\d{2}-\d{2})\.md$/i

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '')
}

function extractJournalDateFromPath(filePath: string): string | null {
  const m = JOURNAL_DATE_IN_PATH.exec(normalizeFilePath(filePath))
  return m?.[1] ?? null
}

/**
 * Bind extract-state cursor + shadow journal listing onto DerivedFreshnessService.
 */
export function bindPendingReextractCollaborators(options: {
  freshness: DerivedFreshnessService
  graphManager: GraphRawManager
  shadowRepo: ShadowIndexRepository
  getVaultName: () => string | Promise<string>
  getVaultId: () => string | Promise<string>
}): void {
  const { freshness, graphManager, shadowRepo, getVaultName, getVaultId } = options

  freshness.bindPendingReextract({
    loadExtractHashes: async () => {
      const rows = await graphManager.readAllCollapsedExtractStates()
      const byPath = new Map<string, GraphExtractStateRawRecord>()
      const byDate = new Map<string, GraphExtractStateRawRecord>()
      for (const row of rows) {
        const key = normalizeFilePath(row.filePath)
        const existing = byPath.get(key)
        if (!existing || (row.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
          byPath.set(key, row)
        }
        const dateKey = extractJournalDateFromPath(key)
        if (dateKey) {
          const existingByDate = byDate.get(dateKey)
          if (!existingByDate || (row.updatedAt ?? 0) >= (existingByDate.updatedAt ?? 0)) {
            byDate.set(dateKey, row)
          }
        }
      }
      const out = new Map<string, string>()
      for (const [key, row] of byPath) {
        const dateKey = extractJournalDateFromPath(key)
        const dateWinner = dateKey ? byDate.get(dateKey) : undefined
        out.set(key, (dateWinner ?? row).sourceContentHash)
      }
      for (const [date, row] of byDate) {
        const hash = row.sourceContentHash
        out.set(`date:${date}`, hash)
        const canonical = `Journals/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}.md`
        if (!out.has(canonical)) out.set(canonical, hash)
        const flat = `Journals/${date}.md`
        if (!out.has(flat)) out.set(flat, hash)
      }
      return out
    },
    listJournals: async () => {
      const rows =
        typeof shadowRepo.getAllRecords === 'function'
          ? await shadowRepo.getAllRecords()
          : await shadowRepo.listAll({ orderBy: 'desc' })
      return rows
        .filter((r) => r.filePath && r.contentHash)
        .map((r) => ({
          filePath: normalizeFilePath(r.filePath),
          contentHash: r.contentHash!,
          date: r.date
        }))
    },
    writeExtractState: async (filePath, contentHash) => {
      const vaultName = await getVaultName()
      const vaultId = (await getVaultId()).trim()
      if (!vaultId) {
        throw new Error('bindPendingReextract: vaultId is required for extract-state')
      }
      const now = Date.now()
      const key = normalizeFilePath(filePath)
      const id = `extract:${key}`
      const record: GraphExtractStateRawRecord = {
        id,
        schemaVersion: 1,
        vaultId,
        vaultName,
        filePath: key,
        sourceContentHash: contentHash,
        extractedAt: now,
        updatedAt: now,
        deletedAt: null
      }
      await graphManager.writeRecord(record, { collection: 'extract-state' })
    },
    writeExtractStatesBatch: async (items) => {
      if (items.length === 0) return
      const vaultName = await getVaultName()
      const vaultId = (await getVaultId()).trim()
      if (!vaultId) {
        throw new Error('bindPendingReextract: vaultId is required for extract-state')
      }
      const now = Date.now()
      const records: GraphExtractStateRawRecord[] = items.map((item) => {
        const key = normalizeFilePath(item.filePath)
        return {
          id: `extract:${key}`,
          schemaVersion: 1,
          vaultId,
          vaultName,
          filePath: key,
          sourceContentHash: item.contentHash,
          extractedAt: now,
          updatedAt: now,
          deletedAt: null
        }
      })
      await graphManager.writeRecords(records, { collection: 'extract-state' })
    }
  })
}
