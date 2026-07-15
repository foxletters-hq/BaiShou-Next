import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import {
  i18n,
  resolveAppUiLanguageFromSystemLocale,
  withSummaryPromptLocaleFromUi,
  type AIProviderConfig,
  type GlobalModelsConfig,
  type AgentBehaviorConfig,
  type RagConfig,
  type WebSearchConfig,
  type SummaryConfig,
  type ToolManagementConfig,
  type McpServerConfig,
  type HotkeyConfig
} from '@baishou/shared'
import { useAssistantStore } from './assistant.store'
import {
  ALL_SETTINGS_CONFIG_KEYS,
  fetchSettingsConfigKey,
  getConfigKeysForSegment,
  normalizeSettingsConfigKey,
  segmentNeedsConfigLoading,
  segmentHasConfigFailure,
  type SettingsConfigKey,
  type SettingsConfigSnapshot
} from '../settings-config.loader'

type SettingsStore = SettingsState & SettingsActions

const configLoadPromises = new Map<string, Promise<void>>()

let deferredWarmupGeneration = 0
let deferredWarmupTimer: ReturnType<typeof setTimeout> | null = null

const DEFERRED_WARMUP_DELAY_MS = 2500

function dedupeConfigLoad(batchKey: string, run: () => Promise<void>): Promise<void> {
  const existing = configLoadPromises.get(batchKey)
  if (existing) return existing
  const promise = run().finally(() => {
    configLoadPromises.delete(batchKey)
  })
  configLoadPromises.set(batchKey, promise)
  return promise
}

async function loadSingleConfigKey(
  key: SettingsConfigKey,
  get: () => SettingsStore,
  set: (
    partial: Partial<SettingsStore> | ((state: SettingsStore) => Partial<SettingsStore>)
  ) => void,
  options?: { trackGlobalLoading?: boolean }
): Promise<void> {
  return dedupeConfigLoad(key, async () => {
    const settingsApi = getSettingsApi()
    if (!settingsApi) return
    if (get().loadedConfigKeys.includes(key)) return

    const shouldTrackGlobalLoading = options?.trackGlobalLoading === true && !get().configHydrated

    set((state) => ({
      loadingConfigKeys: state.loadingConfigKeys.includes(key)
        ? state.loadingConfigKeys
        : [...state.loadingConfigKeys, key],
      ...(shouldTrackGlobalLoading ? { isLoading: true } : {})
    }))

    try {
      const patch = await fetchSettingsConfigKey(key, settingsApi)
      set((state) => {
        const mergedLoaded = [...new Set([...state.loadedConfigKeys, key])]
        const allLoaded = ALL_SETTINGS_CONFIG_KEYS.every((configKey) =>
          mergedLoaded.includes(configKey)
        )
        return {
          ...patch,
          loadedConfigKeys: mergedLoaded,
          loadingConfigKeys: state.loadingConfigKeys.filter((loadingKey) => loadingKey !== key),
          failedConfigKeys: state.failedConfigKeys.filter((failedKey) => failedKey !== key),
          configHydrated: allLoaded || state.configHydrated,
          ...(shouldTrackGlobalLoading && allLoaded ? { isLoading: false } : {})
        }
      })
    } catch (e) {
      console.error('[SettingsStore] Failed to load config from IPC', e)
      set((state) => ({
        loadingConfigKeys: state.loadingConfigKeys.filter((loadingKey) => loadingKey !== key),
        failedConfigKeys: [...new Set([...state.failedConfigKeys, key])],
        ...(shouldTrackGlobalLoading ? { isLoading: false } : {})
      }))
    }
  })
}

async function hydrateConfigSnapshot(
  keys: SettingsConfigKey[],
  get: () => SettingsStore,
  set: (
    partial: Partial<SettingsStore> | ((state: SettingsStore) => Partial<SettingsStore>)
  ) => void
): Promise<void> {
  const settingsApi = getSettingsApi()
  if (!settingsApi) return

  const missing = [...new Set(keys)].filter((key) => !get().loadedConfigKeys.includes(key))
  if (missing.length === 0) return

  return dedupeConfigLoad(`snapshot:${missing.join(',')}`, async () => {
    set((state) => ({
      loadingConfigKeys: [...new Set([...state.loadingConfigKeys, ...missing])]
    }))

    try {
      if (typeof settingsApi.getConfigSnapshot === 'function') {
        const snapshot: SettingsConfigSnapshot =
          (await settingsApi.getConfigSnapshot(missing)) ?? {}
        const loadedKeys: SettingsConfigKey[] = []
        const failedKeys: SettingsConfigKey[] = []
        let mergedPatch: Partial<SettingsStore> = {}

        for (const key of missing) {
          if (snapshot[key] === undefined) {
            failedKeys.push(key)
            continue
          }
          mergedPatch = { ...mergedPatch, ...normalizeSettingsConfigKey(key, snapshot[key]) }
          loadedKeys.push(key)
        }

        set((state) => {
          const mergedLoaded = [...new Set([...state.loadedConfigKeys, ...loadedKeys])]
          const allLoaded = ALL_SETTINGS_CONFIG_KEYS.every((configKey) =>
            mergedLoaded.includes(configKey)
          )
          return {
            ...mergedPatch,
            loadedConfigKeys: mergedLoaded,
            loadingConfigKeys: state.loadingConfigKeys.filter((key) => !missing.includes(key)),
            failedConfigKeys: [...new Set([...state.failedConfigKeys, ...failedKeys])],
            configHydrated: allLoaded || state.configHydrated
          }
        })
        return
      }

      const patches = await Promise.all(
        missing.map((key) => fetchSettingsConfigKey(key, settingsApi))
      )
      set((state) => {
        const mergedLoaded = [...new Set([...state.loadedConfigKeys, ...missing])]
        const allLoaded = ALL_SETTINGS_CONFIG_KEYS.every((configKey) =>
          mergedLoaded.includes(configKey)
        )
        return {
          ...Object.assign({}, ...patches),
          loadedConfigKeys: mergedLoaded,
          loadingConfigKeys: state.loadingConfigKeys.filter((key) => !missing.includes(key)),
          failedConfigKeys: state.failedConfigKeys.filter((key) => !missing.includes(key)),
          configHydrated: allLoaded || state.configHydrated
        }
      })
    } catch (e) {
      console.error('[SettingsStore] Failed to load config snapshot from IPC', e)
      set((state) => ({
        loadingConfigKeys: state.loadingConfigKeys.filter((key) => !missing.includes(key)),
        failedConfigKeys: [...new Set([...state.failedConfigKeys, ...missing])]
      }))
    }
  })
}

function scheduleDeferredConfigWarmup(
  get: () => SettingsStore,
  set: (
    partial: Partial<SettingsStore> | ((state: SettingsStore) => Partial<SettingsStore>)
  ) => void
): void {
  deferredWarmupGeneration += 1
  const generation = deferredWarmupGeneration

  if (deferredWarmupTimer) {
    clearTimeout(deferredWarmupTimer)
    deferredWarmupTimer = null
  }

  deferredWarmupTimer = setTimeout(() => {
    deferredWarmupTimer = null
    if (generation !== deferredWarmupGeneration) return

    const missing = ALL_SETTINGS_CONFIG_KEYS.filter((key) => !get().loadedConfigKeys.includes(key))
    if (missing.length === 0) return

    void hydrateConfigSnapshot(missing, get, set)
  }, DEFERRED_WARMUP_DELAY_MS)
}

function cancelDeferredConfigWarmup(): void {
  deferredWarmupGeneration += 1
  if (deferredWarmupTimer) {
    clearTimeout(deferredWarmupTimer)
    deferredWarmupTimer = null
  }
}

function getSettingsApi(): any | null {
  if (typeof window === 'undefined') return null
  return (window as any).api?.settings ?? null
}

export type AppThemeMode = 'light' | 'dark' | 'system'

export interface SettingsState {
  // --- UI Preferences ---
  themeMode: AppThemeMode
  useGlassmorphism: boolean
  locale: string
  themeColor: string

  // --- Domain Config Blocks ---
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

  // AI 设定异步操作
  loadConfig: (options?: { force?: boolean }) => Promise<void>
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

  // Provider Configs
  setProviders: (providers: AIProviderConfig[]) => Promise<void>
  updateProvider: (provider: AIProviderConfig) => Promise<void>
  patchProvider: (providerId: string, updates: Partial<AIProviderConfig>) => Promise<void>
  toggleProvider: (id: string, isEnabled: boolean) => Promise<void>

  // Domain Config Actions
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

export const useSettingsStore = create<SettingsStore>()(
  persist(
    devtools(
      (set, get) => ({
        themeMode: 'system',
        useGlassmorphism: true,
        locale: 'zh',
        themeColor: '#5BA8F5',

        providers: [],
        globalModels: null,
        agentBehavior: null,
        ragConfig: null,
        webSearchConfig: null,
        summaryConfig: null,
        toolManagementConfig: null,
        mcpServerConfig: null,
        hotkeyConfig: null,
        cloudSyncConfig: null,

        isLoading: false,
        configHydrated: false,
        loadedConfigKeys: [],
        loadingConfigKeys: [],
        failedConfigKeys: [],

        setThemeMode: (themeMode) => set({ themeMode }),
        toggleGlassmorphism: (useGlassmorphism) => set({ useGlassmorphism }),
        setThemeColor: (themeColor) => set({ themeColor }),
        setLocale: (locale) => {
          set({ locale })
          const resolvedUi =
            locale === 'system' ? resolveAppUiLanguageFromSystemLocale(navigator.language) : locale
          i18n.changeLanguage(resolvedUi)
          const summaryConfig = get().summaryConfig
          if (summaryConfig) {
            const { config: nextSummary, changed } = withSummaryPromptLocaleFromUi(
              summaryConfig,
              resolvedUi
            )
            if (changed) {
              void get().setSummaryConfig(nextSummary)
            }
          }

          if (typeof window !== 'undefined' && (window as any).api?.settings) {
            void (window as any).api.settings
              .getFeatures()
              .then((features: Record<string, unknown> | null) =>
                (window as any).api.settings.setFeatures({
                  ...(features || {}),
                  language: locale
                })
              )
              .catch((e: unknown) => console.warn('Failed to persist UI language', e))
          }

          if (typeof window !== 'undefined' && (window as any).api?.ensureDefaultLatteAssistant) {
            void (window as any).api
              .ensureDefaultLatteAssistant(resolvedUi)
              .then(() => (window as any).api.syncDefaultLatteLocale(resolvedUi))
              .then(() => useAssistantStore.getState().fetchAssistants())
              .catch((e: unknown) => console.warn('Failed to sync default Latte locale', e))
          }
        },

        loadConfig: async (options?: { force?: boolean }) => {
          const { loadedConfigKeys } = get()
          const allLoaded =
            loadedConfigKeys.length >= ALL_SETTINGS_CONFIG_KEYS.length &&
            ALL_SETTINGS_CONFIG_KEYS.every((key) => loadedConfigKeys.includes(key))
          if (allLoaded && !options?.force) {
            return
          }

          const missing = options?.force
            ? [...ALL_SETTINGS_CONFIG_KEYS]
            : ALL_SETTINGS_CONFIG_KEYS.filter((key) => !loadedConfigKeys.includes(key))
          if (missing.length === 0) return

          await get().ensureConfigKeys(missing, { trackGlobalLoading: true })
        },

        ensureConfigForSegment: async (segment: string) => {
          const keys = getConfigKeysForSegment(segment)
          if (keys.length === 0) return

          const { loadedConfigKeys, failedConfigKeys } = get()
          const missing = keys.filter(
            (key) => !loadedConfigKeys.includes(key) || failedConfigKeys.includes(key)
          )
          if (missing.length === 0) return

          await hydrateConfigSnapshot(missing, get, set)
        },

        retryConfigForSegment: async (segment: string) => {
          const keys = getConfigKeysForSegment(segment)
          if (keys.length === 0) return

          set({
            failedConfigKeys: get().failedConfigKeys.filter((key) => !keys.includes(key)),
            loadedConfigKeys: get().loadedConfigKeys.filter((key) => !keys.includes(key))
          })

          await hydrateConfigSnapshot(keys, get, set)
        },

        isSegmentConfigReady: (segment: string) => {
          return !segmentNeedsConfigLoading(segment, get().loadedConfigKeys)
        },

        isSegmentConfigFailed: (segment: string) => {
          const { failedConfigKeys, loadingConfigKeys } = get()
          const required = getConfigKeysForSegment(segment)
          if (required.length === 0) return false
          if (required.some((key) => loadingConfigKeys.includes(key))) return false
          return segmentHasConfigFailure(segment, failedConfigKeys)
        },

        resetSettingsConfigCache: () => {
          cancelDeferredConfigWarmup()
          set({
            loadedConfigKeys: [],
            loadingConfigKeys: [],
            failedConfigKeys: [],
            configHydrated: false,
            isLoading: false,
            providers: [],
            globalModels: null,
            agentBehavior: null,
            ragConfig: null,
            webSearchConfig: null,
            summaryConfig: null,
            toolManagementConfig: null,
            mcpServerConfig: null,
            hotkeyConfig: null,
            cloudSyncConfig: null
          })
        },

        ensureConfigKeys: async (
          keys: SettingsConfigKey[],
          options?: { trackGlobalLoading?: boolean }
        ) => {
          const uniqueKeys = [...new Set(keys)]
          const toLoad = uniqueKeys.filter((key) => !get().loadedConfigKeys.includes(key))
          if (toLoad.length === 0) return

          await Promise.all(toLoad.map((key) => loadSingleConfigKey(key, get, set, options)))
        },

        scheduleDeferredConfigWarmup: () => {
          scheduleDeferredConfigWarmup(get, set)
        },

        cancelDeferredConfigWarmup: () => {
          cancelDeferredConfigWarmup()
        },

        setProviders: async (providers) => {
          set({ providers })
          if (typeof window !== 'undefined' && (window as any).api?.settings) {
            await (window as any).api.settings.setProviders(providers)
            const updatedGlobalModels = await (window as any).api.settings.getGlobalModels()
            if (updatedGlobalModels) set({ globalModels: updatedGlobalModels })
          }
        },

        patchProvider: async (providerId, updates) => {
          if (typeof window !== 'undefined' && (window as any).api?.settings?.patchProvider) {
            const patch: Record<string, unknown> = {}
            if (updates.name !== undefined) patch.name = updates.name
            if (updates.type !== undefined) patch.type = updates.type
            if (updates.isSystem !== undefined) patch.isSystem = updates.isSystem
            if (updates.sortOrder !== undefined) patch.sortOrder = updates.sortOrder
            if (updates.isEnabled !== undefined) patch.enabled = updates.isEnabled
            if (updates.apiKey !== undefined) patch.apiKey = updates.apiKey
            if (updates.baseUrl !== undefined) patch.apiBaseUrl = updates.baseUrl
            if (updates.models !== undefined) patch.models = updates.models
            if (updates.enabledModels !== undefined) patch.enabledModels = updates.enabledModels
            if (updates.defaultDialogueModel !== undefined) {
              patch.defaultDialogueModel = updates.defaultDialogueModel
            }
            if (updates.defaultNamingModel !== undefined) {
              patch.defaultNamingModel = updates.defaultNamingModel
            }

            if (Object.keys(patch).length === 0) return

            await (window as any).api.settings.patchProvider(providerId, patch)
            const refreshed = await (window as any).api.settings.getProviders()
            set({ providers: refreshed || [] })
            const updatedGlobalModels = await (window as any).api.settings.getGlobalModels()
            if (updatedGlobalModels) set({ globalModels: updatedGlobalModels })
          }
        },

        updateProvider: async (provider) => {
          await get().patchProvider(provider.id, provider)
        },

        toggleProvider: async (id, isEnabled) => {
          const { providers, updateProvider } = get()
          const provider = providers.find((p) => p.id === id)
          if (provider) {
            await updateProvider({ ...provider, isEnabled })
          }
        },

        setGlobalModels: async (config) => {
          set({ globalModels: config })
          if (typeof window !== 'undefined' && (window as any).api?.settings) {
            await (window as any).api.settings.setGlobalModels(config)
          }
        },

        setAgentBehaviorConfig: async (config) => {
          set({ agentBehavior: config })
          if (typeof window !== 'undefined' && (window as any).api?.settings) {
            await (window as any).api.settings.setAgentBehaviorConfig(config)
          }
        },

        setRagConfig: async (config) => {
          set({ ragConfig: config })
          if (typeof window !== 'undefined' && (window as any).api?.settings) {
            await (window as any).api.settings.setRagConfig(config)
          }
        },

        setWebSearchConfig: async (config) => {
          set({ webSearchConfig: config })
          if (typeof window !== 'undefined' && (window as any).api?.settings) {
            await (window as any).api.settings.setWebSearchConfig(config)
          }
        },

        setSummaryConfig: async (config) => {
          set({ summaryConfig: config })
          if (typeof window !== 'undefined' && (window as any).api?.settings) {
            await (window as any).api.settings.setSummaryConfig(config)
          }
        },

        setToolManagementConfig: async (config) => {
          set({ toolManagementConfig: config })
          if (typeof window !== 'undefined' && (window as any).api?.settings) {
            await (window as any).api.settings.setToolManagementConfig(config)
          }
        },

        setMcpServerConfig: async (config) => {
          set({ mcpServerConfig: config })
          if (typeof window !== 'undefined' && (window as any).api?.settings) {
            const saved = await (window as any).api.settings.setMcpServerConfig(config)
            if (saved) set({ mcpServerConfig: saved })
          }
        },

        refreshMcpAuthToken: async () => {
          if (typeof window !== 'undefined' && (window as any).api?.settings?.refreshMcpAuthToken) {
            const saved = await (window as any).api.settings.refreshMcpAuthToken()
            if (saved) set({ mcpServerConfig: saved })
          }
        },

        setHotkeyConfig: async (config) => {
          set({ hotkeyConfig: config })
          if (typeof window !== 'undefined' && (window as any).api?.settings) {
            const result = await (window as any).api.settings.setHotkeyConfig(config)
            if (config.hotkeyEnabled && result?.registered === false) {
              console.warn(
                '[SettingsStore] Global hotkey registration failed; combo may be reserved or used by another app.'
              )
            }
          }
        },

        setCloudSyncConfig: async (config) => {
          set({ cloudSyncConfig: config })
          if (typeof window !== 'undefined' && (window as any).api?.settings) {
            if (typeof (window as any).api.settings.setCloudSyncConfig === 'function') {
              await (window as any).api.settings.setCloudSyncConfig(config)
            } else {
              console.warn(
                '[SettingsStore] setCloudSyncConfig missing in preload, skipping ipc update'
              )
            }
          }
        }
      }),
      { name: 'SettingsStore' }
    ),
    {
      name: 'baishou-ui-settings-storage',
      partialize: (state) => ({
        themeMode: state.themeMode,
        useGlassmorphism: state.useGlassmorphism,
        locale: state.locale,
        themeColor: state.themeColor
      })
    }
  )
)
