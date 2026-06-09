import { ipcMain } from 'electron'
import { searchService } from '../services/search.service'
import { logger } from '@baishou/shared'
import { createWebSearchResultFetcher } from './agent-helpers'

const webSearchResultFetcher = createWebSearchResultFetcher()

/**
 * 注册搜索相关的 IPC 接口
 */
export function registerSearchIPC() {
  // 打开搜索窗口并获取页面内容
  ipcMain.handle('search:open-url', async (_event, uid: string, url: string) => {
    try {
      return await searchService.openUrlInSearchWindow(uid, url)
    } catch (e: any) {
      logger.error('[SearchIPC] Failed to open URL:', e)
      throw e
    }
  })

  // 关闭搜索窗口
  ipcMain.handle('search:close-window', async (_event, uid: string) => {
    try {
      await searchService.closeSearchWindow(uid)
    } catch (e: any) {
      logger.error('[SearchIPC] Failed to close window:', e)
    }
  })

  // 获取网页内容（与 Agent webSearchResultFetcher 共用实现）
  ipcMain.handle('search:fetch-content', async (_event, url: string) => {
    try {
      return await webSearchResultFetcher(url)
    } catch (e: any) {
      logger.debug('[SearchIPC] Web fetch skipped:', e)
      return `Failed to read URL: ${e?.message || String(e)}`
    }
  })

  logger.info('[SearchIPC] Search IPC registered')
}
