import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
export const api = {
  agentChat: (params: { sessionId: string; text: string }) => ipcRenderer.invoke('agent:chat', params),
  getMessages: (sessionId: string) => ipcRenderer.invoke('agent:get-messages', sessionId),
  
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

  // Settings
  settings: {
    getProviders: () => ipcRenderer.invoke('settings:get-providers'),
    setProviders: (providers: any[]) => ipcRenderer.invoke('settings:set-providers', providers),
    getGlobalModels: () => ipcRenderer.invoke('settings:get-global-models'),
    setGlobalModels: (config: any) => ipcRenderer.invoke('settings:set-global-models', config),
    getFeatures: () => ipcRenderer.invoke('settings:get-features'),
    setFeatures: (config: any) => ipcRenderer.invoke('settings:set-features', config),
  },

  // Data Routing API (Phase 11: Data Wiring)
  getSessions: () => ipcRenderer.invoke('agent:get-sessions'),
  deleteSessions: (ids: string[]) => ipcRenderer.invoke('agent:delete-sessions', ids),
  pinSession: (id: string, isPinned: boolean) => ipcRenderer.invoke('agent:pin-session', id, isPinned),

  getAssistants: () => ipcRenderer.invoke('agent:get-assistants'),
  createAssistant: (input: any) => ipcRenderer.invoke('agent:create-assistant', input),
  updateAssistant: (id: string, input: any) => ipcRenderer.invoke('agent:update-assistant', id, input),
  deleteAssistant: (id: string) => ipcRenderer.invoke('agent:delete-assistant', id),

  // Vault/Workspace System
  vaultGetAll: () => ipcRenderer.invoke('vault:getAll'),
  vaultGetActive: () => ipcRenderer.invoke('vault:getActive'),
  vaultSwitch: (vaultName: string) => ipcRenderer.invoke('vault:switch', vaultName),
  vaultDelete: (vaultName: string) => ipcRenderer.invoke('vault:delete', vaultName),
  vaultPickCustomRootPath: () => ipcRenderer.invoke('vault:pickCustomRootPath'),
  vaultGetCustomRootPath: () => ipcRenderer.invoke('vault:getCustomRootPath'),

  // Archive System (Phase B1)
  archive: {
    exportZip: () => ipcRenderer.invoke('archive:export'),
    importZip: (filePath: string) => ipcRenderer.invoke('archive:import', filePath),
    pickZip: () => ipcRenderer.invoke('archive:pick-zip')
  },

  // LAN Sync (Phase B)
  lan: {
    startBroadcasting: () => ipcRenderer.invoke('lan:startBroadcasting'),
    stopBroadcasting: () => ipcRenderer.invoke('lan:stopBroadcasting'),
    startDiscovery: () => ipcRenderer.invoke('lan:startDiscovery'),
    stopDiscovery: () => ipcRenderer.invoke('lan:stopDiscovery'),
    sendFile: (ip: string, port: number) => ipcRenderer.invoke('lan:sendFile', ip, port),
    
    // Listeners
    onDeviceFound: (callback: (device: any) => void) => {
      const handler = (_: any, device: any) => callback(device)
      ipcRenderer.on('lan:device-found', handler)
      return () => ipcRenderer.off('lan:device-found', handler)
    },
    onDeviceLost: (callback: (deviceId: string) => void) => {
      const handler = (_: any, deviceId: string) => callback(deviceId)
      ipcRenderer.on('lan:device-lost', handler)
      return () => ipcRenderer.off('lan:device-lost', handler)
    },
    onSendProgress: (callback: (progress: number) => void) => {
      const handler = (_: any, progress: number) => callback(progress)
      ipcRenderer.on('lan:send-progress', handler)
      return () => ipcRenderer.off('lan:send-progress', handler)
    },
    onFileReceived: (callback: (zipFilePath: string) => void) => {
      const handler = (_: any, path: string) => callback(path)
      ipcRenderer.on('lan:file-received', handler)
      return () => ipcRenderer.off('lan:file-received', handler)
    }
  },

  // Cloud Sync (Phase C)
  cloud: {
    syncNow: (config: any) => ipcRenderer.invoke('cloud:syncNow', config),
    listRecords: (config: any) => ipcRenderer.invoke('cloud:listRecords', config),
    restore: (config: any, filename: string) => ipcRenderer.invoke('cloud:restore', config, filename),
    deleteRecord: (config: any, filename: string) => ipcRenderer.invoke('cloud:deleteRecord', config, filename),
    batchDelete: (config: any, filenames: string[]) => ipcRenderer.invoke('cloud:batchDelete', config, filenames),
    rename: (config: any, oldName: string, newName: string) => ipcRenderer.invoke('cloud:rename', config, oldName, newName)
  }
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
