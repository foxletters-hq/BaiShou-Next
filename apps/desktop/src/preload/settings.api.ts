import { ipcRenderer } from 'electron'

export const settingsApi = {
  settings: {
    getProviders: () => ipcRenderer.invoke('settings:get-providers'),
    setProviders: (providers: any[]) => ipcRenderer.invoke('settings:set-providers', providers),
    getGlobalModels: () => ipcRenderer.invoke('settings:get-global-models'),
    setGlobalModels: (config: any) => ipcRenderer.invoke('settings:set-global-models', config),
    getFeatures: () => ipcRenderer.invoke('settings:get-features'),
    setFeatures: (config: any) => ipcRenderer.invoke('settings:set-features', config),

    getAgentBehaviorConfig: () => ipcRenderer.invoke('settings:get-agent-behavior-config'),
    setAgentBehaviorConfig: (config: any) =>
      ipcRenderer.invoke('settings:set-agent-behavior-config', config),

    getRagConfig: () => ipcRenderer.invoke('settings:get-rag-config'),
    setRagConfig: (config: any) => ipcRenderer.invoke('settings:set-rag-config', config),

    getWebSearchConfig: () => ipcRenderer.invoke('settings:get-web-search-config'),
    setWebSearchConfig: (config: any) =>
      ipcRenderer.invoke('settings:set-web-search-config', config),

    getSummaryConfig: () => ipcRenderer.invoke('settings:get-summary-config'),
    setSummaryConfig: (config: any) => ipcRenderer.invoke('settings:set-summary-config', config),

    getToolManagementConfig: () => ipcRenderer.invoke('settings:get-tool-management-config'),
    setToolManagementConfig: (config: any) =>
      ipcRenderer.invoke('settings:set-tool-management-config', config),

    getSearchModeEnabled: () => ipcRenderer.invoke('settings:get-search-mode-enabled'),
    setSearchModeEnabled: (enabled: boolean) =>
      ipcRenderer.invoke('settings:set-search-mode-enabled', enabled),

    getMcpServerConfig: () => ipcRenderer.invoke('settings:get-mcp-server-config'),
    setMcpServerConfig: (config: any) =>
      ipcRenderer.invoke('settings:set-mcp-server-config', config),
    getMcpTools: () => ipcRenderer.invoke('settings:get-mcp-tools'),

    getHotkeyConfig: () => ipcRenderer.invoke('settings:get-hotkey-config'),
    setHotkeyConfig: (config: any) => ipcRenderer.invoke('settings:set-hotkey-config', config),

    getCloudSyncConfig: () => ipcRenderer.invoke('settings:get-cloud-sync-config'),
    setCloudSyncConfig: (config: any) =>
      ipcRenderer.invoke('settings:set-cloud-sync-config', config),

    reorderProviders: (orderedIds: string[]) =>
      ipcRenderer.invoke('settings:reorder-providers', orderedIds),
    testProviderConnection: (
      providerId: string,
      tempKey?: string,
      tempUrl?: string,
      testModelId?: string
    ) => ipcRenderer.invoke('settings:test-connection', providerId, tempKey, tempUrl, testModelId),
    fetchProviderModels: (providerId: string, tempKey?: string, tempUrl?: string) =>
      ipcRenderer.invoke('settings:fetch-models', providerId, tempKey, tempUrl)
  },

  vault: {
    list: () => ipcRenderer.invoke('vault:getAll'),
    getActive: () => ipcRenderer.invoke('vault:getActive'),
    switchActive: (vaultName: string) => ipcRenderer.invoke('vault:switch', vaultName),
    preload: (vaultName: string) => ipcRenderer.invoke('vault:preload', vaultName),
    delete: (vaultName: string) => ipcRenderer.invoke('vault:delete', vaultName),
    createDialog: (name?: string) => ipcRenderer.invoke('vault:createDialog', name),
    pickCustomRootPath: () => ipcRenderer.invoke('vault:pickCustomRootPath'),
    getCustomRootPath: () => ipcRenderer.invoke('vault:getCustomRootPath')
  },

  profile: {
    getProfile: () => ipcRenderer.invoke('profile:get-all'),
    saveProfile: (profile: any) => ipcRenderer.invoke('profile:save', profile),
    pickAndSaveAvatar: () => ipcRenderer.invoke('profile:pick-avatar')
  },

  storage: {
    getStats: () => ipcRenderer.invoke('storage:getStats'),
    clearCache: () => ipcRenderer.invoke('storage:clearCache'),
    vacuumDb: () => ipcRenderer.invoke('storage:vacuumDb')
  }
}
