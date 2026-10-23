import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  DEFAULT_SYNC_TRAFFIC_PROMPT_ENABLED,
  DEFAULT_SYNC_TRAFFIC_THRESHOLD_MB
} from '@baishou/shared'

const STORAGE_KEY = 'baishou_sync_traffic_settings'

export interface SyncTrafficSettings {
  /** 移动数据超阈值时是否提示；默认开 */
  enabled: boolean
  /** 提示阈值（MB）；默认 50 */
  thresholdMb: number
}

const DEFAULT_SETTINGS: SyncTrafficSettings = {
  enabled: DEFAULT_SYNC_TRAFFIC_PROMPT_ENABLED,
  thresholdMb: DEFAULT_SYNC_TRAFFIC_THRESHOLD_MB
}

let memoryCache: SyncTrafficSettings | null = null

export function normalizeSyncTrafficSettings(
  raw: Partial<SyncTrafficSettings> | null | undefined
): SyncTrafficSettings {
  const enabled =
    typeof raw?.enabled === 'boolean' ? raw.enabled : DEFAULT_SYNC_TRAFFIC_PROMPT_ENABLED
  const parsed =
    typeof raw?.thresholdMb === 'number' && Number.isFinite(raw.thresholdMb)
      ? Math.floor(raw.thresholdMb)
      : DEFAULT_SYNC_TRAFFIC_THRESHOLD_MB
  const thresholdMb = Math.max(1, Math.min(10240, parsed))
  return { enabled, thresholdMb }
}

export async function getSyncTrafficSettings(): Promise<SyncTrafficSettings> {
  if (memoryCache) return memoryCache
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) {
      memoryCache = { ...DEFAULT_SETTINGS }
      return memoryCache
    }
    memoryCache = normalizeSyncTrafficSettings(JSON.parse(raw) as Partial<SyncTrafficSettings>)
    return memoryCache
  } catch {
    memoryCache = { ...DEFAULT_SETTINGS }
    return memoryCache
  }
}

export async function saveSyncTrafficSettings(
  next: Partial<SyncTrafficSettings>
): Promise<SyncTrafficSettings> {
  const current = await getSyncTrafficSettings()
  const merged = normalizeSyncTrafficSettings({ ...current, ...next })
  memoryCache = merged
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // 内存缓存仍可用
  }
  return merged
}

/** 仅测试用：清空内存缓存 */
export function clearSyncTrafficSettingsCacheForTests(): void {
  memoryCache = null
}
