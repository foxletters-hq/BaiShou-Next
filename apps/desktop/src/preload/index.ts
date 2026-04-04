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
    
    getAgentBehaviorConfig: () => ipcRenderer.invoke('settings:get-agent-behavior-config'),
    setAgentBehaviorConfig: (config: any) => ipcRenderer.invoke('settings:set-agent-behavior-config', config),
    
    getRagConfig: () => ipcRenderer.invoke('settings:get-rag-config'),
    setRagConfig: (config: any) => ipcRenderer.invoke('settings:set-rag-config', config),
    
    getWebSearchConfig: () => ipcRenderer.invoke('settings:get-web-search-config'),
    setWebSearchConfig: (config: any) => ipcRenderer.invoke('settings:set-web-search-config', config),
    
    getSummaryConfig: () => ipcRenderer.invoke('settings:get-summary-config'),
    setSummaryConfig: (config: any) => ipcRenderer.invoke('settings:set-summary-config', config),
    
    getToolManagementConfig: () => ipcRenderer.invoke('settings:get-tool-management-config'),
    setToolManagementConfig: (config: any) => ipcRenderer.invoke('settings:set-tool-management-config', config),
    
    getMcpServerConfig: () => ipcRenderer.invoke('settings:get-mcp-server-config'),
    setMcpServerConfig: (config: any) => ipcRenderer.invoke('settings:set-mcp-server-config', config),
    
    getHotkeyConfig: () => ipcRenderer.invoke('settings:get-hotkey-config'),
    setHotkeyConfig: (config: any) => ipcRenderer.invoke('settings:set-hotkey-config', config),
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

  // Profile System
  profile: {
    getProfile: () => ipcRenderer.invoke('profile:get-all'),
    saveProfile: (profile: any) => ipcRenderer.invoke('profile:save', profile),
    pickAndSaveAvatar: () => ipcRenderer.invoke('profile:pick-avatar')
  },

  // Storage System
  storage: {
    getStats: () => ipcRenderer.invoke('storage:getStats'),
    clearCache: () => ipcRenderer.invoke('storage:clearCache'),
    vacuumDb: () => ipcRenderer.invoke('storage:vacuumDb')
  },

  // Archive System (Phase B1)
  archive: {
    exportZip: () => ipcRenderer.invoke('archive:export'),
    importZip: (filePath: string) => ipcRenderer.invoke('archive:import', filePath),
    pickZip: () => ipcRenderer.invoke('archive:pick-zip')
  },

  // Diary System (Phase 13)
  diary: {
    create: (input: any) => ipcRenderer.invoke('diary:create', input),
    update: (id: number, input: any) => ipcRenderer.invoke('diary:update', id, input),
    delete: (id: number) => ipcRenderer.invoke('diary:delete', id),
    findById: (id: number) => ipcRenderer.invoke('diary:findById', id),
    findByDate: (dateStr: string) => ipcRenderer.invoke('diary:findByDate', dateStr),
    listAll: (options?: any) => ipcRenderer.invoke('diary:listAll', options),
    search: (query: string, options?: any) => ipcRenderer.invoke('diary:search', query, options),
    count: () => ipcRenderer.invoke('diary:count')
  },

  // Summary System (Phase 13)
  summary: {
    save: (input: any) => ipcRenderer.invoke('summary:save', input),
    update: (id: number, type: string, startDate: string, endDate: string, update: any) => 
      ipcRenderer.invoke('summary:update', id, type, startDate, endDate, update),
    delete: (type: string, startDate: string, endDate: string) => 
      ipcRenderer.invoke('summary:delete', type, startDate, endDate),
    readDetail: (type: string, startDate: string, endDate: string) => 
      ipcRenderer.invoke('summary:readDetail', type, startDate, endDate),
    list: (options?: any) => ipcRenderer.invoke('summary:list', options),
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
  },

  // Window Controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    close: () => ipcRenderer.send('window:close')
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
