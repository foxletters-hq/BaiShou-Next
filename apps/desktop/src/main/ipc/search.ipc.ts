import { ipcMain } from 'electron'
import { searchService } from '../services/search.service'
import { logger } from '@baishou/shared'

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

  // 获取网页内容（使用 webSearchResultFetcher）
  ipcMain.handle('search:fetch-content', async (_event, url: string) => {
    try {
      // 使用 net.fetch 获取网页内容
      const { net } = require('electron')
      const response = await net.fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} - ${response.statusText}`)
      }

      const html = await response.text()
      
      // 简单剥离 HTML
      let plainText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '\n')
      plainText = plainText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '\n')
      plainText = plainText.replace(/<[^>]+>/g, ' ')
      plainText = plainText.replace(/\s+/g, ' ').trim()

      // 防止过大撑爆上下文
      const LIMIT = 15000
      if (plainText.length > LIMIT) {
        plainText = plainText.substring(0, LIMIT) + '\n\n[Content truncated due to length limits...]'
      }

      return plainText || 'The webpage is empty or cannot be parsed textually.'
    } catch (e: any) {
      logger.error('[SearchIPC] Failed to fetch content:', e)
      return `Failed to read URL: ${e?.message || String(e)}`
    }
  })

  logger.info('[SearchIPC] Search IPC registered')
}
