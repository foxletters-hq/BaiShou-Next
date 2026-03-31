import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
export const api = {
  agentChat: (text: string) => ipcRenderer.invoke('agent:chat', text),
  onAgentStreamChunk: (callback: (chunk: string) => void) => {
    ipcRenderer.on('agent:stream-chunk', (_event, chunk) => callback(chunk))
  },
  onAgentStreamFinish: (callback: (error?: string) => void) => {
    ipcRenderer.on('agent:stream-finish', (_event, error) => callback(error))
  },
  removeAgentListeners: () => {
    ipcRenderer.removeAllListeners('agent:stream-chunk')
    ipcRenderer.removeAllListeners('agent:stream-finish')
  },
  
  // Phase 10 Extracted System Access
  pickFiles: () => ipcRenderer.invoke('system:pick-files'),
  getProviders: () => ipcRenderer.invoke('agent:get-providers'),

  // Vault/Workspace System
  vaultGetAll: () => ipcRenderer.invoke('vault:getAll'),
  vaultGetActive: () => ipcRenderer.invoke('vault:getActive'),
  vaultSwitch: (vaultName: string) => ipcRenderer.invoke('vault:switch', vaultName),
  vaultDelete: (vaultName: string) => ipcRenderer.invoke('vault:delete', vaultName),
  vaultPickCustomRootPath: () => ipcRenderer.invoke('vault:pickCustomRootPath'),
  vaultGetCustomRootPath: () => ipcRenderer.invoke('vault:getCustomRootPath')
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
