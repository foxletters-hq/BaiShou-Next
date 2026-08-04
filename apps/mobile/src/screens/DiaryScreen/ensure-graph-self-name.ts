import {
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  getUserProfileFromSettings,
  isDefaultGraphSelfName,
  isGraphSelfNameConfigured,
  saveUserProfileToSettings,
  type UserProfileSettingsStore
} from '@baishou/shared'

type PromptFn = (
  message: React.ReactNode,
  defaultValue?: string,
  title?: string,
  isMultiline?: boolean
) => Promise<string | null>

/**
 * 移动端抽取前确保自称已确认。
 * @returns 自称；取消或无效则 null
 */
export async function ensureMobileGraphSelfName(opts: {
  settingsManager: Pick<UserProfileSettingsStore, 'get' | 'set'>
  prompt: PromptFn
  t: (key: string, fallback: string) => string
}): Promise<string | null> {
  const flag =
    (await opts.settingsManager.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)) === true
  const profile = await getUserProfileFromSettings(opts.settingsManager)
  if (isGraphSelfNameConfigured(flag, profile.nickname)) {
    return profile.nickname.trim()
  }

  const initial = isDefaultGraphSelfName(profile.nickname) ? '' : profile.nickname.trim()
  const input = await opts.prompt(
    opts.t(
      'graph.self_name_desc',
      '图谱抽取需要知道日记里的「我」是谁。请填写你希望出现在关系图谱中的名字。'
    ),
    initial,
    opts.t('graph.self_name_title', '设置你的自称')
  )
  const name = input?.trim() ?? ''
  if (!name || isDefaultGraphSelfName(name)) {
    return null
  }

  await saveUserProfileToSettings(opts.settingsManager, {
    ...profile,
    nickname: name
  })
  await opts.settingsManager.set(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY, true)
  return name
}
