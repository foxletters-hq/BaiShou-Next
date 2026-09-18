import type {
  AIProviderConfig,
  GlobalModelsConfig,
  AgentBehaviorConfig,
  RagConfig,
  WebSearchConfig,
  SummaryConfig,
  ToolManagementConfig,
  McpServerConfig,
  HotkeyConfig
} from '@baishou/shared'
import type { SettingsConfigKey } from '../settings-config.loader'

export type AppThemeMode = 'light' | 'dark' | 'system'

export interface SettingsState {
  themeMode: AppThemeMode
  useGlassmorphism: boolean
  locale: string
  themeColor: string
  /** 阅读字号档位：0=小 … 1=默认 … 5=大 */
  fontSizeLevel: number

  providers: AIProviderConfig[]
  globalModels: GlobalModelsConfig | null
  agentBehavior: AgentBehaviorConfig | null
  ragConfig: RagConfig | null
  webSearchConfig: WebSearchConfig | null
  summaryConfig: SummaryConfig | null
  toolManagementConfig: ToolManagementConfig | null
  mcpServerConfig: McpServerConfig | null
  hotkeyConfig: HotkeyConfig | null
  cloudSyncConfig: any | null

  isLoading: boolean
  configHydrated: boolean
  loadedConfigKeys: SettingsConfigKey[]
  loadingConfigKeys: SettingsConfigKey[]
  failedConfigKeys: SettingsConfigKey[]
}

export interface SettingsActions {
  setThemeMode: (mode: AppThemeMode) => void
  toggleGlassmorphism: (enabled: boolean) => void
  setLocale: (locale: string) => void
  setThemeColor: (color: string) => void
  setFontSizeLevel: (level: number) => void

  loadConfig: (options?: { force?: boolean }) => Promise<void>
  /** 强制从主进程重新拉取指定配置键（忽略已加载缓存） */
  reloadConfigKeys: (keys: SettingsConfigKey[]) => Promise<void>
  ensureConfigForSegment: (segment: string) => Promise<void>
  retryConfigForSegment: (segment: string) => Promise<void>
  ensureConfigKeys: (
    keys: SettingsConfigKey[],
    options?: { trackGlobalLoading?: boolean }
  ) => Promise<void>
  scheduleDeferredConfigWarmup: () => void
  cancelDeferredConfigWarmup: () => void
  resetSettingsConfigCache: () => void
  isSegmentConfigReady: (segment: string) => boolean
  isSegmentConfigFailed: (segment: string) => boolean

  setProviders: (providers: AIProviderConfig[]) => Promise<void>
  updateProvider: (provider: AIProviderConfig) => Promise<void>
  patchProvider: (providerId: string, updates: Partial<AIProviderConfig>) => Promise<void>
  toggleProvider: (id: string, isEnabled: boolean) => Promise<void>

  setGlobalModels: (config: GlobalModelsConfig) => Promise<void>
  setAgentBehaviorConfig: (config: AgentBehaviorConfig) => Promise<void>
  setRagConfig: (config: RagConfig) => Promise<void>
  setWebSearchConfig: (config: WebSearchConfig) => Promise<void>
  setSummaryConfig: (config: SummaryConfig) => Promise<void>
  setToolManagementConfig: (config: ToolManagementConfig) => Promise<void>
  setMcpServerConfig: (config: McpServerConfig) => Promise<void>
  refreshMcpAuthToken: () => Promise<McpServerConfig | void>
  setHotkeyConfig: (config: HotkeyConfig) => Promise<void>
  setCloudSyncConfig: (config: any) => Promise<void>
}

export type SettingsStore = SettingsState & SettingsActions
