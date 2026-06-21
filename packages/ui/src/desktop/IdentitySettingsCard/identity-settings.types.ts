export interface UserProfileConfig {
  nickname: string
  avatarPath?: string
  activePersonaId: string
  personas: Record<string, { id: string; facts: Record<string, string> }>
  recentPersonaIds?: string[]
}

export interface IdentitySettingsCardProps {
  profile: UserProfileConfig
  onChange: (profile: UserProfileConfig) => void
  embedded?: boolean
  isLast?: boolean
  onManageIdentity?: () => void
}
