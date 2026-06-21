import { ipcRenderer } from 'electron'
import type { TtsSynthesizeFromSettingsResult } from '@baishou/shared'

export const settingsApi = {
  settings: {
    getProviders: () => ipcRenderer.invoke('settings:get-providers'),
    setProviders: (providers: any[]) => ipcRenderer.invoke('settings:set-providers', providers),
    patchProvider: (providerId: string, updates: Record<string, unknown>) =>
      ipcRenderer.invoke('settings:patch-provider', providerId, updates),
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

    getDiaryTemplateConfig: () => ipcRenderer.invoke('settings:get-diary-template-config'),
    setDiaryTemplateConfig: (config: any) =>
      ipcRenderer.invoke('settings:set-diary-template-config', config),

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

    getLegacyUpgradeNoticeState: () =>
      ipcRenderer.invoke('settings:get-legacy-upgrade-notice-state'),
    markLegacyUpgradeNoticeShown: () =>
      ipcRenderer.invoke('settings:mark-legacy-upgrade-notice-shown'),

    reorderProviders: (orderedIds: string[]) =>
      ipcRenderer.invoke('settings:reorder-providers', orderedIds),
    testProviderConnection: (
      providerId: string,
      tempKey?: string,
      tempUrl?: string,
      testModelId?: string
    ) => ipcRenderer.invoke('settings:test-connection', providerId, tempKey, tempUrl, testModelId),
    fetchProviderModels: (providerId: string, tempKey?: string, tempUrl?: string) =>
      ipcRenderer.invoke('settings:fetch-models', providerId, tempKey, tempUrl),
    testTts: (config: unknown, text: string): Promise<TtsSynthesizeFromSettingsResult> =>
      ipcRenderer.invoke('settings:tts-test', config, text),
    pickTtsRefAudio: (): Promise<string | null> => ipcRenderer.invoke('settings:pick-tts-ref-audio')
  },

  vault: {
    list: () => ipcRenderer.invoke('vault:getAll'),
    getActive: () => ipcRenderer.invoke('vault:getActive'),
    switchActive: (vaultName: string) => ipcRenderer.invoke('vault:switch', vaultName),
    waitForResync: () => ipcRenderer.invoke('vault:wait-for-resync'),
    getIndexingStatus: () => ipcRenderer.invoke('vault:getIndexingStatus'),
    preload: (vaultName: string) => ipcRenderer.invoke('vault:preload', vaultName),
    delete: (vaultName: string) => ipcRenderer.invoke('vault:delete', vaultName),
    createDialog: (name?: string) => ipcRenderer.invoke('vault:createDialog', name),
    pickCustomRootPath: () => ipcRenderer.invoke('vault:pickCustomRootPath'),
    getCustomRootPath: () => ipcRenderer.invoke('vault:getCustomRootPath'),
    onRegistryUpdated: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('vault:registryUpdated', handler)
      return () => ipcRenderer.removeListener('vault:registryUpdated', handler)
    }
  },

  profile: {
    getProfile: () => ipcRenderer.invoke('profile:get-all'),
    saveProfile: (profile: any) => ipcRenderer.invoke('profile:save', profile),
    pickAndSaveAvatar: () => ipcRenderer.invoke('profile:pick-avatar'),
    pickAndSaveBackground: () => ipcRenderer.invoke('profile:pick-background')
  },

  storage: {
    getStats: () => ipcRenderer.invoke('storage:getStats'),
    pickDirectory: () => ipcRenderer.invoke('storage:pickDirectory'),
    validateTargetDirectory: (targetPath: string) =>
      ipcRenderer.invoke('storage:validateTargetDirectory', targetPath),
    changeDirectory: (targetPath: string) =>
      ipcRenderer.invoke('storage:changeDirectory', targetPath),
    migrateDirectory: (targetPath: string) =>
      ipcRenderer.invoke('storage:migrateDirectory', targetPath),
    clearCache: () => ipcRenderer.invoke('storage:clearCache'),
    vacuumDb: () => ipcRenderer.invoke('storage:vacuumDb'),
    onMigrationProgress: (callback: (payload: { name: string }) => void) => {
      const listener = (_: unknown, payload: { name: string }) => callback(payload)
      ipcRenderer.on('storage:migration-progress', listener)
      return () => ipcRenderer.removeListener('storage:migration-progress', listener)
    },
    onRootChanged: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('storage:root-changed', listener)
      return () => ipcRenderer.removeListener('storage:root-changed', listener)
    }
  }
}
