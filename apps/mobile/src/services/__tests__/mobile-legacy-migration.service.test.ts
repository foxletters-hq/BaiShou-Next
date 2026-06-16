import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-native', () => ({
  Platform: { OS: 'android' }
}))

vi.mock('expo-baishou-server', () => ({
  getLegacyFlutterStorageRoots: () => []
}))

vi.mock('../storage-permission.service', () => ({
  EXTERNAL_STORAGE_ROOT: 'file:///storage/emulated/0/BaiShou_Root',
  hasStoragePermission: vi.fn(async () => true)
}))

vi.mock('../mobile-app-paths', () => ({
  getAppDocumentDirectory: () => 'file:///data/user/0/com.baishou.baishou/files/'
}))

describe('mobile-legacy-migration.service', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('resolveMobileMigrationTargetRoot prefers external root on android when permitted', async () => {
    const { resolveMobileMigrationTargetRoot } = await import('../mobile-legacy-migration.service')
    const target = await resolveMobileMigrationTargetRoot(async () => 'file:///unused')
    expect(target).toBe('file:///storage/emulated/0/BaiShou_Root')
  })

  it('resolveMobileMigrationTargetRoot uses flutter sandbox when storage permission is missing', async () => {
    vi.doMock('../storage-permission.service', () => ({
      EXTERNAL_STORAGE_ROOT: 'file:///storage/emulated/0/BaiShou_Root',
      hasStoragePermission: vi.fn(async () => false)
    }))
    vi.doMock('expo-baishou-server', () => ({
      getLegacyFlutterStorageRoots: () => ['/data/user/0/com.baishou.baishou/app_flutter/BaiShou_Root']
    }))
    const { resolveMobileMigrationTargetRoot } = await import('../mobile-legacy-migration.service')
    const target = await resolveMobileMigrationTargetRoot(async () => 'file:///unused')
    expect(target).toBe('file:///data/user/0/com.baishou.baishou/app_flutter/BaiShou_Root')
  })

  it('resolveIosFlutterPreferencesPlistPath derives Library/Preferences path from Documents', async () => {
    vi.doMock('../mobile-app-paths', () => ({
      getAppDocumentDirectory: () => 'file:///var/mobile/Containers/Data/Application/UUID/Documents/'
    }))
    const { resolveIosFlutterPreferencesPlistPath } = await import('../mobile-legacy-migration.service')
    expect(resolveIosFlutterPreferencesPlistPath()).toBe(
      'file:///var/mobile/Containers/Data/Application/UUID/Library/Preferences/com.baishou.baishou.plist'
    )
  })
})
