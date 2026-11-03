import { beforeEach, describe, expect, it, vi } from 'vitest'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DEFAULT_USER_PROFILE } from '@baishou/shared'
import { AGENT_USER_PROFILE_SNAPSHOT_KEY, ONBOARDING_NICKNAME_KEY } from '../../constants/storage'
import {
  invalidateAgentUserProfileCache,
  mapSettingsToAgentUserProfile,
  peekAgentUserProfileCache,
  readPersistedAgentUserProfileSnapshot,
  setAgentUserProfileCache
} from '../agent-user-profile.util'

vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>()
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        store.set(key, value)
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key)
      }),
      clear: vi.fn(async () => {
        store.clear()
      })
    }
  }
})

vi.mock('../chat-background-display.util', () => ({
  resolveChatBackgroundForMobileUi: vi.fn()
}))

vi.mock('../user-avatar-display.util', () => ({
  resolveUserAvatarForMobileUi: vi.fn()
}))

describe('agent-user-profile.util snapshot & caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateAgentUserProfileCache()
  })

  it('mapSettingsToAgentUserProfile defaults to DEFAULT_USER_PROFILE.nickname instead of "你"', () => {
    const profile = mapSettingsToAgentUserProfile(null)
    expect(profile.nickname).toBe(DEFAULT_USER_PROFILE.nickname)
    expect(profile.nickname).not.toBe('你')
    expect(profile.isReady).toBe(true)
  })

  it('sets in-memory cache and triggers AsyncStorage persistence', async () => {
    setAgentUserProfileCache({
      nickname: '测试用户',
      isReady: true
    })

    expect(peekAgentUserProfileCache()?.nickname).toBe('测试用户')
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      AGENT_USER_PROFILE_SNAPSHOT_KEY,
      expect.stringContaining('测试用户')
    )
  })

  it('reads snapshot from AsyncStorage when available', async () => {
    await AsyncStorage.setItem(
      AGENT_USER_PROFILE_SNAPSHOT_KEY,
      JSON.stringify({
        nickname: '持久化用户',
        chatBackgroundBlur: 10
      })
    )

    const snapshot = await readPersistedAgentUserProfileSnapshot()
    expect(snapshot).not.toBeNull()
    expect(snapshot?.nickname).toBe('持久化用户')
    expect(snapshot?.isReady).toBe(true)
  })

  it('falls back to onboarding nickname if snapshot is absent', async () => {
    await AsyncStorage.removeItem(AGENT_USER_PROFILE_SNAPSHOT_KEY)
    await AsyncStorage.setItem(ONBOARDING_NICKNAME_KEY, '引导用户')

    const snapshot = await readPersistedAgentUserProfileSnapshot()
    expect(snapshot?.nickname).toBe('引导用户')
    expect(snapshot?.isReady).toBe(true)
  })

  it('clears in-memory and persistent cache on invalidate', async () => {
    setAgentUserProfileCache({ nickname: '待清除', isReady: true })
    invalidateAgentUserProfileCache()

    expect(peekAgentUserProfileCache()).toBeNull()
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(AGENT_USER_PROFILE_SNAPSHOT_KEY)
  })
})
