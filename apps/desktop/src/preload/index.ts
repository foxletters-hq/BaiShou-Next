import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { diaryApi } from './diary.api'
import { settingsApi } from './settings.api'
import { syncApi } from './sync.api'
import { agentApi } from './agent.api'
import { systemApi } from './system.api'
import { shortcutsApi } from './shortcuts.api'
import { legacyMigrationApi } from './legacy-migration.api'
import { cacheApi } from './cache.api'
import { agentWorkspaceApi } from './agent-workspace.api'

// Custom APIs for renderer

// --- 全局 IPC 拦截器（仅用于开发调试） ---
const originalInvoke = electronAPI.ipcRenderer.invoke
electronAPI.ipcRenderer.invoke = async (channel: string, ...args: any[]) => {
  const startTime = performance.now()
  console.groupCollapsed(`[IPC Request] ➔ ${channel}`)
  console.log('Payload:', args)
  console.groupEnd()

  try {
    const result = await originalInvoke(channel, ...args)
    const cost = Math.round(performance.now() - startTime)
    console.groupCollapsed(`[IPC Response] ⬅ ${channel} (${cost}ms)`)
    console.log('Result:', result)
    console.groupEnd()
    return result
  } catch (e) {
    const cost = Math.round(performance.now() - startTime)
    console.groupCollapsed(`%c[IPC Error] ❌ ${channel} (${cost}ms)`, 'color: red')
    console.error(e)
    console.groupEnd()
    throw e
  }
}

export const api = {
  ...agentApi,
  ...diaryApi,
  ...settingsApi,
  ...syncApi,
  ...systemApi,
  ...legacyMigrationApi,
  ...cacheApi,
  agentWorkspace: agentWorkspaceApi,
  shortcuts: shortcutsApi
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
