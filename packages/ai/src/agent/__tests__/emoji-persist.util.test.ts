import { describe, expect, it } from 'vitest'
import { buildEmojiImagePartsFromToolCalls } from '../agent-session-persist.utils'

describe('buildEmojiImagePartsFromToolCalls', () => {
  it('creates image parts on the assistant message instead of separate messages', () => {
    const parts = buildEmojiImagePartsFromToolCalls(
      [
        {
          name: 'emoji_send',
          arguments: { emoji_id: 'cat.png' }
        }
      ],
      'assistant-1',
      'session-1',
      {
        emojiConfig: {
          emojis: [{ id: 'cat.png', name: 'cat', relativePath: 'emojis/cat.png' }]
        }
      }
    )

    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({
      messageId: 'assistant-1',
      sessionId: 'session-1',
      type: 'image',
      data: {
        filePath: 'emojis/cat.png',
        url: 'local:///emojis/cat.png',
        isImage: true
      }
    })
  })
})
