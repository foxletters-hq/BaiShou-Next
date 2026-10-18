import { beforeEach, describe, expect, it, vi } from 'vitest'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  DEFAULT_USER_PROFILE,
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  USER_PROFILE_SETTINGS_KEY
} from '@baishou/shared'
import {
  ONBOARDING_NICKNAME_KEY,
  ONBOARDING_BIRTHDAY_KEY,
  ONBOARDING_GENDER_KEY
} from '../../constants/storage'
import {
  normalizeOnboardingNickname,
  persistOnboardingNickname,
  readOnboardingNickname,
  syncOnboardingNicknameToVault,
  persistOnboardingProfile,
  readOnboardingProfile,
  syncOnboardingProfileToVault
} from '../onboarding-nickname.util'

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
}))

describe('onboarding nickname util', () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockReset()
    vi.mocked(AsyncStorage.setItem).mockReset()
    vi.mocked(AsyncStorage.removeItem).mockReset()
  })

  it('should reject the default profile nickname', () => {
    expect(normalizeOnboardingNickname(DEFAULT_USER_PROFILE.nickname)).toBe(null)
    expect(normalizeOnboardingNickname('  小明  ')).toBe('小明')
  })

  it('should persist a trimmed custom nickname', async () => {
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined)
    await expect(persistOnboardingNickname('  阿守  ')).resolves.toBe('阿守')
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_NICKNAME_KEY, '阿守')
  })

  it('should read a persisted nickname', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue('阿守')
    await expect(readOnboardingNickname()).resolves.toBe('阿守')
  })

  it('should write nickname and self-name flag into vault settings', async () => {
    const data: Record<string, unknown> = {
      [USER_PROFILE_SETTINGS_KEY]: { ...DEFAULT_USER_PROFILE }
    }
    const store = {
      get: async <T>(key: string) => (key in data ? (data[key] as T) : null),
      set: async <T>(key: string, value: T) => {
        data[key] = value
      }
    }
    await syncOnboardingNicknameToVault('阿守', store)
    const profile = data[USER_PROFILE_SETTINGS_KEY] as { nickname: string }
    expect(profile.nickname).toBe('阿守')
    expect(data[GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY]).toBe(true)
  })

  it('should persist and read onboarding profile with birthday and gender', async () => {
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined)
    const saved = await persistOnboardingProfile({
      nickname: '  阿守  ',
      birthday: ' 2000-01-01 ',
      gender: 'male'
    })
    expect(saved).toEqual({
      nickname: '阿守',
      birthday: '2000-01-01',
      gender: 'male',
      customGender: null
    })
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_NICKNAME_KEY, '阿守')
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_BIRTHDAY_KEY, '2000-01-01')
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_GENDER_KEY, 'male')

    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key: string) => {
      if (key === ONBOARDING_NICKNAME_KEY) return '阿守'
      if (key === ONBOARDING_BIRTHDAY_KEY) return '2000-01-01'
      if (key === ONBOARDING_GENDER_KEY) return 'male'
      return null
    })

    const loaded = await readOnboardingProfile()
    expect(loaded).toEqual({
      nickname: '阿守',
      birthday: '2000-01-01',
      gender: 'male',
      customGender: null
    })
  })

  it('should persist and sync custom gender when gender is other', async () => {
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined)
    const saved = await persistOnboardingProfile({
      nickname: '阿守',
      birthday: '2000-01-01',
      gender: 'other',
      customGender: ' 沃尔玛购物袋 '
    })
    expect(saved).toEqual({
      nickname: '阿守',
      birthday: '2000-01-01',
      gender: 'other',
      customGender: '沃尔玛购物袋'
    })
  })

  it('should sync full profile to vault settings', async () => {
    const data: Record<string, unknown> = {
      [USER_PROFILE_SETTINGS_KEY]: { ...DEFAULT_USER_PROFILE }
    }
    const store = {
      get: async <T>(key: string) => (key in data ? (data[key] as T) : null),
      set: async <T>(key: string, value: T) => {
        data[key] = value
      }
    }
    await syncOnboardingProfileToVault(
      {
        nickname: '阿守',
        birthday: '1998-05-20',
        gender: 'female'
      },
      store
    )
    const profile = data[USER_PROFILE_SETTINGS_KEY] as {
      nickname: string
      birthday: string
      gender: string
    }
    expect(profile.nickname).toBe('阿守')
    expect(profile.birthday).toBe('1998-05-20')
    expect(profile.gender).toBe('female')
    expect(data[GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY]).toBe(true)
  })
})
