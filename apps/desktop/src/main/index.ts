import { app, shell, BrowserWindow, ipcMain } from 'electron'
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

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

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
app.whenReady().then(() => {
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
    
    createWindow()
  }).catch((err) => {
    console.error('Failed to init Vault System', err)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
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
