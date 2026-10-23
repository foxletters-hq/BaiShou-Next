import type { UserGender, UserProfile } from '../types/user-profile.types'

export const USER_GENDER_LABELS: Record<UserGender, string> = {
  male: '男',
  female: '女',
  other: '自定义',
  unspecified: '暂不设置'
}

/**
 * 将用户身份卡格式化为 system prompt 中的 userCard 块（与桌面端 buildStreamConfig 对齐）。
 */
export function formatUserCardFromProfile(
  profile: UserProfile | null | undefined
): string | undefined {
  if (!profile) return undefined

  const items: string[] = []

  // 当允许向伙伴分享身份信息时（默认为 true），包含生日与性别
  const shareBirthdayAndGender = profile.shareIdentityWithCompanion !== false

  const hasValidProfileGender = Boolean(profile.gender && profile.gender !== 'unspecified')

  if (shareBirthdayAndGender) {
    if (profile.birthday && profile.birthday.trim().length > 0) {
      items.push(`- 生日: ${profile.birthday.trim()}`)
    }
    if (hasValidProfileGender && profile.gender) {
      const genderLabel =
        profile.gender === 'other' && profile.customGender?.trim()
          ? profile.customGender.trim()
          : USER_GENDER_LABELS[profile.gender]
      if (genderLabel) {
        items.push(`- 性别: ${genderLabel}`)
      }
    }
  }

  const activePersona = profile.activePersonaId
    ? profile.personas?.[profile.activePersonaId]
    : undefined

  if (activePersona?.facts) {
    for (const [key, value] of Object.entries(activePersona.facts)) {
      const trimmedVal = value?.trim()
      if (!trimmedVal) continue
      const isBirthdayOrGenderKey =
        key === '生日' ||
        key === '性别' ||
        key.toLowerCase() === 'birthday' ||
        key.toLowerCase() === 'gender'
      // 若关闭了生日与性别同步，则 facts 中的生日/性别也一并排除，确保隐私一致
      if (!shareBirthdayAndGender && isBirthdayOrGenderKey) {
        continue
      }
      // 开启时避免与前面主资料注入的生日/性别重复
      if (shareBirthdayAndGender) {
        if (key === '生日' && profile.birthday?.trim()) continue
        if (key === '性别' && hasValidProfileGender) continue
      }
      items.push(`- ${key}: ${trimmedVal}`)
    }
  }

  if (items.length === 0) return undefined

  const header = activePersona?.id
    ? `[User Identity Card / Persona: ${activePersona.id}]`
    : '[User Identity Card]'

  return `${header}\n${items.join('\n')}`
}
