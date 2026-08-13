import {
  applyGraphAwakenToProfile,
  isGraphAwakenProfileComplete,
  type UserGender,
  type UserProfile
} from '@baishou/shared'

export type GraphAwakenProfileFields = {
  nickname: string
  birthday: string
  gender: UserGender
}

async function getDesktopProfile(): Promise<UserProfile> {
  return (((await (window.api as any).profile?.getProfile?.()) || {}) as UserProfile)
}

async function saveDesktopProfile(profile: UserProfile): Promise<void> {
  await (window.api as any).profile?.saveProfile?.(profile)
}

/** 读取当前图谱唤醒状态；已完成则返回自称，否则 null */
export async function loadDesktopGraphAwakenSelfName(): Promise<{
  ready: boolean
  selfName: string | null
  profile: UserProfile
  flag: boolean
}> {
  const flag = (await window.api.settings.getGraphSelfNameConfigured()) === true
  const profile = await getDesktopProfile()
  if (isGraphAwakenProfileComplete(flag, profile)) {
    return { ready: true, selfName: profile.nickname.trim(), profile, flag }
  }
  return { ready: false, selfName: null, profile, flag }
}

/** 保存唤醒资料并标记已配置 */
export async function saveDesktopGraphAwakenProfile(
  fields: GraphAwakenProfileFields
): Promise<string> {
  const current = await getDesktopProfile()
  const next = applyGraphAwakenToProfile(current, fields)
  await saveDesktopProfile(next)
  await window.api.settings.setGraphSelfNameConfigured(true)
  return next.nickname.trim()
}

/**
 * 抽取前检查唤醒状态（不再弹窗）。
 * 未完成时返回 null，由调用方引导至图谱唤醒页。
 */
export async function ensureDesktopGraphSelfName(): Promise<string | null> {
  const { ready, selfName } = await loadDesktopGraphAwakenSelfName()
  return ready ? selfName : null
}
