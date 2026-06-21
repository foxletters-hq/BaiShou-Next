import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-native', () => ({
  Platform: { OS: 'android' }
}))

vi.mock('expo-baishou-server', () => ({
  getLegacyFlutterStorageRoots: () => ['/data/user/0/com.baishou.baishou/app_flutter/BaiShou_Root']
}))

vi.mock('../storage-permission.service', () => ({
  EXTERNAL_STORAGE_ROOT: '/storage/emulated/0/BaiShou_Root',
  hasStoragePermission: vi.fn(async () => true)
}))

vi.mock('../mobile-app-paths', () => ({
  getAppDocumentDirectory: () => 'file:///data/user/0/com.baishou.baishou/files/'
}))

describe('mobile-legacy-migration.paths', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('resolveFlutterLegacyMigrationTargetRoot uses external BaiShou_Root on android', async () => {
    const { resolveFlutterLegacyMigrationTargetRoot } =
      await import('../mobile-legacy-migration.paths')
    expect(resolveFlutterLegacyMigrationTargetRoot()).toBe(
      'file:///storage/emulated/0/BaiShou_Root'
    )
  })

  it('resolveMobileMigrationTargetRoot returns external root on android', async () => {
    const { resolveMobileMigrationTargetRoot } = await import('../mobile-legacy-migration.paths')
    const target = await resolveMobileMigrationTargetRoot(async () => 'file:///unused')
    expect(target).toBe('file:///storage/emulated/0/BaiShou_Root')
  })

  it('resolveIosFlutterPreferencesPlistPath derives Library/Preferences path from Documents', async () => {
    vi.doMock('../mobile-app-paths', () => ({
      getAppDocumentDirectory: () =>
        'file:///var/mobile/Containers/Data/Application/UUID/Documents/'
    }))
    const { resolveIosFlutterPreferencesPlistPath } =
      await import('../mobile-legacy-migration.paths')
    expect(resolveIosFlutterPreferencesPlistPath()).toBe(
      'file:///var/mobile/Containers/Data/Application/UUID/Library/Preferences/com.baishou.baishou.plist'
    )
  })
})

describe('mobile-legacy-version-migration.state', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('mergeAssistantIdMap persists assistant mapping', async () => {
    const storage = new Map<string, string>()
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: {
        getItem: async (key: string) => storage.get(key) ?? null,
        setItem: async (key: string, value: string) => {
          storage.set(key, value)
        }
      }
    }))
    const { mergeAssistantIdMap, getStoredAssistantIdMap } =
      await import('../mobile-legacy-version-migration.state')
    await mergeAssistantIdMap({ old_a: 'new_a' })
    const map = await getStoredAssistantIdMap()
    expect(map.old_a).toBe('new_a')
  })

  it('mergeVaultNameMap persists vault name mapping', async () => {
    const storage = new Map<string, string>()
    vi.doMock('@react-native-async-storage/async-storage', () => ({
      default: {
        getItem: async (key: string) => storage.get(key) ?? null,
        setItem: async (key: string, value: string) => {
          storage.set(key, value)
        }
      }
    }))
    const { mergeVaultNameMap, getStoredVaultNameMap } =
      await import('../mobile-legacy-version-migration.state')
    await mergeVaultNameMap({ Personal: 'Personal42' })
    const map = await getStoredVaultNameMap()
    expect(map.Personal).toBe('Personal42')
  })
})
