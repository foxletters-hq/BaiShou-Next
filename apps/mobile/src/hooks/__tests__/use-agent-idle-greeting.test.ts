import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const hookSrc = readFileSync(join(here, '../useAgentIdleGreeting.ts'), 'utf8')
const userProfileHookSrc = readFileSync(join(here, '../useAgentUserProfile.ts'), 'utf8')
const chatProfilesHookSrc = readFileSync(
  join(here, '../../screens/AgentScreen/hooks/useAgentScreenChatProfiles.ts'),
  'utf8'
)

describe('useAgentIdleGreeting & ChatProfiles nickname fallback', () => {
  it('useAgentIdleGreeting initializes with cached nickname instead of empty string', () => {
    expect(hookSrc).toContain("peekAgentUserProfileCache()?.nickname?.trim() || ''")
  })

  it('useAgentIdleGreeting hydrates nickname from persisted snapshot', () => {
    expect(hookSrc).toContain('readPersistedAgentUserProfileSnapshot')
  })

  it('useAgentIdleGreeting uses "朋友" as fallback greeting name instead of "你"', () => {
    expect(hookSrc).toContain("t('agent.idle_greeting_guest', '朋友')")
    expect(hookSrc).not.toContain("t('agent.you', '你')")
  })

  it('useAgentUserProfile does not fallback to "你" on settings failure', () => {
    expect(userProfileHookSrc).not.toContain("t('agent.chat.you_label', '你')")
    expect(userProfileHookSrc).toContain('DEFAULT_USER_PROFILE.nickname')
  })

  it('useAgentScreenChatProfiles does not force "你" into chatUserProfile.nickname', () => {
    expect(chatProfilesHookSrc).not.toContain("t('agent.chat.you_label', '你')")
    expect(chatProfilesHookSrc).toContain("nickname: userProfile.nickname || ''")
  })
})
