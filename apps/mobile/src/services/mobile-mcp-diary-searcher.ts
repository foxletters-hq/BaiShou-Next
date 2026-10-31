import type { ToolDiarySearcher } from '@baishou/ai'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import {
  DiaryService,
  FileSyncServiceImpl,
  ShadowIndexSyncService,
  VaultIndexServiceImpl,
  type IEmbeddingCallback,
  type IFileSystem,
  type IVaultService,
  type VaultInfo,
  type VaultService
} from '@baishou/core-mobile'
import {
  formatDiaryPreviewText,
  parseDateStr,
  prepareDiarySearcherEdit,
  prepareDiarySearcherWrite
} from '@baishou/shared'
import type { MobileStoragePathService } from './path.service'

function diaryPreviewFromRaw(raw: string | null | undefined): string {
  const cleaned = formatDiaryPreviewText(raw)
  const firstLine = cleaned
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('---'))
  if (!firstLine) return '(empty)'
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}...` : firstLine
}

export async function createScopedMobileDiarySearcher(params: {
  vaultId: string
  vaultName: string
  scopedPathService: MobileStoragePathService
  fileSystem?: IFileSystem
  vaultService?: VaultService
}): Promise<ToolDiarySearcher | undefined> {
  if (!shadowConnectionManager.isConnected()) return undefined
  const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), params.vaultId)
  const fs = params.fileSystem
  const baseVaultService = params.vaultService
  let diaryService: DiaryService | null = null
  if (fs && baseVaultService) {
    const rawRuntime = await import('./mobile-raw-data-source.runtime')
    const rawManager = rawRuntime.getMobileRawDataSourceManagerForVault(
      params.vaultName,
      params.scopedPathService
    )
    const fileSyncService = new FileSyncServiceImpl(
      params.scopedPathService,
      fs,
      rawManager ?? undefined
    )
    const vaultPath = (await params.scopedPathService.getActiveVaultPath()) || ''
    const fixedVaultService: IVaultService = {
      initRegistry: () => baseVaultService.initRegistry(),
      getActiveVault: (): VaultInfo => ({
        id: params.vaultId,
        name: params.vaultName,
        path: vaultPath,
        createdAt: new Date(),
        lastAccessedAt: new Date()
      }),
      resolveActiveVault: () => ({ id: params.vaultId, name: params.vaultName }),
      getAllVaults: () => baseVaultService.getAllVaults(),
      vaultExists: (name) => baseVaultService.vaultExists(name),
      findRegistryNameConflicts: () => baseVaultService.findRegistryNameConflicts(),
      createVault: (name) => baseVaultService.createVault(name),
      switchVault: (name) => baseVaultService.switchVault(name),
      deleteVault: (name) => baseVaultService.deleteVault(name),
      syncRegistryWithDisk: () => baseVaultService.syncRegistryWithDisk(),
      ensureVaultsRegistered: (names) => baseVaultService.ensureVaultsRegistered(names),
      pruneOrphanRegistryVaults: (scopes, names) =>
        baseVaultService.pruneOrphanRegistryVaults(scopes, names),
      renameVault: (oldNameOrId, newName) => baseVaultService.renameVault(oldNameOrId, newName),
      estimateVaultLocalSyncBytes: (nameOrId) =>
        baseVaultService.estimateVaultLocalSyncBytes(nameOrId)
    }
    const { getMobileDiaryEmbeddingCallback } = await import('./mobile-diary-embedding.service')
    const baseEmbeddingCb = getMobileDiaryEmbeddingCallback()
    const scopedEmbeddingCb: IEmbeddingCallback = {
      reEmbedDiary: (p) =>
        baseEmbeddingCb.reEmbedDiary({
          ...p,
          vaultName: p.vaultName ?? params.vaultName
        }),
      enqueueDiaryEmbed: baseEmbeddingCb.enqueueDiaryEmbed
        ? (p) =>
            baseEmbeddingCb.enqueueDiaryEmbed!({
              ...p,
              vaultName: p.vaultName ?? params.vaultId
            })
        : undefined,
      deleteEmbeddingsBySource: (sourceType, sourceId) =>
        baseEmbeddingCb.deleteEmbeddingsBySource(sourceType, sourceId)
    }
    const shadowIndexSyncService = new ShadowIndexSyncService(
      shadowRepo,
      params.scopedPathService,
      fixedVaultService,
      fs,
      scopedEmbeddingCb
    )
    diaryService = new DiaryService(
      shadowRepo,
      fileSyncService,
      shadowIndexSyncService,
      new VaultIndexServiceImpl()
    )
  }

  return {
    async searchFTS(query: string, limit?: number) {
      const results = await shadowRepo.searchFTS(query, limit)
      const allRecords = await shadowRepo.getAllRecords()
      const idToDateMap = new Map(allRecords.map((r) => [r.id, r.date]))
      return results.map((r) => ({
        date: idToDateMap.get(r.rowid) || '',
        contentSnippet: r.contentSnippet,
        tags: r.tags,
        rankScore: r.rankScore
      }))
    },
    async listInDateRange(startDate: string, endDate: string) {
      const rows = await shadowRepo.findByDateRange(startDate, endDate)
      return rows.map((row) => ({
        date: row.date,
        preview: diaryPreviewFromRaw((row as { rawContent?: string | null }).rawContent)
      }))
    },
    async readByDates(dates: string[]) {
      if (!diaryService) return dates.map((date) => ({ date, content: null }))
      const rows: Array<{ date: string; content: string | null }> = []
      for (const date of dates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          rows.push({ date, content: null })
          continue
        }
        const diary = await diaryService.findByDate(parseDateStr(date))
        rows.push({ date, content: diary?.content ?? null })
      }
      return rows
    },
    async writeEntry(date: string, content: string) {
      if (!diaryService) {
        return { ok: false as const, message: 'Error: Diary service not available.' }
      }
      try {
        await diaryService.create({
          date: parseDateStr(date),
          ...prepareDiarySearcherWrite(content)
        })
        return { ok: true as const }
      } catch (e) {
        if (e instanceof Error && e.name === 'DiaryDateConflictError') {
          return {
            ok: false as const,
            message: `Error: A diary entry for ${date} already exists. Use diary_edit to modify it.`
          }
        }
        return {
          ok: false as const,
          message: `Error: Failed to create diary entry: ${e instanceof Error ? e.message : String(e)}`
        }
      }
    },
    async editEntry({ date, content, mode }) {
      if (!diaryService) {
        return { ok: false as const, message: 'Error: Diary service not available.' }
      }
      try {
        const existing = await diaryService.findByDate(parseDateStr(date))
        if (!existing?.id) {
          return {
            ok: false as const,
            message: `Error: Diary entry for ${date} does not exist. Use diary_write to create it instead.`
          }
        }
        await diaryService.update(
          existing.id,
          prepareDiarySearcherEdit(existing.content, content, mode)
        )
        return { ok: true as const }
      } catch (e) {
        return {
          ok: false as const,
          message: `Error: Failed to edit diary: ${e instanceof Error ? e.message : String(e)}`
        }
      }
    },
    async deleteEntry(date: string) {
      if (!diaryService) {
        return { ok: false as const, message: 'Error: Diary service not available.' }
      }
      try {
        const existing = await diaryService.findByDate(parseDateStr(date))
        if (!existing?.id) {
          return {
            ok: false as const,
            message: `Error: Could not find diary entry for ${date} to delete.`
          }
        }
        await diaryService.delete(existing.id)
        return { ok: true as const }
      } catch (e) {
        return {
          ok: false as const,
          message: `Error: Failed to delete diary: ${e instanceof Error ? e.message : String(e)}`
        }
      }
    }
  }
}

