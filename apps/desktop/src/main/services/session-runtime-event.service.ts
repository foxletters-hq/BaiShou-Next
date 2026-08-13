import { BrowserWindow } from 'electron'
import { onAgentSessionRuntime } from '@baishou/ai'

let registered = false

/** 将 Session Runtime 控制面事件广播到渲染进程（可观测 / 后续 UI） */
export function registerSessionRuntimeEventBridge(): void {
  if (registered) return
  registered = true

  onAgentSessionRuntime((event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('agent:session-runtime-event', event)
      }
    }
  })
}
