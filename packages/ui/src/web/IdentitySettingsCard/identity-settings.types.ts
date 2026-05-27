export interface UserProfileConfig {
  nickname: string
  avatarPath?: string
  activePersonaId: string
  personas: Record<string, { id: string; facts: Record<string, string> }>
}

export interface IdentitySettingsCardProps {
  profile: UserProfileConfig
  onChange: (profile: UserProfileConfig) => void
}
