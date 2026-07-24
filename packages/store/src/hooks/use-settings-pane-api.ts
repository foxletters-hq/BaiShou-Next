import { useShallow } from 'zustand/react/shallow'
import { useSettingsStore } from '../stores/settings.store'

/** 设置面板所需 store 切片，避免订阅无关 UI 偏好字段 */
export function useSettingsPaneApi() {
  return useSettingsStore(
    useShallow((s) => ({
      themeMode: s.themeMode,
      themeColor: s.themeColor,
      locale: s.locale,
      providers: s.providers,
      globalModels: s.globalModels,
      agentBehavior: s.agentBehavior,
      ragConfig: s.ragConfig,
      webSearchConfig: s.webSearchConfig,
      summaryConfig: s.summaryConfig,
      toolManagementConfig: s.toolManagementConfig,
      mcpServerConfig: s.mcpServerConfig,
      hotkeyConfig: s.hotkeyConfig,
      cloudSyncConfig: s.cloudSyncConfig,
      setThemeMode: s.setThemeMode,
      setThemeColor: s.setThemeColor,
      setLocale: s.setLocale,
      setProviders: s.setProviders,
      patchProvider: s.patchProvider,
      updateProvider: s.updateProvider,
      toggleProvider: s.toggleProvider,
      setGlobalModels: s.setGlobalModels,
      setAgentBehaviorConfig: s.setAgentBehaviorConfig,
      setRagConfig: s.setRagConfig,
      setWebSearchConfig: s.setWebSearchConfig,
      setSummaryConfig: s.setSummaryConfig,
      setToolManagementConfig: s.setToolManagementConfig,
      setMcpServerConfig: s.setMcpServerConfig,
      refreshMcpAuthToken: s.refreshMcpAuthToken,
      setHotkeyConfig: s.setHotkeyConfig,
      setCloudSyncConfig: s.setCloudSyncConfig,
      loadConfig: s.loadConfig,
      reloadConfigKeys: s.reloadConfigKeys
    }))
  )
}
