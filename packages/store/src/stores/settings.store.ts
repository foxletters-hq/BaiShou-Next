import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import {
  i18n,
  normalizeUiFontSizeLevel,
  resolveAppUiLanguageFromSystemLocale,
  UI_FONT_SIZE_LEVEL_DEFAULT,
  UI_SETTINGS_STORAGE_KEY,
  withSummaryPromptLocaleFromUi,
  type AIProviderConfig,
  type EmojiToolConfig,
  EMOJI_TOOL_CONFIG_UPDATED_EVENT
} from '@baishou/shared'
import { useAssistantStore } from './assistant.store'
import {
  ALL_SETTINGS_CONFIG_KEYS,
  getConfigKeysForSegment,
  segmentNeedsConfigLoading,
  segmentHasConfigFailure,
  type SettingsConfigKey
} from '../settings-config.loader'
import {
  cancelDeferredConfigWarmup,
  hydrateConfigSnapshot,
  loadSingleConfigKey,
  scheduleDeferredConfigWarmup
} from './settings.store.hydrate'
import type { SettingsState, SettingsStore } from './settings.store.types'

export type { AppThemeMode, SettingsActions, SettingsState } from './settings.store.types'

export const useSettingsStore = create<SettingsStore>()(
  persist(
    devtools(
      (set, get) => ({
        themeMode: 'system',
        useGlassmorphism: true,
        locale: 'zh',
        themeColor: '#5BA8F5',
        fontSizeLevel: UI_FONT_SIZE_LEVEL_DEFAULT,

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
        setFontSizeLevel: (level) => set({ fontSizeLevel: normalizeUiFontSizeLevel(level) }),
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

          if (options?.force) {
            await get().reloadConfigKeys([...ALL_SETTINGS_CONFIG_KEYS])
            return
          }

          const missing = ALL_SETTINGS_CONFIG_KEYS.filter((key) => !loadedConfigKeys.includes(key))
          if (missing.length === 0) return

          await get().ensureConfigKeys(missing, { trackGlobalLoading: true })
        },

        reloadConfigKeys: async (keys: SettingsConfigKey[]) => {
          const uniqueKeys = [...new Set(keys)]
          if (uniqueKeys.length === 0) return

          set({
            failedConfigKeys: get().failedConfigKeys.filter((key) => !uniqueKeys.includes(key)),
            loadedConfigKeys: get().loadedConfigKeys.filter((key) => !uniqueKeys.includes(key))
          })

          await hydrateConfigSnapshot(uniqueKeys, get, set)
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
          const provider = providers.find((p: AIProviderConfig) => p.id === id)
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
      name: UI_SETTINGS_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        themeMode: state.themeMode,
        useGlassmorphism: state.useGlassmorphism,
        locale: state.locale,
        themeColor: state.themeColor,
        fontSizeLevel: normalizeUiFontSizeLevel(state.fontSizeLevel)
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>
        return {
          ...current,
          ...p,
          fontSizeLevel: normalizeUiFontSizeLevel(
            p.fontSizeLevel !== undefined ? p.fontSizeLevel : current.fontSizeLevel
          )
        }
      }
    }
  )
)

if (typeof window !== 'undefined') {
  window.addEventListener(EMOJI_TOOL_CONFIG_UPDATED_EVENT, (event) => {
    const emojiConfig = (event as CustomEvent<EmojiToolConfig>).detail
    if (!emojiConfig) return
    const current = useSettingsStore.getState().toolManagementConfig
    if (!current) return
    useSettingsStore.setState({
      toolManagementConfig: { ...current, emojiConfig }
    })
  })
}
