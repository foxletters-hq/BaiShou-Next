import type { UserProfile } from '../types/user-profile.types'

/**
 * 将用户身份卡格式化为 system prompt 中的 userCard 块（与桌面端 buildStreamConfig 对齐）。
 */
export function formatUserCardFromProfile(
  profile: UserProfile | null | undefined
): string | undefined {
  if (!profile?.activePersonaId) return undefined

  const activePersona = profile.personas?.[profile.activePersonaId]
  if (!activePersona) return undefined

  const facts = activePersona.facts
  if (!facts || Object.keys(facts).length === 0) return undefined

  const factsList = Object.entries(facts)
    .filter(([_, value]) => value && value.trim().length > 0)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n')

  if (!factsList) return undefined

  return `[User Identity Card / Persona: ${activePersona.id}]\n${factsList}`
}
