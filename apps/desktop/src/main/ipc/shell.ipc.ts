import { ipcMain, shell } from 'electron'
import * as path from 'path'

function assertHttpUrl(url: string): string {
  const trimmed = url.trim()
  const parsed = new URL(trimmed)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`)
  }
  return trimmed
}

export function registerShellIPC(): void {
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    const safeUrl = assertHttpUrl(url)
    await shell.openExternal(safeUrl)
    return true
  })

  ipcMain.handle('shell:show-item-in-folder', async (_event, filePath: string) => {
    if (!filePath?.trim()) return false
    shell.showItemInFolder(path.resolve(filePath))
    return true
  })
}
