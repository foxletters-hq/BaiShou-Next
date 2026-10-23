import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  getUserProfileFromSettings,
  normalizeGraphAwakenNickname,
  saveUserProfileToSettings,
  type UserGender,
  type UserProfileSettingsStore
} from '@baishou/shared'
import {
  ONBOARDING_NICKNAME_KEY,
  ONBOARDING_BIRTHDAY_KEY,
  ONBOARDING_GENDER_KEY,
  ONBOARDING_CUSTOM_GENDER_KEY
} from '../constants/storage'

export interface OnboardingProfileInput {
  nickname: string
  birthday?: string | null
  gender?: UserGender | null
  customGender?: string | null
}

export interface PersistedOnboardingProfile {
  nickname: string | null
  birthday: string | null
  gender: UserGender | null
  customGender?: string | null
}

export function normalizeOnboardingNickname(raw: string | null | undefined): string | null {
  return normalizeGraphAwakenNickname(raw)
}

export async function persistOnboardingNickname(nickname: string): Promise<string | null> {
  const name = normalizeOnboardingNickname(nickname)
  if (!name) return null
  await AsyncStorage.setItem(ONBOARDING_NICKNAME_KEY, name)
  return name
}

export async function readOnboardingNickname(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(ONBOARDING_NICKNAME_KEY)
  return normalizeOnboardingNickname(raw)
}

export async function persistOnboardingProfile(profile: OnboardingProfileInput): Promise<{
  nickname: string
  birthday: string | null
  gender: UserGender | null
  customGender: string | null
} | null> {
  const name = normalizeOnboardingNickname(profile.nickname)
  if (!name) return null
  await AsyncStorage.setItem(ONBOARDING_NICKNAME_KEY, name)

  const birthday = profile.birthday ? profile.birthday.trim() : null
  if (birthday) {
    await AsyncStorage.setItem(ONBOARDING_BIRTHDAY_KEY, birthday)
  } else {
    await AsyncStorage.removeItem(ONBOARDING_BIRTHDAY_KEY)
  }

  const gender = profile.gender ?? null
  if (gender) {
    await AsyncStorage.setItem(ONBOARDING_GENDER_KEY, gender)
  } else {
    await AsyncStorage.removeItem(ONBOARDING_GENDER_KEY)
  }

  const customGender =
    gender === 'other' && profile.customGender?.trim() ? profile.customGender.trim() : null
  if (customGender) {
    await AsyncStorage.setItem(ONBOARDING_CUSTOM_GENDER_KEY, customGender)
  } else {
    await AsyncStorage.removeItem(ONBOARDING_CUSTOM_GENDER_KEY)
  }

  return { nickname: name, birthday, gender, customGender }
}

export async function readOnboardingProfile(): Promise<PersistedOnboardingProfile> {
  const [rawName, rawBirthday, rawGender, rawCustomGender] = await Promise.all([
    AsyncStorage.getItem(ONBOARDING_NICKNAME_KEY),
    AsyncStorage.getItem(ONBOARDING_BIRTHDAY_KEY),
    AsyncStorage.getItem(ONBOARDING_GENDER_KEY),
    AsyncStorage.getItem(ONBOARDING_CUSTOM_GENDER_KEY)
  ])
  const gender = (rawGender as UserGender) || null
  const customGender = gender === 'other' && rawCustomGender?.trim() ? rawCustomGender.trim() : null
  return {
    nickname: normalizeOnboardingNickname(rawName),
    birthday: rawBirthday ? rawBirthday.trim() : null,
    gender,
    customGender
  }
}

export async function syncOnboardingNicknameToVault(
  nickname: string,
  settingsManager: Pick<UserProfileSettingsStore, 'get' | 'set'>
): Promise<void> {
  await syncOnboardingProfileToVault({ nickname }, settingsManager)
}

export async function syncOnboardingProfileToVault(
  profile: OnboardingProfileInput,
  settingsManager: Pick<UserProfileSettingsStore, 'get' | 'set'>
): Promise<void> {
  const name = normalizeOnboardingNickname(profile.nickname)
  if (!name) return
  const current = await getUserProfileFromSettings(settingsManager)
  const nextBirthday =
    profile.birthday !== undefined ? profile.birthday?.trim() || null : current.birthday
  const nextGender = profile.gender !== undefined ? (profile.gender ?? null) : current.gender
  const nextCustomGender =
    nextGender === 'other'
      ? profile.customGender !== undefined
        ? profile.customGender?.trim() || null
        : (current.customGender ?? null)
      : null

  if (
    current.nickname.trim() !== name ||
    current.birthday !== nextBirthday ||
    current.gender !== nextGender ||
    (current.customGender ?? null) !== nextCustomGender
  ) {
    await saveUserProfileToSettings(settingsManager, {
      ...current,
      nickname: name,
      birthday: nextBirthday,
      gender: nextGender,
      customGender: nextCustomGender
    })
  }
  await settingsManager.set(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY, true)
}
