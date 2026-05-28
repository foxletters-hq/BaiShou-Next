import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { SummaryType, logger } from '@baishou/shared'
import * as chokidar from 'chokidar'
import { SummarySyncService } from '@baishou/core-desktop'
import { SummaryFileService } from '@baishou/core-desktop'
import { SummaryRepositoryImpl, connectionManager } from '@baishou/database-desktop'
import { pathService } from '../ipc/vault.ipc'
import { fileSystem } from './node-file-system'

/**
 * 总结文件变动监听服务
 *
 * 监听 Summaries/ 和 Archives/（旧版兼容）目录下所有 .md 文件的增删改，
 * 自动触发 SummarySyncService 将文件变更同步到 DB 缓存表。
 */
export class SummaryWatcherService {
  private watcher: chokidar.FSWatcher | null = null
  private summariesPath: string | null = null
  private archivesPath: string | null = null
  private pendingPaths = new Set<string>()
  private isProcessing = false
  private globalDebounceTimer: NodeJS.Timeout | null = null
  private summarySync: SummarySyncService | null = null
  private summaryFileService: SummaryFileService | null = null
  /** 写入抑制表：path → 过期时间戳。防止 App 自身写入触发循环同步。 */
  private suppressedPaths = new Map<string, number>()

  public start(vaultPath: string) {
    this.stop()
    this.summariesPath = path.join(vaultPath, 'Archives')
    this.archivesPath = path.join(vaultPath, 'Summaries')

    // 确保 Archives 目录存在
    if (!fs.existsSync(this.summariesPath)) {
      try {
        fs.mkdirSync(this.summariesPath, { recursive: true })
      } catch (e: any) {
        logger.error(`[SummaryWatcher] 无法创建 Archives 目录:`, e)
      }
    }

    // 初始化依赖
    const db = connectionManager.getDb()
    const summaryRepo = new SummaryRepositoryImpl(db)
    this.summaryFileService = new SummaryFileService(pathService, fileSystem)
    this.summarySync = new SummarySyncService(null, null, summaryRepo, this.summaryFileService)

    // 收集需要监听的目录（Summaries + 可选的 Archives）
    const watchDirs: string[] = [this.summariesPath]
    if (fs.existsSync(this.archivesPath)) {
      watchDirs.push(this.archivesPath)
      logger.info(`[SummaryWatcher] 同时监听旧版 Archives 目录: ${this.archivesPath}`)
    }

    // 初始化 Chokidar 监听（递归监听子目录 Weekly/Monthly/...）
    this.watcher = chokidar.watch(watchDirs, {
      ignored: /(^|[\/\\])\../,
      ignoreInitial: true,
      disableGlobbing: true,
      depth: 1
    } as any)

    this.watcher.on('all', (eventName, fullPath) => {
      if (!fullPath.endsWith('.md')) return
      if (eventName === 'add' || eventName === 'change' || eventName === 'unlink') {
        this.scheduleSync(fullPath)
      }
    })

    logger.info(`[SummaryWatcher] 监听已启动: ${watchDirs.join(', ')}`)
  }

  public stop() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    if (this.globalDebounceTimer) clearTimeout(this.globalDebounceTimer)
    this.pendingPaths.clear()
    this.suppressedPaths.clear()
    this.isProcessing = false
    this.summariesPath = null
    this.archivesPath = null
    this.summarySync = null
    this.summaryFileService = null
    logger.info(`[SummaryWatcher] 监听已停止`)
  }

  /**
   * 抑制指定路径的 Watcher 事件（防止 App 自身写入触发循环同步）
   * 对标原版 FileStateScheduler.suppressPath()
   */
  public suppressPath(filePath: string, durationMs: number = 2000) {
    this.suppressedPaths.set(filePath, Date.now() + durationMs)
  }

  private isSuppressed(filePath: string): boolean {
    const expiry = this.suppressedPaths.get(filePath)
    if (!expiry) return false
    if (Date.now() > expiry) {
      this.suppressedPaths.delete(filePath)
      return false
    }
    return true
  }

  private scheduleSync(changedPath: string) {
    if (this.isSuppressed(changedPath)) return
    this.pendingPaths.add(changedPath)
    if (this.globalDebounceTimer) {
      clearTimeout(this.globalDebounceTimer)
    }
    this.globalDebounceTimer = setTimeout(async () => {
      await this.processQueue()
    }, 800)
  }

  private async processQueue() {
    if (this.isProcessing || !this.summarySync || !this.summaryFileService) return
    this.isProcessing = true

    try {
      while (this.pendingPaths.size > 0) {
        const pathsToProcess = Array.from(this.pendingPaths)
        this.pendingPaths.clear()

        for (const changedPath of pathsToProcess) {
          const parsed = this.parseSummaryPath(changedPath)
          if (!parsed) continue

          try {
            await this.summarySync.syncSummaryFile(parsed.type, parsed.startDate, parsed.endDate)
          } catch (e: any) {
            logger.error(`[SummaryWatcher] 同步失败: ${changedPath}`, e)
          }
        }
      }

      // 通知 UI 刷新
      const wins = BrowserWindow.getAllWindows()
      wins.forEach((w) => {
        w.webContents.send('summary:file-changed')
      })
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 从文件绝对路径解析出 SummaryType 和日期范围
   * 路径格式: <vault>/Archives/<Type>/<filename>.md 或 <vault>/Summaries/<Type>/<filename>.md
   */
  private parseSummaryPath(
    fullPath: string
  ): { type: SummaryType; startDate: Date; endDate: Date } | null {
    const dirName = path.basename(path.dirname(fullPath))
    const fileName = path.basename(fullPath) // 保留扩展名，因为 parseFileNameToDateRange 需要含扩展名（如 .md）

    // 从目录名推断 type
    const typeMap: Record<string, SummaryType> = {
      Weekly: SummaryType.weekly,
      Monthly: SummaryType.monthly,
      Quarterly: SummaryType.quarterly,
      Yearly: SummaryType.yearly
    }
    const type = typeMap[dirName]
    if (!type) return null

    if (!this.summaryFileService) return null
    const range = this.summaryFileService.parseFileNameToDateRange(type, fileName)
    if (!range) return null

    return {
      type,
      startDate: range.startDate,
      endDate: range.endDate
    }
  }
}

export const summaryWatcher = new SummaryWatcherService()
