import { describe, expect, it } from 'vitest'
import { isAttachmentPoolFolderName } from '../attachment-pool.constants'

describe('isAttachmentPoolFolderName', () => {
  it('should treat emojis as a shared pool instead of a session folder', () => {
    expect(isAttachmentPoolFolderName('emojis')).toBe(true)
    expect(isAttachmentPoolFolderName('avatars')).toBe(true)
    expect(isAttachmentPoolFolderName('backgrounds')).toBe(true)
    expect(isAttachmentPoolFolderName('sess-123')).toBe(false)
  })
})
