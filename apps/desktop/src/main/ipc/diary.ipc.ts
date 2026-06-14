import { ipcMain, dialog, BrowserWindow } from 'electron'
import {
  DiaryService,
  DiaryExportServiceImpl,
  FileSyncServiceImpl,
  ShadowIndexSyncService,
  VaultIndexServiceImpl,
  IEmbeddingCallback
} from '@baishou/core-desktop'
import {
  diaryDateToSourceCreatedSeconds,
  parseDateStr,
  markRagDiaryEmbedFailure,
  clearRagDiaryEmbedFailure,
  hasRagDiaryEmbedFailure
} from '@baishou/shared'
import * as fs from 'fs/promises'

import { fileSystem, pathService, vaultService, getActiveVaultShadowRepo } from './vault.ipc'
import { CreateDiaryInput, UpdateDiaryInput, DiaryListFilter } from '@baishou/shared'

function broadcastDiaryEmbedFailed(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('diary:sync-event', { type: 'embed-failed' })
  }
}

async function persistDiaryEmbedFailure(): Promise<void> {
  const { settingsManager } = await import('./settings.ipc')
  const ragConfig = (await settingsManager.get<any>('rag_config')) || {}
  await settingsManager.set('rag_config', markRagDiaryEmbedFailure(ragConfig))
  broadcastDiaryEmbedFailed()
}

async function clearDiaryEmbedFailureIfSet(): Promise<void> {
  const { settingsManager } = await import('./settings.ipc')
  const ragConfig = (await settingsManager.get<any>('rag_config')) || {}
  if (!hasRagDiaryEmbedFailure(ragConfig)) return
  await settingsManager.set('rag_config', clearRagDiaryEmbedFailure(ragConfig))
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('diary:sync-event', { type: 'embed-failure-cleared' })
  }
}

const embeddingCallback: IEmbeddingCallback = {
  async reEmbedDiary(params) {
    try {
      const { settingsManager } = await import('./settings.ipc')
      const ragConfig = (await settingsManager.get<any>('rag_config')) || {}
      const ragEnabled = ragConfig.ragEnabled ?? true

      const { getEmbeddingService } = await import('./rag.ipc')
      const embeddingService = getEmbeddingService()

      if (!ragEnabled || !embeddingService.isConfigured) {
        return
      }

      const d = new Date(params.date)
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const tagPrefix = params.tags.length > 0 ? `[标签: ${params.tags.join(', ')}] ` : ''

      await embeddingService.reEmbedText({
        text: params.content,
        sourceType: 'diary',
        sourceId: params.diaryId.toString(),
        groupId: 'diary_auto',
        chunkPrefix: `${tagPrefix}[${label} 日记:]\n`,
        metadataJson: JSON.stringify({ updated_at: params.updatedAt.getTime() }),
        sourceCreatedAt: diaryDateToSourceCreatedSeconds(d) * 1000
      })
      await clearDiaryEmbedFailureIfSet()
    } catch (e: any) {
      console.error('[DiaryIPC] RAG 嵌入发生异常:', e)
      await persistDiaryEmbedFailure()
    }
  },

  async deleteEmbeddingsBySource(sourceType, sourceId) {
    try {
      const { DesktopEmbeddingStorage } = await import('./rag.storage')
      const storage = new DesktopEmbeddingStorage()
      await storage.deleteEmbeddingsBySource(sourceType, sourceId)
    } catch (e: any) {
      console.error('[DiaryIPC] RAG 清理发生异常:', e)
    }
  }
}

/**
 * 日记管理服务工厂
 *
 * 重要架构变更（双库分离）：
 * - 日记影子索引现在从 shadowConnectionManager.getDb() 获取（shadow_index.db）
 * - 不再使用主 Agent DB（connectionManager.getDb()）
 * - 每次 IPC 调用时都从 shadowConnectionManager 取最新连接，保证 Vault 切换后的自动跟随
 */
export function getDiaryManager() {
  const shadowRepo = getActiveVaultShadowRepo()
  const fileSync = new FileSyncServiceImpl(pathService, fileSystem)
  const shadowSync = new ShadowIndexSyncService(
    shadowRepo,
    pathService,
    vaultService,
    fileSystem,
    embeddingCallback
  )
  const vaultIndex = new VaultIndexServiceImpl()

  return new DiaryService(shadowRepo, fileSync, shadowSync, vaultIndex)
}

export function getShadowSync() {
  const shadowRepo = getActiveVaultShadowRepo()
  return new ShadowIndexSyncService(
    shadowRepo,
    pathService,
    vaultService,
    fileSystem,
    embeddingCallback
  )
}

/**
 * 统一的日期字符串解析工具
 *
 * IPC 层收到的 date 可能是：
 *   - YYYY-MM-DD（推荐，直接由前端 formatLocalDate 生成）
 *   - YYYY-MM-DDTHH:mm:ss.sssZ（历史兼容，取 T 前的日期部分再 parseDateStr）
 *   - 已是 Date 对象（无需转换）
 *
 * 统一用 parseDateStr 确保本地时区解析，杜绝 new Date('YYYY-MM-DD') 的 UTC 陷阱。
 */
function parseInputDate(raw: string | Date | undefined): Date | undefined {
  if (!raw) return undefined
  if (raw instanceof Date) return raw
  // 截取 YYYY-MM-DD 部分（兼容带时间戳的历史格式）
  const datePart = String(raw).split('T')[0]!
  return parseDateStr(datePart)
}

export function registerDiaryIPC() {
  ipcMain.handle('diary:create', async (_, input: CreateDiaryInput) => {
    if (input.date) input.date = parseInputDate(String(input.date)) as Date
    return await getDiaryManager().create(input)
  })

  ipcMain.handle('diary:update', async (_, id: number, input: UpdateDiaryInput) => {
    if (input.date) input.date = parseInputDate(String(input.date))
    return await getDiaryManager().update(id, input)
  })

  ipcMain.handle(
    'diary:save',
    async (event, id: number | null, input: CreateDiaryInput & { id?: number }) => {
      if (input.date) input.date = parseInputDate(String(input.date)) as Date
      const saved = await getDiaryManager().save(id, input)
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win && saved) {
        win.webContents.send('diary:sync-event', { type: 'saved', entry: saved })
      }
      return saved
    }
  )

  ipcMain.handle('diary:delete', async (_, id: number) => {
    return await getDiaryManager().delete(id)
  })

  ipcMain.handle('diary:findById', async (_, id: number) => {
    return await getDiaryManager().findById(id)
  })

  ipcMain.handle('diary:findByDate', async (_, dateStr: string) => {
    // dateStr 应为 YYYY-MM-DD 格式
    return await getDiaryManager().findByDate(parseDateStr(dateStr.split('T')[0]!))
  })

  ipcMain.handle('diary:listAll', async (_, options?: { limit?: number; offset?: number }) => {
    return await getDiaryManager().listAll(options)
  })

  ipcMain.handle('diary:listFiltered', async (_, filter?: DiaryListFilter) => {
    return await getDiaryManager().listFiltered(filter)
  })

  ipcMain.handle(
    'diary:countFiltered',
    async (_, filter?: Omit<DiaryListFilter, 'limit' | 'offset'>) => {
      return await getDiaryManager().countFiltered(filter)
    }
  )

  ipcMain.handle('diary:list', async (_, options?: { limit?: number; offset?: number }) => {
    return await getDiaryManager().listAll(options)
  })

  ipcMain.handle(
    'diary:search',
    async (_, query: string, options?: DiaryListFilter & { limit?: number; offset?: number }) => {
      return await getDiaryManager().search(query, options)
    }
  )

  ipcMain.handle('diary:count', async () => {
    return await getDiaryManager().count()
  })

  ipcMain.handle('diary:activityData', async (_, year?: number | null) => {
    const shadowRepo = getActiveVaultShadowRepo()
    return await shadowRepo.getActivityData(year ?? undefined)
  })

  ipcMain.handle(
    'diary:export',
    async (
      _,
      format: 'txt' | 'json' | 'md',
      dateRange?: { start: string; end: string },
      dialogTitle?: string
    ) => {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) return { success: false, error: 'No focused window' }

      const result = await dialog.showSaveDialog(win, {
        title: dialogTitle || 'Export Diary',
        defaultPath: `baishou-diary-export.${format}`,
        filters: [
          { name: format.toUpperCase(), extensions: [format] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Cancelled' }
      }

      try {
        const manager = getDiaryManager()
        const diaries = await manager.listAll()

        // 按日期范围过滤
        const filtered = dateRange
          ? diaries.filter((d) => {
              const date = d.date
              return date >= new Date(dateRange.start) && date <= new Date(dateRange.end)
            })
          : diaries

        const fullDiaries: any[] = []
        for (const meta of filtered) {
          const full = await manager.findById(meta.id)
          if (full) fullDiaries.push(full)
        }

        const exporter = new DiaryExportServiceImpl()
        const buffer = await exporter.export(fullDiaries, { format })
        await fs.writeFile(result.filePath, buffer)

        return { success: true, filePath: result.filePath }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[DiaryExport] error:', msg)
        return { success: false, error: msg }
      }
    }
  )
}
