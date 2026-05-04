import { BrowserWindow } from 'electron'
import { logger } from '@baishou/shared'

/**
 * 搜索服务 - 管理隐藏的 BrowserWindow 用于本地搜索
 */
export class SearchService {
  private static instance: SearchService | null = null
  private searchWindows: Map<string, BrowserWindow> = new Map()

  private constructor() {}

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService()
    }
    return SearchService.instance
  }

  /**
   * 创建新的搜索窗口
   */
  private async createSearchWindow(uid: string, show: boolean = false): Promise<BrowserWindow> {
    const newWindow = new BrowserWindow({
      width: 1280,
      height: 768,
      show,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    })

    this.searchWindows.set(uid, newWindow)
    newWindow.on('closed', () => {
      this.searchWindows.delete(uid)
    })

    // 设置 User-Agent 模拟真实浏览器
    newWindow.webContents.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    return newWindow
  }

  /**
   * 打开搜索窗口并加载 URL
   */
  public async openUrlInSearchWindow(uid: string, url: string): Promise<string> {
    let window = this.searchWindows.get(uid)
    logger.debug(`[SearchService] Searching with URL: ${url}`)

    if (window) {
      await window.loadURL(url)
    } else {
      window = await this.createSearchWindow(uid)
      await window.loadURL(url)
    }

    // 等待页面加载完成
    await new Promise<void>((resolve) => {
      const loadTimeout = setTimeout(() => resolve(), 15000) // 15秒超时
      window!.webContents.once('did-finish-load', () => {
        clearTimeout(loadTimeout)
        // 延迟确保 JavaScript 已执行
        setTimeout(resolve, 1000)
      })
    })

    // 获取页面 HTML 内容
    const html = await window.webContents.executeJavaScript('document.documentElement.outerHTML')
    return html
  }

  /**
   * 关闭搜索窗口
   */
  public async closeSearchWindow(uid: string): Promise<void> {
    const window = this.searchWindows.get(uid)
    if (window) {
      window.close()
      this.searchWindows.delete(uid)
    }
  }

  /**
   * 关闭所有搜索窗口
   */
  public async closeAllSearchWindows(): Promise<void> {
    for (const [, window] of this.searchWindows.entries()) {
      window.close()
    }
    this.searchWindows.clear()
  }
}

export const searchService = SearchService.getInstance()
