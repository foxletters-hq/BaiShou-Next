import { describe, expect, it } from 'vitest'
import { AVATAR_IMPORT_MAX_BYTES, shouldCompressAvatarFileSize } from '../avatar-import.constants'

describe('avatar-import.constants', () => {
  it('compresses only above 3 MiB', () => {
    expect(AVATAR_IMPORT_MAX_BYTES).toBe(3 * 1024 * 1024)
    expect(shouldCompressAvatarFileSize(AVATAR_IMPORT_MAX_BYTES)).toBe(false)
    expect(shouldCompressAvatarFileSize(AVATAR_IMPORT_MAX_BYTES + 1)).toBe(true)
  })
})
