import {
  ALL_SETTINGS_CONFIG_KEYS,
  fetchSettingsConfigKey,
  normalizeSettingsConfigKey,
  type SettingsConfigKey,
  type SettingsConfigSnapshot
} from '../settings-config.loader'
import type { SettingsStore } from './settings.store.types'

const configLoadPromises = new Map<string, Promise<void>>()

let deferredWarmupGeneration = 0
let deferredWarmupTimer: ReturnType<typeof setTimeout> | null = null

const DEFERRED_WARMUP_DELAY_MS = 2500

export type SettingsStoreSetter = (
  partial: Partial<SettingsStore> | ((state: SettingsStore) => Partial<SettingsStore>)
) => void

export function getSettingsApi(): any | null {
  if (typeof window === 'undefined') return null
  return (window as any).api?.settings ?? null
}

function dedupeConfigLoad(batchKey: string, run: () => Promise<void>): Promise<void> {
  const existing = configLoadPromises.get(batchKey)
  if (existing) return existing
  const promise = run().finally(() => {
    configLoadPromises.delete(batchKey)
  })
  configLoadPromises.set(batchKey, promise)
  return promise
}

export async function loadSingleConfigKey(
  key: SettingsConfigKey,
  get: () => SettingsStore,
  set: SettingsStoreSetter,
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

export async function hydrateConfigSnapshot(
  keys: SettingsConfigKey[],
  get: () => SettingsStore,
  set: SettingsStoreSetter
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

export function scheduleDeferredConfigWarmup(
  get: () => SettingsStore,
  set: SettingsStoreSetter
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

export function cancelDeferredConfigWarmup(): void {
  deferredWarmupGeneration += 1
  if (deferredWarmupTimer) {
    clearTimeout(deferredWarmupTimer)
    deferredWarmupTimer = null
  }
}
