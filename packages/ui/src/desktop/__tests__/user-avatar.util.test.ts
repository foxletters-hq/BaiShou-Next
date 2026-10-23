import { describe, expect, it } from 'vitest'
import { resolveDesktopUserAvatarSrc, WEB_APP_BRAND_ICON_SRC } from '../user-avatar.util'
import { DESKTOP_BUILTIN_USER_AVATAR_URLS } from '../builtin-user-avatar.sources'

describe('desktop user-avatar.util', () => {
  it('resolves default avatar when null or default', () => {
    expect(resolveDesktopUserAvatarSrc(null)).toBe(WEB_APP_BRAND_ICON_SRC)
    expect(resolveDesktopUserAvatarSrc(undefined)).toBe(WEB_APP_BRAND_ICON_SRC)
    expect(resolveDesktopUserAvatarSrc('')).toBe(WEB_APP_BRAND_ICON_SRC)
    expect(resolveDesktopUserAvatarSrc('default')).toBe(WEB_APP_BRAND_ICON_SRC)
  })

  it('resolves builtin user avatar presets', () => {
    expect(resolveDesktopUserAvatarSrc('builtin-user:user-preset-6')).toBe(
      DESKTOP_BUILTIN_USER_AVATAR_URLS['user-preset-6']
    )
    expect(resolveDesktopUserAvatarSrc('builtin-assistant:assistant-preset-6')).toBe(
      DESKTOP_BUILTIN_USER_AVATAR_URLS['user-preset-6']
    )
  })

  it('resolves custom avatars', () => {
    expect(resolveDesktopUserAvatarSrc('data:image/png;base64,...')).toBe(
      'data:image/png;base64,...'
    )
    expect(resolveDesktopUserAvatarSrc('local:///avatars/user.png')).toBe(
      'local:///avatars/user.png'
    )
    expect(resolveDesktopUserAvatarSrc('avatars/user.png')).toBe('local://avatars/user.png')
  })
})
