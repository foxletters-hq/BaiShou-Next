import { app, shell, BrowserWindow, ipcMain, Menu, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL, fileURLToPath } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerAgentIPC } from './ipc/agent.ipc'
import { registerSettingsIPC } from './ipc/settings.ipc'
import { initVaultSystem, registerVaultIPC } from './ipc/vault.ipc'
import { registerArchiveIPC } from './ipc/archive.ipc'
import { registerLanIPC } from './ipc/lan.ipc'
import { registerCloudSyncIPC } from './ipc/cloud-sync.ipc'
import { registerDiaryIPC } from './ipc/diary.ipc'
import { registerProfileIPC } from './ipc/profile.ipc'
import { registerSummaryIPC } from './ipc/summary.ipc'
import { registerStorageIPC } from './ipc/storage.ipc'
import { registerAttachmentIPC } from './ipc/attachment.ipc'
import { registerDiaryAttachmentIPC } from './ipc/diary-attachment.ipc'
import { registerRagIPC } from './ipc/rag.ipc'
import { registerOnboardingIPC } from './ipc/onboarding.ipc'
import { registerDeveloperIPC } from './ipc/developer.ipc'
import { registerSearchIPC } from './ipc/search.ipc'
import { installDatabaseSchema, SettingsRepository, connectionManager } from '@baishou/database'
import { getAppDb } from './db'
import { HotkeyService } from './services/hotkey.service'
import { setHotkeyService } from './ipc/settings.ipc'
import { logger } from '@baishou/shared'
import * as fs from 'fs/promises'

let mainWindow: BrowserWindow | null = null;
let isBootstrapping = false;

function createWindow(needsOnboarding: boolean): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: needsOnboarding ? 860 : 1000,
    height: needsOnboarding ? 580 : 680,
    minWidth: 860,
    minHeight: 520,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.on('context-menu', (_event, properties) => {
    const { isEditable, selectionText, editFlags } = properties;
    const hasText = selectionText.trim().length > 0;

    if (isEditable || hasText) {
      const template: Electron.MenuItemConstructorOptions[] = [
        { id: 'copy', label: '复制', role: 'copy', enabled: editFlags.canCopy, visible: isEditable || hasText },
        { id: 'paste', label: '粘贴', role: 'paste', enabled: editFlags.canPaste, visible: isEditable },
        { id: 'cut', label: '剪切', role: 'cut', enabled: editFlags.canCut, visible: isEditable },
        { id: 'selectAll', label: '全选', role: 'selectAll', enabled: editFlags.canSelectAll, visible: isEditable }
      ];

      const filtered = template.filter(item => item.visible !== false);
      if (filtered.length > 0) {
        const menu = Menu.buildFromTemplate(filtered);
        menu.popup();
      }
    }
  });

  // ── 缩放快捷键：Ctrl+= 放大，Ctrl+- 缩小，Ctrl+0 重置 ──
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (!input.control && !input.meta) return;
    if (input.type !== 'keyDown') return;

    const win = BrowserWindow.fromWebContents(mainWindow!.webContents);
    if (!win) return;

    if (input.key === '=' || input.key === '+') {
      const current = mainWindow!.webContents.getZoomLevel();
      mainWindow!.webContents.setZoomLevel(Math.min(current + 0.5, 5));
    } else if (input.key === '-') {
      const current = mainWindow!.webContents.getZoomLevel();
      mainWindow!.webContents.setZoomLevel(Math.max(current - 0.5, -3));
    } else if (input.key === '0') {
      mainWindow!.webContents.setZoomLevel(0);
    } else {
      return;
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  const baseUrl = (is.dev && process.env['ELECTRON_RENDERER_URL']) 
    ? process.env['ELECTRON_RENDERER_URL'] 
    : join(__dirname, '../renderer/index.html');

  if (needsOnboarding) {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(`${baseUrl}#/welcome`)
    } else {
      mainWindow.loadFile(baseUrl, { hash: '/welcome' })
    }
  } else {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(baseUrl)
    } else {
      mainWindow.loadFile(baseUrl)
    }
  }
}

/**
 * 核心初始化阶段：在确定存储路径后（或非首次启动）执行
 */
async function completeFullBootstrap() {
  if (isBootstrapping) return;
  isBootstrapping = true;

  try {
    // 1. 初始化 Vault 系统 (此时 path.service 已经可以读到正确的 rootPath)
    await initVaultSystem();
    
    // 2. 业务级 IPC 已在 app.whenReady 中提前注册，此处无需重复

    // 3. 这里的逻辑在引导完成后或者已有配置时执行
    if (mainWindow) {
      const settingsRepo = new SettingsRepository(getAppDb());
      const hotkeyService = new HotkeyService(settingsRepo, mainWindow);
      hotkeyService.start();
      setHotkeyService(hotkeyService);
      
      // 通知渲染进程引导已就绪，可以跳转了
      mainWindow.webContents.send('onboarding:ready');
    }
    
    isBootstrapping = false;
  } catch (err) {
    logger.error('Failed to complete bootstrap:', err);
    isBootstrapping = false;
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Inject Electron net.fetch to global scope to automatically bypass network isolation in custom components
  // like model-pricing.service that may be proxy-sensitive
  (global as any).customNetFetch = net.fetch;

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Register local protocol for secure local asset rendering
  protocol.handle('local', async (request) => {
    try {
      const targetUrl = request.url.replace(/^local:/i, 'file:');
      const physicalPath = fileURLToPath(targetUrl);
      const { existsSync } = require('node:fs');
      if (!existsSync(physicalPath)) {
        return new Response('Not found', { status: 404 });
      }
      return await net.fetch(targetUrl);
    } catch (e) {
      // Squash annoying ERR_FILE_NOT_FOUND stack traces when UI loads dead db avatar paths
      return new Response('Not found', { status: 404 });
    }
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
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
  
  // 初始化全局 Agent DB Schema（一次性，不随 Vault 切换而重复）
  // connectionManager 提供全局访问句柄，供所有 Agent 相关 IPC 使用
  const appDb = getAppDb();
  connectionManager.setDb(appDb);
  await installDatabaseSchema(appDb);

  // 引导检查
  const settingsPath = join(app.getPath('userData'), 'baishou_settings.json');
  let needsOnboarding = true;
  let customStorageRoot = '';
  try {
    const data = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(data);
    if (settings.custom_storage_root) {
      customStorageRoot = settings.custom_storage_root;
      needsOnboarding = false;
    }
  } catch {}

  // ======================================
  // 5. 自动升级探测 (Legacy Migration Check)
  // 如果当前是全新安装，尝试探查本地默认目录下是否遗留旧版白守的数据库
  // ======================================
  if (needsOnboarding) {
    try {
      const defaultLegacyRoot = join(app.getPath('documents'), 'BaiShou_Root');
      const { LegacyMigrationService } = await import('./services/legacy-migration.service');
      const legacyService = new LegacyMigrationService();
      
      const isLegacyPresent = await legacyService.isLegacyAppRoot(defaultLegacyRoot);
      if (isLegacyPresent) {
        logger.info('[Bootstrapper] Discovered Local Legacy Installation at', defaultLegacyRoot);
        // 执行无损原地热升迁
        await legacyService.migrate(defaultLegacyRoot, defaultLegacyRoot);
        
        // 升迁成功后，保存路径配置并跳过引导页面
        await fs.writeFile(settingsPath, JSON.stringify({ custom_storage_root: defaultLegacyRoot }), 'utf-8');
        customStorageRoot = defaultLegacyRoot;
        needsOnboarding = false;
        
        logger.info('[Bootstrapper] Local Auto-Migration Completed! Skipped Onboarding.');
      }
    } catch (e) {
      logger.error('[Bootstrapper] Local Auto-Migration Failed. Falling back to Onboarding:', e);
    }
  }

  // 1. 注册引导 IPC
  registerOnboardingIPC(() => {
    completeFullBootstrap();
  });

  // 2. 注册设置 IPC (基础设置可能在引导中也需要)
  registerSettingsIPC();

  // 2.5 提前注册所有业务级 IPC，防止渲染进程在窗口创建后立刻调用时 handler 尚未注册
  registerAgentIPC();
  registerVaultIPC();
  registerArchiveIPC();
  registerLanIPC();
  registerCloudSyncIPC();
  registerDiaryIPC();
  registerProfileIPC();
  registerSummaryIPC();
  registerStorageIPC();
  registerAttachmentIPC();
  registerDiaryAttachmentIPC();
  registerRagIPC();
  registerDeveloperIPC();
  registerSearchIPC();

  // 3. 确保创建 mainWindow，因为全量引导（如全局快捷键）依赖该实例结构
  createWindow(needsOnboarding);

  // 4. 决定是否立即执行全量初始化
  if (!needsOnboarding) {
    await completeFullBootstrap();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(needsOnboarding)
  })
})

app.on('will-quit', () => {
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});

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
