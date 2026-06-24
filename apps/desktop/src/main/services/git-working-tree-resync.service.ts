import { BrowserWindow } from 'electron'
import { logger } from '@baishou/shared'

function extractJournalDate(filePath: string): string | null {
  const match = /(\d{4}-\d{2}-\d{2})\.md$/i.exec(filePath.replace(/\\/g, '/'))
  return match?.[1] ?? null
}

/**
 * Git 批量修改工作区时，Chokidar 可能漏报；显式将磁盘日记同步进影子索引并刷新 UI 缓存。
 */
export async function resyncAfterGitWorkingTreeMutation(
  reason: string,
  options?: { filePath?: string; scope?: 'targeted' | 'full' }
): Promise<void> {
  const scope = options?.scope ?? (options?.filePath ? 'targeted' : 'full')
  const dateStr = options?.filePath ? extractJournalDate(options.filePath) : null

  if (scope === 'targeted' && dateStr) {
    try {
      const { getShadowSync } = await import('../ipc/diary.ipc')
      const result = await getShadowSync().syncJournal(dateStr)
      if (result.isChanged) {
        const { emitDiaryWatcherMutation } = await import('../cache/domain-mutation-bridge')
        emitDiaryWatcherMutation(reason)
      }
      BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send('diary:sync-event', {
          type: 'git-working-tree-mutation',
          date: dateStr,
          result,
          forced: true
        })
      })
      logger.info(`[GitResync] Journal shadow sync complete (${reason}): ${dateStr}`)
      return
    } catch (error) {
      logger.warn(
        `[GitResync] Targeted journal sync failed (${reason}), falling back to full resync:`,
        { error }
      )
    }
  }

  const { scheduleVaultEcosystemResync } = await import('./vault-resync.service')
  void scheduleVaultEcosystemResync(reason)
  logger.info(`[GitResync] Scheduled vault ecosystem resync (${reason})`)
}
