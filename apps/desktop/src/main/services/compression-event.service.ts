import { BrowserWindow } from 'electron'
import { onCompressionLifecycle } from '@baishou/ai'
import { getAgentManagers } from '../ipc/agent-helpers'

let registered = false

/** 将压缩生命周期事件广播到所有渲染进程窗口；完成后将会话落盘以持久化 compaction marker */
export function registerCompressionEventBridge(): void {
  if (registered) return
  registered = true

  onCompressionLifecycle((event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('agent:compression-event', event)
      }
    }

    if (event.type === 'finish' && event.ok) {
      void (async () => {
        try {
          const { sessionManager } = getAgentManagers()
          await sessionManager.flushSessionToDisk(event.sessionId)
        } catch (e) {
          console.warn('[CompressionEvent] flushSessionToDisk failed:', e)
        }
      })()
    }
  })
}
