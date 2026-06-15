import { ipcMain } from 'electron'
import {
  SummaryRepositoryImpl,
  connectionManager,
  shadowConnectionManager
} from '@baishou/database-desktop'
import {
  SummaryManagerService,
  SummarySyncService,
  SummaryFileService,
  MissingSummaryDetector,
  SummaryGeneratorService,
  handleBuildSharedContext
} from '@baishou/core-desktop'
import { settingsManager } from './settings.ipc'
import {
  logger,
  parseDateStr,
  formatLocalDate,
  resolveSummaryTemplatesForGeneration
} from '@baishou/shared'
import { SummaryQueueService } from '../services/summary-queue.service'
import { pathService, vaultService, getActiveVaultShadowRepo } from './vault.ipc'
import { fileSystem } from '../services/node-file-system'
import { CreateSummaryInput, UpdateSummaryInput, SummaryType } from '@baishou/shared'
import { summariesTable } from '@baishou/database-desktop'
import { sql } from 'drizzle-orm'
import { buildSummaryAiClient } from './summary-ai-client'

export function getSummaryManager() {
  const db = connectionManager.getDb()
  const summaryRepo = new SummaryRepositoryImpl(db)
  const fileSync = new SummaryFileService(pathService, fileSystem)
  const summarySync = new SummarySyncService(null, null, summaryRepo, fileSync)
  return new SummaryManagerService(summaryRepo, fileSync, summarySync)
}

let _cachedManager: SummaryManagerService | null = null

function ensureManager(): SummaryManagerService {
  if (!_cachedManager) _cachedManager = getSummaryManager()
  return _cachedManager
}

/**
 * 在 ZIP 恢复等场景下，DB 连接已被重建，必须使缓存的 Manager 失效
 * 否则其持有的 Repository 仍引用旧的（已断开）DB 实例
 */
export function resetCachedManager(): void {
  _cachedManager = null
  _queueInitialized = false
}

let _queueInitialized = false

function ensureQueueReady(): void {
  if (_queueInitialized) return
  const queueService = SummaryQueueService.getInstance()
  queueService.setDependencies(ensureManager(), async () => {
    const db = connectionManager.getDb()
    const summaryRepo = new SummaryRepositoryImpl(db)
    const shadowRepo = getActiveVaultShadowRepo()

    const diaryRepoAdapter = {
      async findByDateRange(start: Date, end: Date) {
        const startIso = formatLocalDate(start)
        const endIso = formatLocalDate(end)
        const records = await shadowRepo.findByDateRange(startIso, endIso)
        return records.map((r: any) => {
          const diaryDate = parseDateStr(r.date)
          return {
            id: r.id.toString(),
            title: r.title,
            date: diaryDate,
            content: r.rawContent ?? r.content ?? '',
            tags: r.tags || '',
            createdAt: r.createdAt ? new Date(r.createdAt) : diaryDate,
            updatedAt: r.updatedAt ? new Date(r.updatedAt) : diaryDate
          }
        })
      }
    } as any

    const summaryConfig = await settingsManager.get<any>('summary_config')
    const customTemplates = resolveSummaryTemplatesForGeneration(summaryConfig)
    const promptLocale = summaryConfig?.promptLocale ?? 'zh'

    return new SummaryGeneratorService(
      diaryRepoAdapter,
      summaryRepo,
      buildSummaryAiClient(),
      customTemplates as Record<string, string>,
      promptLocale
    )
  })
  _queueInitialized = true
}

export function registerSummaryIPC() {
  ipcMain.handle('summary:save', async (_, input: CreateSummaryInput) => {
    return await ensureManager().save(input)
  })

  ipcMain.handle(
    'summary:update',
    async (
      _,
      id: number,
      type: SummaryType,
      startDate: Date,
      endDate: Date,
      update: UpdateSummaryInput
    ) => {
      return await ensureManager().update(id, type, new Date(startDate), new Date(endDate), update)
    }
  )

  ipcMain.handle('summary:delete', async (_, type: SummaryType, startDate: Date, endDate: Date) => {
    return await ensureManager().delete(type, new Date(startDate), new Date(endDate))
  })

  ipcMain.handle(
    'summary:readDetail',
    async (_, type: SummaryType, startDate: Date, endDate: Date) => {
      return await ensureManager().readDetail(type, new Date(startDate), new Date(endDate))
    }
  )

  ipcMain.handle('summary:list', async (_, options?: { start?: Date }) => {
    try {
      const parsedOptions = options?.start ? { start: new Date(options.start) } : undefined
      return await ensureManager().list(parsedOptions)
    } catch (e: any) {
      logger.warn('[SummaryIPC] list error (likely table missing):', e)
      return []
    }
  })

  ipcMain.handle('summary:stats', async () => {
    try {
      let totalDiaryCount = 0
      try {
        const client = shadowConnectionManager.getClient()
        const activeVault = vaultService.getActiveVault()
        const vaultName = activeVault?.name ?? ''
        const result = vaultName
          ? await client.execute('SELECT COUNT(*) as c FROM journals_index WHERE vault_name = ?', [
              vaultName
            ])
          : await client.execute('SELECT COUNT(*) as c FROM journals_index')
        totalDiaryCount = (result.rows[0]?.c as number) || 0
      } catch (e: any) {
        logger.error('Failed to get shadow_index count', e)
      }
      const db = connectionManager.getDb()
      const typeCounts = await db
        .select({
          type: summariesTable.type,
          count: sql<number>`count(*)`.mapWith(Number)
        })
        .from(summariesTable)
        .groupBy(summariesTable.type)

      const countByType = Object.fromEntries(typeCounts.map((row) => [row.type, row.count]))
      return {
        totalDiaryCount,
        weeklyCount: countByType.weekly ?? 0,
        monthlyCount: countByType.monthly ?? 0,
        quarterlyCount: countByType.quarterly ?? 0,
        yearlyCount: countByType.yearly ?? 0
      }
    } catch (err: any) {
      logger.error('Failed to calculate summary stats:', err)
      return {
        totalDiaryCount: 0,
        weeklyCount: 0,
        monthlyCount: 0,
        quarterlyCount: 0,
        yearlyCount: 0
      }
    }
  })

  ipcMain.handle('summary:detect-missing', async (_, locale: string = 'zh') => {
    try {
      const db = connectionManager.getDb()
      if (!shadowConnectionManager.isConnected()) return []

      const shadowRepo = getActiveVaultShadowRepo()
      const summaryRepo = new SummaryRepositoryImpl(db)

      const diaryRepoAdapter = {
        async list() {
          const records = await shadowRepo.listAll()
          logger.info('[DEBUG-IPC] shadowRepo.listAll count:', records.length)
          if (records.length > 0) {
            logger.info('[DEBUG-IPC] Sample record date field:', {
              date: records[0].date,
              type: typeof records[0].date
            })
          }
          return records.map((r: any) => {
            const diaryDate = parseDateStr(r.date)
            return {
              id: r.id.toString(),
              title: r.title,
              date: diaryDate,
              content: r.rawContent ?? r.content ?? '',
              tags: r.tags || '',
              createdAt: r.createdAt ? new Date(r.createdAt) : diaryDate,
              updatedAt: r.updatedAt ? new Date(r.updatedAt) : diaryDate,
              path: r.filePath || r.path || ''
            }
          })
        }
      } as any

      const detector = new MissingSummaryDetector(diaryRepoAdapter, summaryRepo)
      return await detector.getAllMissing(locale)
    } catch (err: any) {
      logger.error('[SummaryIPC] detect-missing error:', err)
      return []
    }
  })

  ipcMain.handle('summary:queue-generation', async (_, items: any[], concurrency?: number) => {
    ensureQueueReady()
    SummaryQueueService.getInstance().enqueue(items, concurrency)
    return true
  })

  ipcMain.handle('summary:set-concurrency', async (_, limit: number) => {
    ensureQueueReady()
    SummaryQueueService.getInstance().setConcurrencyLimit(limit)
    return true
  })

  ipcMain.handle('summary:get-queue-state', async () => {
    ensureQueueReady()
    return SummaryQueueService.getInstance().getQueueState()
  })

  ipcMain.handle('summary:stop-generation', async () => {
    ensureQueueReady()
    SummaryQueueService.getInstance().stop()
    return true
  })

  ipcMain.handle(
    'summary:buildSharedContext',
    async (_, lookbackMonths: number, locale?: string) => {
      const summaries = await ensureManager().list()
      return handleBuildSharedContext(
        summaries,
        lookbackMonths,
        locale,
        vaultService.getActiveVault()?.name
      )
    }
  )
}
