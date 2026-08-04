import {
  isDefaultGraphSelfName,
  isGraphSelfNameConfigured,
  type UserProfile
} from '@baishou/shared'

type DialogPrompt = (
  message: React.ReactNode,
  defaultValue?: string,
  title?: string,
  isMultiline?: boolean
) => Promise<string | null>

/**
 * 抽取前确保自称已确认：未配置则弹窗填昵称，写入 profile + graphSelfNameConfigured。
 * @returns 可用于抽取的自称；用户取消或无效输入时返回 null
 */
export async function ensureDesktopGraphSelfName(opts: {
  prompt: DialogPrompt
  t: (key: string, fallback: string) => string
}): Promise<string | null> {
  const flag = (await (window.api.settings as any).getGraphSelfNameConfigured?.()) === true
  const profile = (((await (window.api as any).profile?.getProfile?.()) || {}) as UserProfile)
  if (isGraphSelfNameConfigured(flag, profile.nickname)) {
    return profile.nickname.trim()
  }

  const initial = isDefaultGraphSelfName(profile.nickname) ? '' : (profile.nickname?.trim() ?? '')
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

  await (window.api as any).profile?.saveProfile?.({ ...profile, nickname: name })
  await (window.api.settings as any).setGraphSelfNameConfigured?.(true)
  return name
}
