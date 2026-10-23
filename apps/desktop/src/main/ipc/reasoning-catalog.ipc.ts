import { BrowserWindow, ipcMain } from 'electron'
import { getRuntimeReasoningCatalogPayload, type ReasoningCatalogPayload } from '@baishou/shared'

export function broadcastReasoningCatalog(payload?: ReasoningCatalogPayload): void {
  const next = payload ?? getRuntimeReasoningCatalogPayload()
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send('reasoning-catalog:updated', next)
  }
}

export function registerReasoningCatalogIPC(): void {
  ipcMain.handle('reasoning-catalog:get', () => getRuntimeReasoningCatalogPayload())
}
