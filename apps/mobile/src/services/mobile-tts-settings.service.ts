import AsyncStorage from '@react-native-async-storage/async-storage'
import type { SettingsManagerService } from '@baishou/core-mobile'

const TTS_PLAYBACK_CACHE_KEY = 'baishou_tts_playback_cache'

export interface TtsPlaybackSettings {
  globalModels: Record<string, unknown> | null
  providers: Record<string, unknown>[]
}

let memoryCache: TtsPlaybackSettings | null = null

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function setTtsPlaybackSettingsCache(settings: TtsPlaybackSettings): void {
  memoryCache = settings
  void AsyncStorage.setItem(TTS_PLAYBACK_CACHE_KEY, JSON.stringify(settings)).catch(() => {})
}

export function clearTtsPlaybackSettingsCache(): void {
  memoryCache = null
}

async function readFromDiskCache(): Promise<TtsPlaybackSettings | null> {
  try {
    const raw = await AsyncStorage.getItem(TTS_PLAYBACK_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TtsPlaybackSettings
  } catch {
    return null
  }
}

/**
 * 读取 TTS 播放所需配置。流式聊天期间 SQLite 可能繁忙，优先内存/磁盘缓存并带重试。
 */
export async function getTtsPlaybackSettings(
  settingsManager: SettingsManagerService
): Promise<TtsPlaybackSettings> {
  if (memoryCache) return memoryCache

  const maxAttempts = 5
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const globalModels = (await settingsManager.get<Record<string, unknown>>('global_models')) || null
      const providers = (await settingsManager.get<Record<string, unknown>[]>('ai_providers')) || []
      const settings: TtsPlaybackSettings = { globalModels, providers }
      setTtsPlaybackSettingsCache(settings)
      return settings
    } catch (error) {
      const isLast = attempt === maxAttempts - 1
      if (isLast) {
        const cached = await readFromDiskCache()
        if (cached) {
          memoryCache = cached
          return cached
        }
        throw error
      }
      await sleep(80 * (attempt + 1))
    }
  }

  throw new Error('Failed to load TTS settings')
}
