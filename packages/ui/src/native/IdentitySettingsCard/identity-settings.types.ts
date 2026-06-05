export interface UserProfileConfig {
  nickname: string
  avatarPath?: string
  activePersonaId: string
  personas: Record<string, { id: string; facts: Record<string, string> }>
  recentPersonaIds?: string[]
}

export interface NativeIdentitySettingsCardProps {
  profile: UserProfileConfig
  onChange: (profile: UserProfileConfig) => void
  onManageIdentity?: () => void
  /** 嵌入设置枢纽分组，使用紧凑列表行样式 */
  embedded?: boolean
  isLast?: boolean
}
