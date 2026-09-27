import { describe, expect, it } from 'vitest'
import { mergeEmojiAttachmentCatalog } from '../emoji-attachment-catalog.util'

describe('mergeEmojiAttachmentCatalog', () => {
  it('should mark unused disk files and missing group entries', () => {
    const items = mergeEmojiAttachmentCatalog(
      [
        {
          name: 'cat.png',
          path: '/vault/Attachments/emojis/cat.png',
          relativePath: 'emojis/cat.png',
          sizeMB: 0.1,
          birthtime: '2026-01-01T00:00:00.000Z'
        },
        {
          name: 'spare.png',
          path: '/vault/Attachments/emojis/spare.png',
          relativePath: 'emojis/spare.png',
          sizeMB: 0.2,
          birthtime: '2026-01-02T00:00:00.000Z'
        }
      ],
      {
        enabled: true,
        groups: [
          {
            id: 'life',
            name: '日常',
            emojis: [
              { id: 'cat.png', name: 'cat', relativePath: 'emojis/cat.png' },
              { id: 'gone.png', name: 'gone', relativePath: 'emojis/gone.png' }
            ]
          }
        ]
      }
    )

    const cat = items.find((item) => item.relativePath === 'emojis/cat.png')
    const spare = items.find((item) => item.relativePath === 'emojis/spare.png')
    const gone = items.find((item) => item.relativePath === 'emojis/gone.png')

    expect(cat?.groupNames).toEqual(['日常'])
    expect(cat?.isMissing).toBe(false)
    expect(spare?.groupNames).toEqual([])
    expect(gone?.isMissing).toBe(true)
    expect(gone?.groupNames).toEqual(['日常'])
  })
})
