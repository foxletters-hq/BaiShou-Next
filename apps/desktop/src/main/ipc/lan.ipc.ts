import * as fs from 'fs'
import { ipcMain, BrowserWindow, type WebContents } from 'electron'
import { SyncIpcChannels } from '@baishou/shared'
import { DesktopLanSyncService } from '../services/lan-sync.service'
import { archiveService } from './archive.ipc'

export const lanSyncService = new DesktopLanSyncService(archiveService)

function forEachRendererWebContents(fn: (webContents: WebContents) => void): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    const webContents = win.webContents
    if (webContents.isDestroyed()) continue
    const url = webContents.getURL()
    if (url.startsWith('devtools://')) continue
    fn(webContents)
  }
}

function sendToAllRenderers(channel: string, ...args: unknown[]): void {
  forEachRendererWebContents((webContents) => {
    webContents.send(channel, ...args)
  })
}

export function registerLanIPC() {
  ipcMain.handle(SyncIpcChannels.LAN_START_BROADCASTING, async () => {
    return await lanSyncService.startBroadcasting()
  })

  ipcMain.handle(SyncIpcChannels.LAN_STOP_BROADCASTING, async () => {
    await lanSyncService.stopBroadcasting()
    return true
  })

  ipcMain.handle(SyncIpcChannels.LAN_START_DISCOVERY, async () => {
    sendToAllRenderers('lan:discovery-reset')

    await lanSyncService.startDiscovery(
      (device) => {
        sendToAllRenderers('lan:device-found', device)
      },
      (deviceId) => {
        sendToAllRenderers('lan:device-lost', deviceId)
      }
    )
    return true
  })

  ipcMain.handle(SyncIpcChannels.LAN_STOP_DISCOVERY, async () => {
    await lanSyncService.stopDiscovery()
    return true
  })

  ipcMain.handle(SyncIpcChannels.LAN_SEND_FILE, async (_, ip: string, port: number) => {
    return await lanSyncService.sendFile(ip, port, (progress) => {
      sendToAllRenderers('lan:send-progress', progress)
    })
  })

  // Start receiving files backend logic. Trigger a global event to frontend modal when received
  lanSyncService.onFileReceived((zipFilePath) => {
    let sizeBytes = 0
    try {
      sizeBytes = fs.statSync(zipFilePath).size
    } catch {
      // ignore
    }
    sendToAllRenderers('lan:file-received', { path: zipFilePath, sizeBytes })
  })
}
