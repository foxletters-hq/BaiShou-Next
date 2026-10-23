import { describe, expect, it } from 'vitest'
import { isPendingLocalAvatar } from '../settings-account-avatar.util'

describe('isPendingLocalAvatar', () => {
  it('should return false when the path is already stored under avatars/', () => {
    expect(isPendingLocalAvatar('avatars/user.png')).toBe(false)
  })

  it('should return true when the uri is a local file or content path', () => {
    expect(isPendingLocalAvatar('file:///tmp/a.png')).toBe(true)
    expect(isPendingLocalAvatar('content://media/1')).toBe(true)
    expect(isPendingLocalAvatar('/storage/avatar.png')).toBe(true)
  })
})
