import { describe, expect, it } from 'vitest'
import {
  BUILTIN_USER_AVATAR_IDS,
  DEFAULT_BUILTIN_USER_AVATAR_ID,
  DEFAULT_BUILTIN_USER_AVATAR_PATH,
  isBuiltinUserAvatarPath,
  parseBuiltinUserAvatarId,
  toBuiltinUserAvatarPath
} from '../builtin-user-avatars.constants'

describe('builtin user avatars', () => {
  it('defines default builtin user avatar', () => {
    expect(DEFAULT_BUILTIN_USER_AVATAR_ID).toBe('user-preset-6')
    expect(DEFAULT_BUILTIN_USER_AVATAR_PATH).toBe('builtin-user:user-preset-6')
    expect(BUILTIN_USER_AVATAR_IDS).toEqual(['user-preset-6'])
  })

  it('correctly identifies builtin avatar paths', () => {
    expect(isBuiltinUserAvatarPath('default')).toBe(true)
    expect(isBuiltinUserAvatarPath('builtin-user:user-preset-6')).toBe(true)
    expect(isBuiltinUserAvatarPath('builtin-assistant:assistant-preset-6')).toBe(true)

    expect(isBuiltinUserAvatarPath(null)).toBe(false)
    expect(isBuiltinUserAvatarPath(undefined)).toBe(false)
    expect(isBuiltinUserAvatarPath('')).toBe(false)
    expect(isBuiltinUserAvatarPath('avatars/user.png')).toBe(false)
    expect(isBuiltinUserAvatarPath('file:///tmp/a.jpg')).toBe(false)
  })

  it('parses builtin user avatar ids', () => {
    expect(parseBuiltinUserAvatarId(null)).toBe(null)
    expect(parseBuiltinUserAvatarId('')).toBe(null)
    expect(parseBuiltinUserAvatarId('default')).toBe(null)
    expect(parseBuiltinUserAvatarId('builtin-user:user-preset-6')).toBe('user-preset-6')
    expect(parseBuiltinUserAvatarId('builtin-assistant:assistant-preset-6')).toBe('user-preset-6')
    expect(parseBuiltinUserAvatarId('avatars/custom.png')).toBe(null)
  })

  it('converts id to avatar path', () => {
    expect(toBuiltinUserAvatarPath('user-preset-6')).toBe('builtin-user:user-preset-6')
  })
})
