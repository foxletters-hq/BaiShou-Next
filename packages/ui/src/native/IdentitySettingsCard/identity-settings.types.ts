export interface UserProfileConfig {
  nickname: string
  avatarPath?: string
  activePersonaId: string
  personas: Record<string, { id: string; facts: Record<string, string> }>
}

export interface NativeIdentitySettingsCardProps {
  profile: UserProfileConfig
  onChange: (profile: UserProfileConfig) => void
}
