import {
  AUTO_INJECT_TIME_TOOL_ID,
  normalizeEmojiToolConfig,
  type AgentBehaviorConfig,
  type AIProviderConfig,
  type GlobalModelsConfig,
  type HotkeyConfig,
  type McpServerConfig,
  type RagConfig,
  type SummaryConfig,
  type ToolManagementConfig,
  type WebSearchConfig
} from '@baishou/shared'

export type SettingsConfigKey =
  | 'providers'
  | 'globalModels'
  | 'agentBehavior'
  | 'ragConfig'
  | 'webSearchConfig'
  | 'summaryConfig'
  | 'toolManagementConfig'
  | 'mcpServerConfig'
  | 'hotkeyConfig'
  | 'cloudSyncConfig'

export const ALL_SETTINGS_CONFIG_KEYS: SettingsConfigKey[] = [
  'providers',
  'globalModels',
  'agentBehavior',
  'ragConfig',
  'webSearchConfig',
  'summaryConfig',
  'toolManagementConfig',
  'mcpServerConfig',
  'hotkeyConfig',
  'cloudSyncConfig'
]

/** 设置路由 segment → 进入该页所需的最小配置块（general 在面板内按需加载 hotkey） */
export const SETTINGS_SEGMENT_CONFIG_KEYS: Record<string, SettingsConfigKey[]> = {
  mcp: ['mcpServerConfig'],
  'ai-services': ['providers'],
  'ai-models': ['providers', 'globalModels'],
  assistants: ['providers', 'agentBehavior'],
  rag: ['ragConfig', 'globalModels'],
  'web-search': ['webSearchConfig'],
  'agent-tools': ['toolManagementConfig'],
  summary: ['summaryConfig', 'globalModels'],
  tts: ['providers', 'globalModels'],
  'data-sync': ['cloudSyncConfig']
}

export function getConfigKeysForSegment(segment: string): SettingsConfigKey[] {
  return SETTINGS_SEGMENT_CONFIG_KEYS[segment] ?? []
}

export function segmentNeedsConfigLoading(
  segment: string,
  loadedKeys: ReadonlyArray<SettingsConfigKey>
): boolean {
  const required = getConfigKeysForSegment(segment)
  if (required.length === 0) return false
  const loaded = new Set(loadedKeys)
  return required.some((key) => !loaded.has(key))
}

export function segmentHasConfigFailure(
  segment: string,
  failedKeys: ReadonlyArray<SettingsConfigKey>
): boolean {
  const required = getConfigKeysForSegment(segment)
  if (required.length === 0) return false
  const failed = new Set(failedKeys)
  return required.some((key) => failed.has(key))
}

export function getDefaultGlobalModels(): GlobalModelsConfig {
  return {
    globalDialogueProviderId: '',
    globalDialogueModelId: '',
    globalNamingProviderId: '',
    globalNamingModelId: '',
    globalSummaryProviderId: '',
    globalSummaryModelId: '',
    globalEmbeddingProviderId: '',
    globalEmbeddingModelId: '',
    globalTtsProviderId: '',
    globalTtsModelId: '',
    globalTtsSettings: {
      voice: 'alloy',
      speed: 1.0,
      responseFormat: 'mp3'
    },
    monthlySummarySource: 'weeklies'
  }
}

function getDefaultAgentBehavior(): AgentBehaviorConfig {
  return {
    agentContextWindowSize: 20,
    companionCompressTokens: 8000,
    companionTruncateTokens: 4000,
    agentPersona: '',
    agentGuidelines: '',
    pinnedAssistantIds: []
  }
}

export function getDefaultRagConfig(): RagConfig {
  return {
    ragEnabled: true,
    ragTopK: 20,
    ragSimilarityThreshold: 0.4,
    batchEmbedConcurrency: 3
  }
}

export function getDefaultWebSearchConfig(): WebSearchConfig {
  return {
    webSearchEngine: 'exa-mcp',
    webSearchMaxResults: 5,
    webSearchRagEnabled: false,
    tavilyApiKey: '',
    exaApiKey: '',
    anysearchApiKey: '',
    webSearchRagMaxChunks: 12,
    webSearchRagChunksPerSource: 4,
    webSearchPlainSnippetLength: 3000
  }
}

function getDefaultSummaryConfig(): SummaryConfig {
  return { instructions: {} }
}

export function getDefaultToolManagementConfig(): ToolManagementConfig {
  return {
    disabledToolIds: [AUTO_INJECT_TIME_TOOL_ID],
    customConfigs: {},
    emojiConfig: {
      enabled: false,
      groups: []
    }
  }
}

function getDefaultMcpServerConfig(): McpServerConfig {
  return {
    mcpEnabled: false,
    mcpPort: 31004
  }
}

function getDefaultHotkeyConfig(): HotkeyConfig {
  return {
    hotkeyEnabled: false,
    hotkeyModifier: 'Alt',
    hotkeyKey: 'Space'
  }
}

type SettingsApi = {
  getProviders: () => Promise<AIProviderConfig[] | null>
  getGlobalModels: () => Promise<GlobalModelsConfig | null>
  getAgentBehaviorConfig: () => Promise<AgentBehaviorConfig | null>
  getRagConfig: () => Promise<RagConfig | null>
  getWebSearchConfig: () => Promise<WebSearchConfig | null>
  getSummaryConfig: () => Promise<SummaryConfig | null>
  getToolManagementConfig: () => Promise<ToolManagementConfig | null>
  getMcpServerConfig: () => Promise<McpServerConfig | null>
  getHotkeyConfig: () => Promise<HotkeyConfig | null>
  getCloudSyncConfig?: () => Promise<unknown | null>
}

export type SettingsConfigPatch = Partial<{
  providers: AIProviderConfig[]
  globalModels: GlobalModelsConfig
  agentBehavior: AgentBehaviorConfig
  ragConfig: RagConfig
  webSearchConfig: WebSearchConfig
  summaryConfig: SummaryConfig
  toolManagementConfig: ToolManagementConfig
  mcpServerConfig: McpServerConfig
  hotkeyConfig: HotkeyConfig
  cloudSyncConfig: unknown | null
}>

const keyFetchers: Record<
  SettingsConfigKey,
  (settings: SettingsApi) => Promise<SettingsConfigPatch>
> = {
  providers: async (settings) =>
    normalizeSettingsConfigKey('providers', await settings.getProviders()),
  globalModels: async (settings) =>
    normalizeSettingsConfigKey('globalModels', await settings.getGlobalModels()),
  agentBehavior: async (settings) =>
    normalizeSettingsConfigKey('agentBehavior', await settings.getAgentBehaviorConfig()),
  ragConfig: async (settings) =>
    normalizeSettingsConfigKey('ragConfig', await settings.getRagConfig()),
  webSearchConfig: async (settings) =>
    normalizeSettingsConfigKey('webSearchConfig', await settings.getWebSearchConfig()),
  summaryConfig: async (settings) =>
    normalizeSettingsConfigKey('summaryConfig', await settings.getSummaryConfig()),
  toolManagementConfig: async (settings) =>
    normalizeSettingsConfigKey('toolManagementConfig', await settings.getToolManagementConfig()),
  mcpServerConfig: async (settings) =>
    normalizeSettingsConfigKey('mcpServerConfig', await settings.getMcpServerConfig()),
  hotkeyConfig: async (settings) =>
    normalizeSettingsConfigKey('hotkeyConfig', await settings.getHotkeyConfig()),
  cloudSyncConfig: async (settings) =>
    normalizeSettingsConfigKey(
      'cloudSyncConfig',
      typeof settings.getCloudSyncConfig === 'function'
        ? await settings.getCloudSyncConfig()
        : null
    )
}

export function normalizeSettingsConfigKey(
  key: SettingsConfigKey,
  raw: unknown
): SettingsConfigPatch {
  switch (key) {
    case 'providers':
      return { providers: (raw as AIProviderConfig[] | null) || [] }
    case 'globalModels':
      return { globalModels: (raw as GlobalModelsConfig | null) || getDefaultGlobalModels() }
    case 'agentBehavior':
      return { agentBehavior: (raw as AgentBehaviorConfig | null) || getDefaultAgentBehavior() }
    case 'ragConfig':
      return { ragConfig: (raw as RagConfig | null) || getDefaultRagConfig() }
    case 'webSearchConfig':
      return {
        webSearchConfig: { ...getDefaultWebSearchConfig(), ...((raw as WebSearchConfig) || {}) }
      }
    case 'summaryConfig':
      return { summaryConfig: (raw as SummaryConfig | null) || getDefaultSummaryConfig() }
    case 'toolManagementConfig': {
      const toolManagementConfig = raw as ToolManagementConfig | null
      const defaults = getDefaultToolManagementConfig()
      return {
        toolManagementConfig: {
          ...defaults,
          ...toolManagementConfig,
          emojiConfig: normalizeEmojiToolConfig({
            ...defaults.emojiConfig,
            ...(toolManagementConfig?.emojiConfig ?? {})
          } as ToolManagementConfig['emojiConfig'])
        }
      }
    }
    case 'mcpServerConfig':
      return { mcpServerConfig: (raw as McpServerConfig | null) || getDefaultMcpServerConfig() }
    case 'hotkeyConfig':
      return { hotkeyConfig: (raw as HotkeyConfig | null) || getDefaultHotkeyConfig() }
    case 'cloudSyncConfig':
      return { cloudSyncConfig: raw ?? null }
    default:
      return {}
  }
}

export type SettingsConfigSnapshot = Partial<Record<SettingsConfigKey, unknown>>

export function patchesFromConfigSnapshot(snapshot: SettingsConfigSnapshot): SettingsConfigPatch {
  return Object.assign(
    {},
    ...ALL_SETTINGS_CONFIG_KEYS.filter((key) => snapshot[key] !== undefined).map((key) =>
      normalizeSettingsConfigKey(key, snapshot[key])
    )
  )
}

export async function fetchSettingsConfigKey(
  key: SettingsConfigKey,
  settingsApi: SettingsApi
): Promise<SettingsConfigPatch> {
  return keyFetchers[key](settingsApi)
}

export async function fetchSettingsConfigKeys(
  keys: SettingsConfigKey[],
  settingsApi: SettingsApi
): Promise<SettingsConfigPatch> {
  const uniqueKeys = [...new Set(keys)]
  const patches = await Promise.all(uniqueKeys.map((key) => fetchSettingsConfigKey(key, settingsApi)))
  return Object.assign({}, ...patches)
}
