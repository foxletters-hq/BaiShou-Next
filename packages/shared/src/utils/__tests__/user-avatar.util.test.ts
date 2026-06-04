import { describe, expect, it } from 'vitest'
import { isCustomUserAvatar, USER_DEFAULT_AVATAR_SENTINEL } from '../user-avatar.util'

describe('isCustomUserAvatar', () => {
  it('returns false for empty and default sentinel', () => {
    expect(isCustomUserAvatar(null)).toBe(false)
    expect(isCustomUserAvatar(undefined)).toBe(false)
    expect(isCustomUserAvatar('')).toBe(false)
    expect(isCustomUserAvatar('   ')).toBe(false)
    expect(isCustomUserAvatar(USER_DEFAULT_AVATAR_SENTINEL)).toBe(false)
  })

  it('returns true for custom paths', () => {
    expect(isCustomUserAvatar('avatars/user.png')).toBe(true)
    expect(isCustomUserAvatar('file:///tmp/a.jpg')).toBe(true)
  })
})
