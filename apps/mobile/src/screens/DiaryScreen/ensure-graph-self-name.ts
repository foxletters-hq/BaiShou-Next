import {
  applyGraphAwakenToProfile,
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  getUserProfileFromSettings,
  isGraphAwakenProfileComplete,
  saveUserProfileToSettings,
  type UserGender,
  type UserProfile,
  type UserProfileSettingsStore
} from '@baishou/shared'

export type GraphAwakenProfileFields = {
  nickname: string
  birthday: string
  gender: UserGender
}

export async function loadMobileGraphAwakenSelfName(
  settingsManager: Pick<UserProfileSettingsStore, 'get' | 'set'>
): Promise<{
  ready: boolean
  selfName: string | null
  profile: UserProfile
  flag: boolean
}> {
  const flag =
    (await settingsManager.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)) === true
  const profile = await getUserProfileFromSettings(settingsManager)
  if (isGraphAwakenProfileComplete(flag, profile)) {
    return { ready: true, selfName: profile.nickname.trim(), profile, flag }
  }
  return { ready: false, selfName: null, profile, flag }
}

export async function saveMobileGraphAwakenProfile(
  settingsManager: Pick<UserProfileSettingsStore, 'get' | 'set'>,
  fields: GraphAwakenProfileFields
): Promise<string> {
  const current = await getUserProfileFromSettings(settingsManager)
  const next = applyGraphAwakenToProfile(current, fields)
  await saveUserProfileToSettings(settingsManager, next)
  await settingsManager.set(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY, true)
  return next.nickname.trim()
}

/** 抽取前检查唤醒状态（不再弹窗） */
export async function ensureMobileGraphSelfName(opts: {
  settingsManager: Pick<UserProfileSettingsStore, 'get' | 'set'>
}): Promise<string | null> {
  const { ready, selfName } = await loadMobileGraphAwakenSelfName(opts.settingsManager)
  return ready ? selfName : null
}
