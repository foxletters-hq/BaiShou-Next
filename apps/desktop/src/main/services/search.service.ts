import { BrowserWindow, session } from 'electron'
import { logger } from '@baishou/shared'

/** 并行抓取，限制窗口数并强制静音 */
export const SEARCH_SCRAPE_MAX_PARALLEL = 4

const LOAD_TIMEOUT_MS = 15_000
const POST_LOAD_SETTLE_MS = 500

const DENIED_PERMISSIONS = new Set([
  'media',
  'mediaKeySystem',
  'fullscreen',
  'pointerLock',
  'openExternal',
  'serial',
  'hid',
  'bluetooth'
])

const PAUSE_MEDIA_SCRIPT = `
(() => {
  try {
    document.querySelectorAll('video, audio').forEach((el) => {
      el.muted = true
      el.volume = 0
      el.pause()
      el.autoplay = false
      el.removeAttribute('autoplay')
    })
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  } catch (_) {}
})()
`

type PoolSlot = {
  id: string
  window: BrowserWindow
  busy: boolean
}

/**
 * 并行隐藏窗口池：每个槽位独立 session + 全程静音，用于本地搜索引擎/网页抓取。
 * 每 URL 独立窗口并行抓取，并补上静音与并发上限。
 */
export class SearchService {
  private static instance: SearchService | null = null

  private readonly slots: PoolSlot[] = []
  private readonly waitQueue: Array<{
    resolve: (slot: PoolSlot) => void
    reject: (err: Error) => void
  }> = []
  private readonly activeByUid = new Map<string, PoolSlot>()

  private abortRequested = false
  private nextSlotId = 0
  /** 串行化槽位分配，避免并发 acquire 将同一 BrowserWindow 分给多个请求 */
  private acquireTail: Promise<unknown> = Promise.resolve()

  private constructor() {}

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService()
    }
    return SearchService.instance
  }

  public requestAbort(): void {
    this.abortRequested = true
    this.rejectWaiters(new Error('Search fetch aborted'))
    for (const [, slot] of this.activeByUid) {
      if (!slot.window.isDestroyed()) {
        try {
          slot.window.webContents.stop()
        } catch {
          /* ignore */
        }
      }
    }
  }

  private rejectWaiters(err: Error): void {
    while (this.waitQueue.length > 0) {
      this.waitQueue.shift()!.reject(err)
    }
  }

  private acquireSlot(): Promise<PoolSlot> {
    const next = this.acquireTail.then(
      () => this.doAcquireSlot(),
      () => this.doAcquireSlot()
    )
    this.acquireTail = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  private async doAcquireSlot(): Promise<PoolSlot> {
    const idle = this.slots.find((s) => !s.busy && !s.window.isDestroyed())
    if (idle) {
      idle.busy = true
      return idle
    }

    if (this.slots.length < SEARCH_SCRAPE_MAX_PARALLEL) {
      const slot = await this.createSlot()
      slot.busy = true
      return slot
    }

    return new Promise<PoolSlot>((resolve, reject) => {
      this.waitQueue.push({ resolve, reject })
    })
  }

  private releaseSlot(slot: PoolSlot): void {
    if (slot.window.isDestroyed()) {
      slot.busy = false
      const idx = this.slots.indexOf(slot)
      if (idx >= 0) this.slots.splice(idx, 1)
      return
    }

    void this.pauseMedia(slot.window)

    slot.busy = false
    const waiter = this.waitQueue.shift()
    if (waiter) {
      slot.busy = true
      waiter.resolve(slot)
    }
  }

  private configureScrapeSession(partition: string): Electron.Session {
    const ses = session.fromPartition(partition, { cache: true })

    const isPermissionAllowed = (permission: string) => !DENIED_PERMISSIONS.has(permission)

    ses.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(isPermissionAllowed(permission))
    })

    if (typeof ses.setPermissionCheckHandler === 'function') {
      ses.setPermissionCheckHandler((_webContents, permission) => isPermissionAllowed(permission))
    }

    return ses
  }

  private wireMediaGuards(win: BrowserWindow): void {
    const { webContents } = win
    webContents.audioMuted = true

    webContents.on('media-started-playing', () => {
      webContents.audioMuted = true
      void this.pauseMedia(win)
    })

    webContents.on('did-start-navigation', () => {
      webContents.audioMuted = true
    })

    webContents.on('dom-ready', () => {
      void this.pauseMedia(win)
    })
  }

  private async createSlot(): Promise<PoolSlot> {
    const id = `scrape-${++this.nextSlotId}`
    const partition = `baishou-search-${id}`
    const ses = this.configureScrapeSession(partition)

    const win = new BrowserWindow({
      width: 1280,
      height: 768,
      show: false,
      skipTaskbar: true,
      autoHideMenuBar: true,
      webPreferences: {
        session: ses,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        autoplayPolicy: 'document-user-activation-required',
        backgroundThrottling: true
      }
    })

    this.wireMediaGuards(win)

    win.webContents.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    win.on('closed', () => {
      const idx = this.slots.findIndex((s) => s.id === id)
      if (idx >= 0) this.slots.splice(idx, 1)
    })

    const slot: PoolSlot = { id, window: win, busy: false }
    this.slots.push(slot)
    return slot
  }

  private async pauseMedia(window: BrowserWindow): Promise<void> {
    if (window.isDestroyed()) return
    window.webContents.audioMuted = true
    try {
      await window.webContents.executeJavaScript(PAUSE_MEDIA_SCRIPT, true)
    } catch {
      /* 页面可能尚未就绪 */
    }
  }

  private async waitForPageReady(window: BrowserWindow): Promise<void> {
    if (this.abortRequested) {
      throw new Error('Search fetch aborted')
    }

    await new Promise<void>((resolve) => {
      const webContents = window.webContents
      let settled = false

      const finish = () => {
        if (settled) return
        settled = true
        clearTimeout(loadTimeout)
        webContents.removeListener('did-finish-load', onLoad)
        webContents.removeListener('did-fail-load', onFail)
        setTimeout(resolve, POST_LOAD_SETTLE_MS)
      }

      const onLoad = () => finish()
      const onFail = () => finish()
      const loadTimeout = setTimeout(() => finish(), LOAD_TIMEOUT_MS)

      if (!webContents.isLoading()) {
        finish()
        return
      }

      webContents.once('did-finish-load', onLoad)
      webContents.once('did-fail-load', onFail)
    })

    await this.pauseMedia(window)
  }

  /**
   * 在池化隐藏窗口中加载 URL 并返回 HTML（最多 {@link SEARCH_SCRAPE_MAX_PARALLEL} 路并行）。
   */
  public async openUrlInSearchWindow(uid: string, url: string): Promise<string> {
    if (this.abortRequested) {
      throw new Error('Search fetch aborted')
    }

    const slot = await this.acquireSlot()
    this.activeByUid.set(uid, slot)

    logger.debug(`[SearchService] Fetching (uid=${uid}, slot=${slot.id}): ${url}`)

    const { window } = slot
    try {
      window.webContents.audioMuted = true
      await window.loadURL(url)
      await this.waitForPageReady(window)
      await this.pauseMedia(window)

      if (this.abortRequested) {
        throw new Error('Search fetch aborted')
      }

      return await window.webContents.executeJavaScript('document.documentElement.outerHTML')
    } finally {
      this.activeByUid.delete(uid)
      this.releaseSlot(slot)
    }
  }

  /**
   * 中止并释放指定 uid 的抓取（兼容旧版 IPC）。
   */
  public async closeSearchWindow(uid: string): Promise<void> {
    const slot = this.activeByUid.get(uid)
    if (!slot || slot.window.isDestroyed()) {
      this.activeByUid.delete(uid)
      return
    }

    try {
      slot.window.webContents.stop()
    } catch {
      /* ignore */
    }

    this.activeByUid.delete(uid)
    this.releaseSlot(slot)
  }

  /**
   * 销毁全部抓取窗口（停止对话时调用）。
   */
  public async closeAllSearchWindows(): Promise<void> {
    this.abortRequested = true
    this.rejectWaiters(new Error('Search fetch aborted'))
    this.activeByUid.clear()

    const toClose = [...this.slots]
    this.slots.length = 0

    for (const slot of toClose) {
      if (!slot.window.isDestroyed()) {
        await this.pauseMedia(slot.window)
        slot.window.close()
      }
    }

    this.abortRequested = false
  }
}

export const searchService = SearchService.getInstance()
