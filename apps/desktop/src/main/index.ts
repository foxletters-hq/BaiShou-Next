import i18n from 'i18next'
import './app-identity'
import { DESKTOP_APP_ID, DESKTOP_DEV_APP_ID, isDesktopDevBuild } from './app-identity'
import { app, shell, BrowserWindow, ipcMain, Menu, protocol, net } from 'electron'
import { join } from 'path'
import { open, stat } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import { Readable } from 'node:stream'
import {
  localFileContentType,
  localProtocolEmojiRelativePath,
  localProtocolFileResponseHeaders,
  localProtocolUrlToFilePath,
  parseByteRangeHeader
} from './local-protocol.util'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerAgentIPC } from './ipc/agent.ipc'
import { registerDugiteGitBinary } from '@baishou/core-desktop'

registerDugiteGitBinary()
import { registerSettingsIPC } from './ipc/settings.ipc'
import { initVaultSystem, registerVaultIPC } from './ipc/vault.ipc'
import { registerArchiveIPC } from './ipc/archive.ipc'
import { registerLanIPC } from './ipc/lan.ipc'
import { registerCloudSyncIPC } from './ipc/cloud-sync.ipc'
import { registerGitSyncIPC } from './ipc/git-sync.ipc'
import { registerIncrementalSyncIPC } from './ipc/incremental-sync.ipc'
import { registerLegacyMigrationIPC } from './ipc/legacy-migration.ipc'
import { registerDiaryIPC } from './ipc/diary.ipc'
import { registerProfileIPC } from './ipc/profile.ipc'
import { registerSummaryIPC } from './ipc/summary.ipc'
import { registerStorageIPC } from './ipc/storage.ipc'
import { registerAttachmentIPC } from './ipc/attachment.ipc'
import { registerDiaryAttachmentIPC } from './ipc/diary-attachment.ipc'
import { registerRagIPC } from './ipc/rag.ipc'
import { registerOnboardingIPC } from './ipc/onboarding.ipc'
import { registerDeveloperIPC } from './ipc/developer.ipc'
import { registerEmojiIPC } from './ipc/emoji.ipc'
import { registerCompressionEventBridge } from './services/compression-event.service'
import { registerSearchIPC } from './ipc/search.ipc'
import { registerGraphIPC } from './ipc/graph.ipc'
import { registerKnowledgeIPC } from './ipc/knowledge.ipc'
import { registerUpdaterIPC } from './ipc/updater.ipc'
import { registerShellIPC } from './ipc/shell.ipc'
import { registerSkillIPC } from './ipc/skill.ipc'
import {
  installDatabaseSchema,
  SettingsRepository,
  connectionManager
} from '@baishou/database-desktop'
import { getAppDb } from './db'
import { HotkeyService } from './services/hotkey.service'
import { setHotkeyService } from './ipc/settings.ipc'
import {
  logger,
  nextUiFontSizeLevel,
  resolvePageZoomShortcut,
  uiFontSizeLevelFromZoom,
  uiPageZoomFromLevel
} from '@baishou/shared'
import { markStartup, traceStartupStep } from './startup-trace.util'

markStartup('main.module.loaded')

if (is.dev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9333')
  app.commandLine.appendSwitch('js-flags', '--expose-gc')
}

// 必须在 app ready 之前注册，否则渲染进程 fetch('local://...') 会直接 Failed to fetch
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

function applyLocalProtocolCors(headers: Headers): Headers {
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', '*')
  headers.set(
    'Access-Control-Expose-Headers',
    'Accept-Ranges, Content-Range, Content-Length, Content-Type'
  )
  return headers
}

function localProtocolResponse(body: BodyInit | null, init?: ResponseInit): Response {
  const headers = applyLocalProtocolCors(new Headers(init?.headers))
  return new Response(body, { ...init, headers })
}

async function serveLocalPhysicalFile(request: Request, physicalPath: string): Promise<Response> {
  const contentType = localFileContentType(physicalPath)
  const fileStat = await stat(physicalPath)
  const size = fileStat.size
  if (request.method === 'HEAD') {
    const meta = localProtocolFileResponseHeaders({ contentType, size })
    return localProtocolResponse(null, { status: meta.status, headers: meta.headers })
  }
  const rangeResult = parseByteRangeHeader(request.headers.get('Range'), size)
  if (rangeResult === 'unsatisfiable') {
    return localProtocolResponse(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${size}`,
        'Accept-Ranges': 'bytes'
      }
    })
  }
  if (rangeResult) {
    const meta = localProtocolFileResponseHeaders({ contentType, size, range: rangeResult })
    const length = rangeResult.end - rangeResult.start + 1
    const handle = await open(physicalPath, 'r')
    try {
      const buf = Buffer.allocUnsafe(length)
      const { bytesRead } = await handle.read(buf, 0, length, rangeResult.start)
      const body = bytesRead === length ? buf : buf.subarray(0, bytesRead)
      return localProtocolResponse(body, { status: meta.status, headers: meta.headers })
    } finally {
      await handle.close()
    }
  }
  const meta = localProtocolFileResponseHeaders({ contentType, size })
  if (size === 0) {
    return localProtocolResponse(new Uint8Array(), { status: 200, headers: meta.headers })
  }
  return localProtocolResponse(Readable.toWeb(createReadStream(physicalPath)) as ReadableStream, {
    status: 200,
    headers: meta.headers
  })
}

let mainWindow: BrowserWindow | null = null
let isBootstrapping = false

function createWindow(needsOnboarding: boolean): void {
  const isWin = process.platform === 'win32'
  const isMac = process.platform === 'darwin'

  /**
   * Win11：勿开 transparent。transparent 会关掉系统圆角，Acrylic 仍按直角矩形铺满，
   * CSS border-radius / clip-path 裁不到系统材质层，看起来永远是直角。
   * 正确做法：Acrylic + roundedCorners，HTML 外圈半透露出磨砂。
   */
  mainWindow = new BrowserWindow({
    width: needsOnboarding ? 860 : 1000,
    height: needsOnboarding ? 580 : 680,
    minWidth: 860,
    minHeight: 520,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    hasShadow: true,
    icon,
    ...(isWin
      ? {
          // 勿设 transparent / 带 alpha 的 backgroundColor：会关掉系统圆角或盖住 Acrylic
          transparent: false,
          roundedCorners: true,
          backgroundMaterial: 'acrylic' as const
        }
      : isMac
        ? {
            transparent: true,
            vibrancy: 'under-window' as const,
            visualEffectState: 'active' as const,
            backgroundColor: '#00000000'
          }
        : {
            transparent: false,
            backgroundColor: '#fafafa'
          }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (isWin) {
    try {
      mainWindow.setBackgroundMaterial('acrylic')
    } catch {
      /* Win10 等无 Acrylic：靠 CSS --bg-window-shell / --bg-app */
    }
  }

  mainWindow.on('ready-to-show', () => {
    markStartup('window.ready-to-show')
    mainWindow!.show()
    markStartup('window.show')
  })

  mainWindow.webContents.on('did-start-loading', () => {
    markStartup('window.did-start-loading')
  })

  mainWindow.webContents.on('dom-ready', () => {
    markStartup('window.dom-ready')
  })

  mainWindow.webContents.on('did-finish-load', () => {
    markStartup('window.did-finish-load', {
      url: mainWindow?.webContents.getURL()
    })
  })

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      markStartup('window.did-fail-load', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame
      })
    }
  )

  mainWindow.webContents.on('context-menu', (event, properties) => {
    const { isEditable, selectionText, editFlags } = properties
    const hasText = selectionText.trim().length > 0

    // contenteditable（表格单元格、CodeMirror 正文）由渲染进程自定义菜单处理
    if (isEditable) {
      event.preventDefault()
      return
    }

    if (hasText) {
      const template: Electron.MenuItemConstructorOptions[] = [
        {
          id: 'copy',
          label: i18n.t('auto.apps.desktop.src.main.index.L89', '复制'),
          role: 'copy',
          enabled: editFlags.canCopy,
          visible: true
        }
      ]

      const filtered = template.filter((item) => item.visible !== false)
      if (filtered.length > 0) {
        const menu = Menu.buildFromTemplate(filtered)
        menu.popup()
      }
    }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!input.control && !input.meta) return
    if (input.type !== 'keyDown') return
    const action = resolvePageZoomShortcut(input)
    if (!action) return
    event.preventDefault()
    const current = uiFontSizeLevelFromZoom(mainWindow!.webContents.getZoomFactor())
    const next = nextUiFontSizeLevel(current, action)
    mainWindow!.webContents.setZoomFactor(uiPageZoomFromLevel(next))
    mainWindow!.webContents.send('zoom:set-level', next)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  const baseUrl =
    is.dev && process.env['ELECTRON_RENDERER_URL']
      ? process.env['ELECTRON_RENDERER_URL']
      : join(__dirname, '../renderer/index.html')

  markStartup('window.load.begin', {
    needsOnboarding,
    baseUrl: typeof baseUrl === 'string' ? baseUrl : String(baseUrl)
  })
  if (needsOnboarding) {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      void mainWindow.loadURL(`${baseUrl}#/welcome`)
    } else {
      void mainWindow.loadFile(baseUrl, { hash: '/welcome' })
    }
  } else {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      void mainWindow.loadURL(baseUrl)
    } else {
      void mainWindow.loadFile(baseUrl)
    }
  }
  markStartup('window.load.called')
}

/**
 * 核心初始化阶段：在确定存储路径后（或非首次启动）执行
 */
async function completeFullBootstrap() {
  if (isBootstrapping) return
  isBootstrapping = true

  try {
    await traceStartupStep('completeFullBootstrap', async () => {
      // 1. 初始化 Vault 系统 (此时 path.service 已经可以读到正确的 rootPath)
      await traceStartupStep('initVaultSystem', () => initVaultSystem())

      const { initDesktopMainCacheCoordinator } =
        await import('./cache/desktop-main-cache-coordinator')
      initDesktopMainCacheCoordinator()

      // 2. 业务级 IPC 已在 app.whenReady 中提前注册，此处无需重复
      // (冷启动全量扫盘已延后到渲染进程首屏后再 schedule)

      // 3. 这里的逻辑在引导完成后或者已有配置时执行
      if (mainWindow) {
        const settingsRepo = new SettingsRepository(getAppDb())
        const { settingsManager } = await import('./ipc/settings.ipc')
        const { purgeDeviceLocalSettingsFromAgentDb } =
          await import('./services/desktop-device-settings.util')
        await traceStartupStep('purgeDeviceLocalSettings', () =>
          purgeDeviceLocalSettingsFromAgentDb(settingsRepo, () => settingsManager.flushToDisk())
        )

        const { migrateDesktopHotkeyConfigFromSharedSettings, desktopHotkeyConfigStore } =
          await import('./services/desktop-hotkey-config.store')
        await traceStartupStep('migrateHotkeyConfig', () =>
          migrateDesktopHotkeyConfigFromSharedSettings(settingsRepo, () =>
            settingsManager.flushToDisk()
          )
        )
        const hotkeyService = new HotkeyService(desktopHotkeyConfigStore, mainWindow)
        hotkeyService.start()
        setHotkeyService(hotkeyService)

        const { bootstrapMcpServer } = await import('./services/mcp-runtime')
        await traceStartupStep('bootstrapMcpServer', () => bootstrapMcpServer())

        // 通知渲染进程引导已就绪，可以跳转了
        mainWindow.webContents.send('onboarding:ready')
        markStartup('onboarding:ready sent')
      }
    })

    isBootstrapping = false
  } catch (err: any) {
    logger.error('Failed to complete bootstrap:', err)
    isBootstrapping = false
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  markStartup('app.whenReady')

  // 渲染进程 / preload 启动打点 → 主进程终端（与 [Startup] 同一时间轴）
  ipcMain.on(
    'startup:mark',
    (
      _event,
      payload: { step?: string; navMs?: number; detail?: Record<string, unknown> } | undefined
    ) => {
      const step = payload?.step || 'renderer.unknown'
      markStartup(step, {
        navMs: payload?.navMs,
        ...(payload?.detail ?? {})
      })
    }
  )

  // Inject Electron net.fetch to global scope to automatically bypass network isolation in custom components
  // like model-pricing.service that may be proxy-sensitive
  ;(global as any).customNetFetch = net.fetch

  // Windows 任务栏分组：开发端与稳定端使用不同 AppUserModelId，避免混为一组
  electronApp.setAppUserModelId(isDesktopDevBuild() ? DESKTOP_DEV_APP_ID : DESKTOP_APP_ID)

  // Register local protocol for secure local asset rendering
  protocol.handle('local', async (request) => {
    try {
      if (request.method === 'OPTIONS') {
        return localProtocolResponse(null, { status: 204 })
      }
      const emojiRel = localProtocolEmojiRelativePath(request.url)
      let physicalPath: string
      if (emojiRel) {
        const { DesktopStoragePathService } = await import('./services/path.service')
        const pathService = new DesktopStoragePathService()
        const emojisDir = await pathService.getEmojisDirectory()
        physicalPath = join(emojisDir, emojiRel)
      } else {
        physicalPath = localProtocolUrlToFilePath(request.url)
      }
      if (!existsSync(physicalPath)) {
        return localProtocolResponse('Not found', { status: 404 })
      }
      return serveLocalPhysicalFile(request, physicalPath)
    } catch (e) {
      // Squash annoying ERR_FILE_NOT_FOUND stack traces when UI loads dead db avatar paths
      return localProtocolResponse('Not found', { status: 404 })
    }
  })

  // 开发态：F12 开关 DevTools；生产态：屏蔽 Ctrl/Cmd+R 防误刷新
  // 见 https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  // 打包后也允许 F12，便于现场排查
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
    if (is.dev) return
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.code !== 'F12') return
      event.preventDefault()
      if (window.webContents.isDevToolsOpened()) {
        window.webContents.closeDevTools()
      } else {
        window.webContents.openDevTools({ mode: 'undocked' })
      }
    })
  })

  // IPC test
  ipcMain.on('ping', () => logger.info('pong'))

  // Window control IPC handlers
  ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })
  ipcMain.on('window:toggleMaximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.on('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  // 引导检查 + Flutter 旧版数据探测（迁移需用户确认）
  const settingsPath = join(app.getPath('userData'), 'baishou_settings.json')
  const { resolveDesktopStorageBootstrap } =
    await import('./services/desktop-legacy-bootstrap.service')
  const bootstrap = await traceStartupStep('resolveDesktopStorageBootstrap', () =>
    resolveDesktopStorageBootstrap(settingsPath)
  )
  const needsOnboarding = bootstrap.needsOnboarding
  const customStorageRoot = bootstrap.storageRoot

  if (bootstrap.pendingFlutterLegacyMigration) {
    logger.info(
      '[Bootstrapper] Pending Flutter legacy migration detected; waiting for user confirmation.'
    )
  }

  // ── 核心变更：在确定存储路径后，再初始化全局 Agent DB ──
  // connectionManager 提供全局访问句柄，供所有 Agent 相关 IPC 使用
  const appDb = await traceStartupStep(
    'agentDb.open',
    () => getAppDb(customStorageRoot || undefined),
    { root: customStorageRoot || null }
  )
  connectionManager.setDb(appDb)
  await traceStartupStep('agentDb.installSchema', () => installDatabaseSchema(appDb))

  // ======================================
  // 5. 自动升级探测已在 resolveDesktopStorageBootstrap 中完成
  // ======================================

  // 1. 注册引导 IPC
  registerOnboardingIPC(() => {
    completeFullBootstrap()
  })

  // 2. 注册设置 IPC (基础设置可能在引导中也需要)
  registerSettingsIPC()

  // 2.5 提前注册所有业务级 IPC，防止渲染进程在窗口创建后立刻调用时 handler 尚未注册
  await traceStartupStep('registerBusinessIpc', async () => {
    const { initDesktopSessionInboxStore } = await import('./services/session-inbox.store')
    await initDesktopSessionInboxStore()
    registerAgentIPC()
    registerCompressionEventBridge()
    const { registerSessionRuntimeEventBridge } =
      await import('./services/session-runtime-event.service')
    registerSessionRuntimeEventBridge()
    registerVaultIPC()
    registerArchiveIPC()
    registerLanIPC()
    registerCloudSyncIPC()
    registerGitSyncIPC()
    registerIncrementalSyncIPC()
    registerLegacyMigrationIPC()
    registerDiaryIPC()
    registerProfileIPC()
    registerSummaryIPC()
    registerStorageIPC()
    registerAttachmentIPC()
    registerDiaryAttachmentIPC()
    registerRagIPC()
    registerDeveloperIPC()
    registerEmojiIPC()
    registerSearchIPC()
    registerGraphIPC()
    registerKnowledgeIPC()
    registerUpdaterIPC()
    registerShellIPC()
    registerSkillIPC()
  })

  // 注册桌面 PDF 按页抽取器（知识库摄入）
  try {
    const { registerDesktopPdfPageExtractor } =
      await import('./services/register-desktop-pdf-extractor')
    registerDesktopPdfPageExtractor()
    const { registerDesktopPdfPageBitmapRenderer } =
      await import('./services/register-desktop-pdf-bitmap-renderer')
    registerDesktopPdfPageBitmapRenderer()
    const { registerDesktopVisionPageRecognizer } =
      await import('./services/register-desktop-vision-ocr')
    registerDesktopVisionPageRecognizer()
  } catch (e) {
    logger.warn('[Startup] registerDesktopPdfPageExtractor failed:', e as Error)
  }

  // 3. 确保创建 mainWindow，因为全量引导（如全局快捷键）依赖该实例结构
  markStartup('createWindow.call', { needsOnboarding })
  createWindow(needsOnboarding)

  // 4. 决定是否立即执行全量初始化
  if (!needsOnboarding) {
    await completeFullBootstrap()
  } else {
    markStartup('skip completeFullBootstrap (needsOnboarding)')
  }

  markStartup('whenReady handler finished', { needsOnboarding })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(needsOnboarding)
  })
})

app.on('will-quit', () => {
  const { globalShortcut } = require('electron')
  globalShortcut.unregisterAll()
  void import('./services/mcp-runtime').then(({ shutdownMcpServer }) => shutdownMcpServer())
  void import('./services/session-inbox.store').then(({ flushDesktopSessionInboxStore }) =>
    flushDesktopSessionInboxStore()
  )
  void import('./services/agent-workspace-session.store').then(({ flushWorkspaceSessionStore }) =>
    flushWorkspaceSessionStore()
  )
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
