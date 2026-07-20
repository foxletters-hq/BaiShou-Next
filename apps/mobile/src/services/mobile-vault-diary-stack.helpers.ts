import i18n from 'i18next'
import {
  DiaryService,
  FileSyncServiceImpl,
  ShadowIndexSyncService,
  VaultIndexServiceImpl,
  VaultService,
  type IFileSystem,
  type IStoragePathService,
  type SettingsManagerService
} from '@baishou/core-mobile'
import {
  ensureDiaryInlineTags,
  parseDateStr,
  prepareDiaryAppendContent,
  prepareDiaryWriteContent,
  resolveDiaryEditMode
} from '@baishou/shared'
import { ShadowIndexRepository, shadowConnectionManager } from '@baishou/database'
import { formatDiaryPreviewText, type DiaryTemplateConfig } from '@baishou/shared'
import { mergeDiaryTags } from '@baishou/ai'
import { createShadowDiaryRepoAdapter } from './shadow-diary-adapter'
import { getMobileDiaryEmbeddingCallback } from './mobile-diary-embedding.service'
import { ensureMobileRawDataRuntime } from './mobile-raw-data-source.runtime'
import { wireMobilePendingReextractHook } from './mobile-graph.service'
import type { VaultBoundDiaryStack, VaultDiarySearcher } from './mobile-vault-runtime.types'

function diaryPreviewFromRaw(raw: string | null | undefined): string {
  const cleaned = formatDiaryPreviewText(raw)
  const firstLine = cleaned
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('---'))
  if (!firstLine) return '(empty)'
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}...` : firstLine
}

export function createVaultBoundDiaryStack(deps: {
  pathService: IStoragePathService
  vaultService: VaultService
  fileSystem: IFileSystem
  settingsManager?: SettingsManagerService
}): VaultBoundDiaryStack {
  const activeVault = deps.vaultService.getActiveVault()
  if (!activeVault) {
    throw new Error(
      i18n.t(
        'auto.apps.mobile.src.services.mobile.vault.diary.stack.helpers.L42',
        '[VaultRuntime] 无活跃 Vault，无法创建日记栈'
      )
    )
  }
  const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), activeVault.name)
  const rawManager = ensureMobileRawDataRuntime({
    pathService: deps.pathService,
    fileSystem: deps.fileSystem
  }).manager
  const fileSyncService = new FileSyncServiceImpl(deps.pathService, deps.fileSystem, rawManager)
  const vaultIndexService = new VaultIndexServiceImpl()
  const shadowIndexSyncService = new ShadowIndexSyncService(
    shadowRepo,
    deps.pathService,
    deps.vaultService,
    deps.fileSystem,
    getMobileDiaryEmbeddingCallback()
  )
  wireMobilePendingReextractHook({
    vaultName: activeVault.name,
    shadowRepo,
    pathService: deps.pathService,
    fileSystem: deps.fileSystem,
    shadowSync: shadowIndexSyncService
  })
  try {
    const { wireMobilePendingReextractHook } =
      require('./mobile-graph.service') as typeof import('./mobile-graph.service')
    wireMobilePendingReextractHook({
      vaultName: activeVault.name,
      shadowRepo,
      pathService: deps.pathService,
      fileSystem: deps.fileSystem,
      shadowSync: shadowIndexSyncService
    })
  } catch {
    // optional until graph screen is used
  }
  const diaryService = new DiaryService(
    shadowRepo,
    fileSyncService,
    shadowIndexSyncService,
    vaultIndexService
  )
  const diaryRepoAdapter = createShadowDiaryRepoAdapter(shadowRepo)
  const diarySearcher: VaultDiarySearcher = {
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
    async writeEntry(date: string, content: string, tags?: string) {
      try {
        const templateConfig: DiaryTemplateConfig = deps.settingsManager
          ? (await deps.settingsManager.get<DiaryTemplateConfig>('diary_template_config')) || {}
          : {}
        const tagsStr = tags
          ?.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .join(',')
        const prepared = prepareDiaryWriteContent(content, templateConfig, new Date())
        // 标签只写正文 #标签，不写 frontmatter（由正文解析进索引）
        const finalContent = tagsStr ? ensureDiaryInlineTags(prepared, tagsStr) : prepared
        await diaryService.create({
          date: parseDateStr(date),
          content: finalContent
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
    async editEntry({ date, content, mode, tags }) {
      try {
        const existing = await diaryService.findByDate(parseDateStr(date))
        if (!existing?.id) {
          return {
            ok: false as const,
            message: `Error: Diary entry for ${date} does not exist. Use diary_write to create it instead.`
          }
        }

        let finalContent = content
        const editMode = resolveDiaryEditMode(mode)
        if (editMode === 'append') {
          const templateConfig: DiaryTemplateConfig = deps.settingsManager
            ? (await deps.settingsManager.get<DiaryTemplateConfig>('diary_template_config')) || {}
            : {}
          finalContent = prepareDiaryAppendContent(
            existing.content,
            content,
            templateConfig,
            new Date()
          )
        }

        const mergedTags = tags ? mergeDiaryTags(existing.tags, tags) : existing.tags
        // 标签只写正文 #标签；清空 metadata tags，避免再落 frontmatter
        if (mergedTags) {
          finalContent = ensureDiaryInlineTags(finalContent, mergedTags)
        }

        await diaryService.update(existing.id, {
          content: finalContent,
          tags: ''
        })
        return { ok: true as const }
      } catch (e) {
        return {
          ok: false as const,
          message: `Error: Failed to edit diary: ${e instanceof Error ? e.message : String(e)}`
        }
      }
    },
    async deleteEntry(date: string) {
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

  return {
    shadowRepo,
    shadowIndexSyncService,
    diaryService,
    diaryRepoAdapter,
    diarySearcher
  }
}
