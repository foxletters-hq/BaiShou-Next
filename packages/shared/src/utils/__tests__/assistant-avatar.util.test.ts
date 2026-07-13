import { describe, expect, it } from 'vitest'
import {
  isAssistantAvatarDirectUri,
  isAssistantCustomAvatar,
  normalizePersistedAvatarPath,
  collectSyncedAgentAvatarBasenames
} from '../assistant-avatar.util'

describe('assistant-avatar.util', () => {
  it('treats local:// resolved custom avatars as custom', () => {
    expect(isAssistantCustomAvatar('local:///C:/Users/x/Attachments/avatars/agent_123.jpg')).toBe(
      true
    )
    expect(isAssistantAvatarDirectUri('local:///tmp/avatars/agent_1.png')).toBe(true)
  })

  it('treats relative and file URIs as custom', () => {
    expect(isAssistantCustomAvatar('avatars/agent_1.jpg')).toBe(true)
    expect(isAssistantCustomAvatar('file:///tmp/avatars/agent_1.jpg')).toBe(true)
  })

  it('does not treat builtin paths as custom', () => {
    expect(isAssistantCustomAvatar('builtin:latte')).toBe(false)
    expect(isAssistantCustomAvatar(null)).toBe(false)
  })

  it('normalizes local:// paths back to avatars relative keys', () => {
    expect(normalizePersistedAvatarPath('local:///vault/Attachments/avatars/agent_abc.jpg')).toBe(
      'avatars/agent_abc.jpg'
    )
  })

  it('collects agent avatar basenames from sync relative paths', () => {
    expect(
      collectSyncedAgentAvatarBasenames([
        'Personal32/Attachments/avatars/agent_1779668155703.png',
        'Personal32/Attachments/avatars/agent_avatar_1778508470857.jpg',
        'Personal32/Assistants/latte.json',
        'Personal32/Attachments/avatars/UserAvatars/user_avatar_1.png'
      ])
    ).toEqual(['agent_1779668155703.png', 'agent_avatar_1778508470857.jpg'])
  })
})
