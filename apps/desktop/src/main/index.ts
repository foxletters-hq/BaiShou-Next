import { app, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
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
import { registerRagIPC } from './ipc/rag.ipc'
import { installDatabaseSchema, SettingsRepository, connectionManager } from '@baishou/database'
import { getAppDb } from './db'
import { HotkeyService } from './services/hotkey.service'
import { setHotkeyService } from './ipc/settings.ipc'




let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 860,
    minHeight: 500,
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

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

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

  // Register Agent Streaming IPC
  registerAgentIPC()

  // Register Settings IPC
  registerSettingsIPC()

  // Register Vault IPC
  initVaultSystem().then(() => {
    registerVaultIPC()

    // Register Archive IPC
    registerArchiveIPC()
    
    // Register LAN Sync IPC
    registerLanIPC()
    
    // Register Cloud Sync IPC
    registerCloudSyncIPC()

    // Register Diary IPC
    registerDiaryIPC()

    // Register Profile IPC
    registerProfileIPC()

    // Register Summary IPC
    registerSummaryIPC()
    
    // Register Storage IPC
    registerStorageIPC()

    // Register RAG IPC
    registerRagIPC()
    
    createWindow()

    if (mainWindow) {
      const settingsRepo = new SettingsRepository(getAppDb());
      const hotkeyService = new HotkeyService(settingsRepo, mainWindow);
      hotkeyService.start();
      setHotkeyService(hotkeyService);
    }
  }).catch((err) => {
    console.error('Failed to init Vault System', err)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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
