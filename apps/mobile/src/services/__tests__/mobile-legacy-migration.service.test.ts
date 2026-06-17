import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-native', () => ({
  Platform: { OS: 'android' }
}))

vi.mock('expo-baishou-server', () => ({
  getLegacyFlutterStorageRoots: () => [
    '/data/user/0/com.baishou.baishou/app_flutter/BaiShou_Root'
  ]
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
    const { resolveFlutterLegacyMigrationTargetRoot } = await import(
      '../mobile-legacy-migration.paths'
    )
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
      getAppDocumentDirectory: () => 'file:///var/mobile/Containers/Data/Application/UUID/Documents/'
    }))
    const { resolveIosFlutterPreferencesPlistPath } = await import('../mobile-legacy-migration.paths')
    expect(resolveIosFlutterPreferencesPlistPath()).toBe(
      'file:///var/mobile/Containers/Data/Application/UUID/Library/Preferences/com.baishou.baishou.plist'
    )
  })
})
