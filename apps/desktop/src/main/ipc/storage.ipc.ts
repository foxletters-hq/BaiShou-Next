import { ipcMain, BrowserWindow } from 'electron'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { vaultService, pathService } from './vault.ipc'
import {
  changeStorageRootDirectory,
  migrateStorageRootDirectory,
  pickStorageDirectory,
  validateStorageTarget,
  type StorageTargetValidation
} from '../services/desktop-storage-directory.service'
import {
  applyExternalJournalsDirectory,
  getExternalJournalsDirectoryInfo,
  validateExternalJournalsDirectory
} from '../services/desktop-external-journals.service'
import {
  applyExternalSummariesDirectory,
  getExternalSummariesDirectoryInfo,
  validateExternalSummariesDirectory
} from '../services/desktop-external-vault-paths.service'

export function registerStorageIPC() {
  ipcMain.handle('storage:getStats', async () => {
    try {
      const activeVault = vaultService.getActiveVault()
      const storageRootPath = activeVault ? activeVault.path : await pathService.getRootDirectory()
      const sqlitePath = activeVault
        ? path.join(activeVault.path, 'data.db')
        : path.join(app.getPath('userData'), 'data.db')

      let sqliteSize = 0
      if (fs.existsSync(sqlitePath)) {
        const stats = fs.statSync(sqlitePath)
        sqliteSize = stats.size
      }

      const vectorDbSize = 0
      const mediaCacheSize = 0

      const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
      }

      return {
        storageRootPath,
        sqliteSizeStats: formatBytes(sqliteSize),
        vectorDbStats: formatBytes(vectorDbSize),
        mediaCacheStats: formatBytes(mediaCacheSize)
      }
    } catch (e) {
      console.error('[Storage IPC] Failed to get stats', e)
      return {
        storageRootPath: await pathService.getRootDirectory(),
        sqliteSizeStats: 'Unknown',
        vectorDbStats: 'Unknown',
        mediaCacheStats: 'Unknown'
      }
    }
  })

  ipcMain.handle('storage:pickDirectory', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    return pickStorageDirectory(window)
  })

  ipcMain.handle(
    'storage:validateTargetDirectory',
    async (_, targetPath: string): Promise<StorageTargetValidation> => {
      return validateStorageTarget(targetPath)
    }
  )

  ipcMain.handle('storage:changeDirectory', async (_, targetPath: string) => {
    await changeStorageRootDirectory(targetPath)
    return { ok: true as const }
  })

  ipcMain.handle('storage:migrateDirectory', async (event, targetPath: string) => {
    await migrateStorageRootDirectory(targetPath, (itemName) => {
      event.sender.send('storage:migration-progress', { name: itemName })
    })
    return { ok: true as const }
  })

  ipcMain.handle('storage:clearCache', async () => {
    return true
  })

  ipcMain.handle('storage:vacuumDb', async () => {
    return true
  })

  ipcMain.handle('storage:getExternalJournalsInfo', async () => {
    return getExternalJournalsDirectoryInfo()
  })

  ipcMain.handle('storage:pickExternalJournalsDirectory', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    return pickStorageDirectory(window)
  })

  ipcMain.handle('storage:setExternalJournalsDirectory', async (_, targetPath: string) => {
    const validation = await validateExternalJournalsDirectory(targetPath)
    if (!validation.valid) {
      throw new Error(validation.code)
    }
    await applyExternalJournalsDirectory(validation.path)
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('storage:journals-path-changed')
    })
    return { ok: true as const, journalFileCount: validation.journalFileCount }
  })

  ipcMain.handle('storage:clearExternalJournalsDirectory', async () => {
    await applyExternalJournalsDirectory(null)
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('storage:journals-path-changed')
    })
    return { ok: true as const }
  })

  ipcMain.handle('storage:getExternalSummariesInfo', async () => {
    return getExternalSummariesDirectoryInfo()
  })

  ipcMain.handle('storage:pickExternalSummariesDirectory', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    return pickStorageDirectory(window)
  })

  ipcMain.handle('storage:setExternalSummariesDirectory', async (_, targetPath: string) => {
    const validation = await validateExternalSummariesDirectory(targetPath)
    if (!validation.valid) {
      throw new Error(validation.code)
    }
    await applyExternalSummariesDirectory(validation.path)
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('storage:summaries-path-changed')
    })
    return { ok: true as const, summaryFileCount: validation.summaryFileCount }
  })

  ipcMain.handle('storage:clearExternalSummariesDirectory', async () => {
    await applyExternalSummariesDirectory(null)
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('storage:summaries-path-changed')
    })
    return { ok: true as const }
  })
}
