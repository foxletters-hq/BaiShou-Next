import { ipcMain, BrowserWindow } from 'electron'
import { UpdaterService } from '../services/updater.service'

let updaterService: UpdaterService | null = null

/** 获取更新服务实例 */
function getUpdaterService(): UpdaterService {
  if (!updaterService) {
    updaterService = new UpdaterService()
  }
  return updaterService
}

/** 注册更新相关 IPC */
export function registerUpdaterIPC(): void {
  const service = getUpdaterService()

  // 检查更新
  ipcMain.handle('updater:check', async () => {
    try {
      return await service.checkForUpdates()
    } catch (error) {
      throw error
    }
  })

  // 下载更新
  ipcMain.handle('updater:download', async () => {
    try {
      await service.downloadUpdate()
      return { success: true }
    } catch (error) {
      throw error
    }
  })

  // 安装更新
  ipcMain.handle('updater:install', () => {
    service.quitAndInstall()
  })

  // 获取当前版本
  ipcMain.handle('updater:get-version', () => {
    return service.getCurrentVersion()
  })

  // 设置自动检查
  ipcMain.handle('updater:set-auto-check', (_, enabled: boolean) => {
    service.setAutoCheck(enabled)
    return { success: true }
  })

  // 获取自动检查状态
  ipcMain.handle('updater:get-auto-check', () => {
    return service.getAutoCheck()
  })

  // 注册状态变更事件推送到渲染进程
  service.onStatusChange((state) => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('updater:status-change', state)
    }
  })

  // 注册下载进度事件推送到渲染进程
  service.onDownloadProgress((progress) => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('updater:download-progress', progress)
    }
  })
}
