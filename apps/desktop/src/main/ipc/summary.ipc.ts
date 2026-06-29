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
import { buildSummaryAiClient } from './summary-ai-client'
import { getDiaryManager } from './diary.ipc'

async function fetchDashboardSnapshotPayload(): Promise<{
  totalDiaryCount: number
  weeklyCount: number
  monthlyCount: number
  quarterlyCount: number
  yearlyCount: number
  activityRows: Array<{ date: string; count: number }>
}> {
  const [diaryCount, summaryCounts, activityRows] = await Promise.all([
    getDiaryManager().count(),
    ensureManager().countByType(),
    getActiveVaultShadowRepo().getActivityData()
  ])

  return {
    totalDiaryCount: diaryCount,
    weeklyCount: summaryCounts.weekly,
    monthlyCount: summaryCounts.monthly,
    quarterlyCount: summaryCounts.quarterly,
    yearlyCount: summaryCounts.yearly,
    activityRows
  }
}

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

/**
 * 工作区切换 / 冷启动后：失效 Manager 并将 SQLite 总结缓存与当前 Vault 的 Archives 对齐。
 * summaries 表是全局热缓存，须按 activeVaultName 清理上一工作区的 ghost 记录。
 */
export async function rebindSummaryCacheForActiveVault(): Promise<void> {
  resetCachedManager()

  const activeVault = vaultService.getActiveVault()
  if (!activeVault) return

  const db = connectionManager.getDb()
  const summaryRepo = new SummaryRepositoryImpl(db)
  const fileSync = new SummaryFileService(pathService, fileSystem)
  const summarySync = new SummarySyncService(null, null, summaryRepo, fileSync)

  try {
    await summarySync.fullScanArchives({ activeVaultName: activeVault.name })
  } catch (err: unknown) {
    logger.warn('[SummaryIPC] fullScanArchives after vault rebind failed:', err as Error)
  }
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
      const snapshot = await fetchDashboardSnapshotPayload()
      return {
        totalDiaryCount: snapshot.totalDiaryCount,
        weeklyCount: snapshot.weeklyCount,
        monthlyCount: snapshot.monthlyCount,
        quarterlyCount: snapshot.quarterlyCount,
        yearlyCount: snapshot.yearlyCount
      }
    } catch (err: unknown) {
      logger.error('Failed to calculate summary stats:', err as any)
      return {
        totalDiaryCount: 0,
        weeklyCount: 0,
        monthlyCount: 0,
        quarterlyCount: 0,
        yearlyCount: 0
      }
    }
  })

  ipcMain.handle('summary:dashboard-snapshot', async () => {
    try {
      return await fetchDashboardSnapshotPayload()
    } catch (err: unknown) {
      logger.error('[SummaryIPC] dashboard-snapshot error:', err as any)
      return {
        totalDiaryCount: 0,
        weeklyCount: 0,
        monthlyCount: 0,
        quarterlyCount: 0,
        yearlyCount: 0,
        activityRows: [] as Array<{ date: string; count: number }>
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
          logger.debug('[DEBUG-IPC] shadowRepo.listAll count:', records.length)
          if (records.length > 0) {
            logger.debug('[DEBUG-IPC] Sample record date field:', {
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
