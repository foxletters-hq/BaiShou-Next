import { ipcMain, shell } from 'electron'

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
}
