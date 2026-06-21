import { describe, it, expect, vi } from 'vitest'
import {
  isFlutterLegacyUserAvatarFileName,
  resolveImportedAssistantAvatarPath,
  restoreLegacyUserAvatar
} from '../legacy-avatar-migration.shared'

describe('isFlutterLegacyUserAvatarFileName', () => {
  it('accepts Flutter user avatar naming from user_profile_service.dart', () => {
    expect(isFlutterLegacyUserAvatarFileName('avatar_1712345678901.jpg')).toBe(true)
    expect(isFlutterLegacyUserAvatarFileName('user_avatar.png')).toBe(true)
    expect(isFlutterLegacyUserAvatarFileName('avatar_imported_1712345678901.jpg')).toBe(true)
  })

  it('rejects assistant avatars in the same documents/avatars directory', () => {
    expect(isFlutterLegacyUserAvatarFileName('fbae6862-bcdb-4c8e-b705-70d29017b306.jpg')).toBe(
      false
    )
  })
})

describe('resolveImportedAssistantAvatarPath', () => {
  it('imports from flutter documents dir when sqlite stores an absolute path', async () => {
    const assistantId = 'fbae6862-bcdb-4c8e-b705-70d29017b306'
    const fileSystem = {
      exists: async (p: string) =>
        p.endsWith(`${assistantId}.jpg`) || p.includes('/Documents/avatars/'),
      readdir: async () => [],
      stat: async () => ({ isDirectory: false })
    } as never

    const importAvatar = vi.fn(async () => 'avatars/agent_avatar_123.jpg')

    const result = await resolveImportedAssistantAvatarPath(fileSystem, {
      legacyAvatarPath: `C:/Users/Anson/Documents/avatars/${assistantId}.jpg`,
      assistantId,
      flutterDocumentsAvatarsDir: 'C:/Users/Anson/Documents/avatars',
      importAvatar
    })

    expect(result).toBe('avatars/agent_avatar_123.jpg')
    expect(importAvatar).toHaveBeenCalled()
  })
})

describe('restoreLegacyUserAvatar', () => {
  it('prefers SP path remapped into flutter documents avatars dir', async () => {
    const imports: string[] = []
    const fileSystem = {
      exists: async (p: string) =>
        p.includes('/app_flutter/avatars/avatar_123.jpg') || p.includes('/config/avatar.jpg'),
      readdir: async (dir: string) => {
        if (dir.endsWith('/avatars')) {
          return ['avatar_123.jpg', 'fbae6862-bcdb-4c8e-b705-70d29017b306.jpg']
        }
        if (dir.endsWith('/config')) return []
        return []
      },
      stat: async () => ({ isDirectory: false })
    } as never

    const result = await restoreLegacyUserAvatar(fileSystem, {
      userAvatarPathFromPrefs:
        '/data/user/0/com.baishou.baishou/app_flutter/avatars/avatar_123.jpg',
      sourceRoot: '/storage/BaiShou_Root',
      flutterDocumentsAvatarsDir: '/data/user/0/com.baishou.baishou/app_flutter/avatars',
      importAvatar: async (absPath) => {
        imports.push(absPath)
        return 'avatars/user_avatar_1.jpg'
      }
    })

    expect(result).toBe('avatars/user_avatar_1.jpg')
    expect(imports[0]).toContain('avatar_123.jpg')
    expect(imports.some((p) => p.includes('fbae6862'))).toBe(false)
  })

  it('falls back to config/avatar.ext from archive export layout', async () => {
    const fileSystem = {
      exists: async (p: string) => p.endsWith('/config') || p.endsWith('/config/avatar.png'),
      readdir: async (dir: string) => (dir.endsWith('/config') ? ['avatar.png'] : []),
      stat: async () => ({ isDirectory: false })
    } as never

    const importAvatar = vi.fn(async () => 'avatars/user_avatar_2.png')

    const result = await restoreLegacyUserAvatar(fileSystem, {
      sourceRoot: '/storage/BaiShou_Root',
      importAvatar
    })

    expect(result).toBe('avatars/user_avatar_2.png')
    expect(importAvatar).toHaveBeenCalledWith(
      '/storage/BaiShou_Root/config/avatar.png',
      'user_avatar'
    )
  })
})
