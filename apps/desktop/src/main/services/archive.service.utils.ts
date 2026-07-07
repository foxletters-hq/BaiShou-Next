import i18n from 'i18next'
import { app, BrowserWindow } from 'electron'
import { translateMain, isPathInsideStorageRoot } from '@baishou/shared'
import * as path from 'path'

export function broadcastArchiveImportState(importing: boolean): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('archive:import-state', importing)
  }
}

export function broadcastArchiveImportProgress(detail: string): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('archive:import-progress', { detail })
  }
}

export function formatExportBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}

export function resolveDefaultExportSavePath(defaultName: string, storageRoot: string): string {
  const candidates = [
    app.getPath('desktop'),
    app.getPath('documents'),
    app.getPath('downloads'),
    app.getPath('temp')
  ]
  for (const dir of candidates) {
    if (!isPathInsideStorageRoot(dir, storageRoot)) {
      return path.join(dir, defaultName)
    }
  }
  return path.join(app.getPath('temp'), defaultName)
}

export function formatArchiveExportPathError(locale: string | undefined, code: string): string {
  if (code === 'ARCHIVE_EXPORT_OUTPUT_INSIDE_STORAGE') {
    return translateMain(
      locale,
      'settings.archive_export_inside_storage',
      i18n.t(
        'auto.apps.desktop.src.main.services.archive.service.L83',
        '不能将备份保存到白守的数据存储目录内，否则会把正在生成的 ZIP 再次打包进去。请选择桌面、文档等外部位置。'
      )
    )
  }
  return code
}
