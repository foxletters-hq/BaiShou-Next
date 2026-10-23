import { describe, expect, it } from 'vitest'
import { resolveNativeUserAvatarSource, NATIVE_APP_BRAND_ICON } from '../user-avatar.util'
import { NATIVE_BUILTIN_USER_AVATAR_SOURCES } from '../builtin-user-avatar.sources'

describe('native user-avatar.util', () => {
  it('resolves default avatar when null or default', () => {
    expect(resolveNativeUserAvatarSource(null)).toBe(NATIVE_APP_BRAND_ICON)
    expect(resolveNativeUserAvatarSource(undefined)).toBe(NATIVE_APP_BRAND_ICON)
    expect(resolveNativeUserAvatarSource('')).toBe(NATIVE_APP_BRAND_ICON)
    expect(resolveNativeUserAvatarSource('default')).toBe(NATIVE_APP_BRAND_ICON)
  })

  it('resolves builtin user avatar presets', () => {
    expect(resolveNativeUserAvatarSource('builtin-user:user-preset-6')).toBe(
      NATIVE_BUILTIN_USER_AVATAR_SOURCES['user-preset-6']
    )
    expect(resolveNativeUserAvatarSource('builtin-assistant:assistant-preset-6')).toBe(
      NATIVE_BUILTIN_USER_AVATAR_SOURCES['user-preset-6']
    )
  })

  it('resolves resolvedUri and custom direct uris', () => {
    expect(resolveNativeUserAvatarSource('avatars/user.png', 'file:///local/path.png')).toEqual({
      uri: 'file:///local/path.png'
    })
    expect(resolveNativeUserAvatarSource('file:///tmp/user.png')).toEqual({
      uri: 'file:///tmp/user.png'
    })
    expect(resolveNativeUserAvatarSource('data:image/png;base64,...')).toEqual({
      uri: 'data:image/png;base64,...'
    })
  })
})
