import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EMOJI_GROUP_ID,
  normalizeEmojiToolConfig,
  resolveAssistantEmojiConfig
} from '../utils/emoji-config.util'

describe('emoji-config.util', () => {
  it('migrates legacy flat emojis into default group', () => {
    const normalized = normalizeEmojiToolConfig({
      enabled: true,
      emojis: [{ id: 'cat.png', name: 'cat', relativePath: 'emojis/cat.png' }]
    })

    expect(normalized.groups).toHaveLength(1)
    expect(normalized.groups[0]?.id).toBe(DEFAULT_EMOJI_GROUP_ID)
    expect(normalized.groups[0]?.emojis).toHaveLength(1)
  })

  it('defaults global emoji feature to disabled', () => {
    expect(normalizeEmojiToolConfig(null).enabled).toBe(false)
    expect(normalizeEmojiToolConfig({ enabled: false, groups: [] }).enabled).toBe(false)
  })

  it('resolves assistant emoji groups when enabled', () => {
    const config = normalizeEmojiToolConfig({
      enabled: true,
      groups: [
        { id: 'work', name: '工作', emojis: [{ id: 'a.png', name: 'a', relativePath: 'emojis/a.png' }] },
        { id: 'life', name: '日常', emojis: [{ id: 'b.png', name: 'b', relativePath: 'emojis/b.png' }] }
      ]
    })

    const resolved = resolveAssistantEmojiConfig(config, {
      emojiEnabled: true,
      emojiGroupIds: ['life']
    })
    expect(resolved.enabled).toBe(true)
    expect(resolved.emojis).toHaveLength(1)
    expect(resolved.emojis[0]?.id).toBe('b.png')
    expect(resolved.groupName).toBe('日常')
  })

  it('returns disabled when companion emoji switch is off', () => {
    const config = normalizeEmojiToolConfig({
      enabled: true,
      groups: [{ id: 'life', name: '日常', emojis: [] }]
    })

    const resolved = resolveAssistantEmojiConfig(config, {
      emojiEnabled: false,
      emojiGroupIds: ['life']
    })
    expect(resolved.enabled).toBe(false)
    expect(resolved.emojis).toHaveLength(0)
  })
})
