import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IFileSystem } from '@baishou/core-mobile'

const nativeCopyStorageRootAsync = vi.fn()
const isNativeStorageRootMigrationAvailable = vi.fn()
const copyStorageRootContentsCore = vi.fn()

vi.mock('expo-baishou-server', () => ({
  isNativeStorageRootMigrationAvailable,
  nativeCopyStorageRootAsync
}))

vi.mock('@baishou/core-mobile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@baishou/core-mobile')>()
  return {
    ...actual,
    copyStorageRootContents: copyStorageRootContentsCore
  }
})

vi.mock('react-native', () => ({
  Platform: { OS: 'android' }
}))

const { copyStorageRootContents } = await import('../storage-migration.service')

describe('storage-migration.service', () => {
  const fileSystem = {} as IFileSystem

  beforeEach(() => {
    vi.clearAllMocks()
    isNativeStorageRootMigrationAvailable.mockReturnValue(true)
    nativeCopyStorageRootAsync.mockResolvedValue(undefined)
    copyStorageRootContentsCore.mockResolvedValue(undefined)
  })

  it('uses native copy on Android when native API is available', async () => {
    const onProgress = vi.fn()

    await copyStorageRootContents(
      fileSystem,
      '/data/user/0/com.baishou.baishou/app_flutter/BaiShou_Root',
      '/storage/emulated/0/BaiShou_Root',
      onProgress
    )

    expect(nativeCopyStorageRootAsync).toHaveBeenCalledWith(
      'file:///data/user/0/com.baishou.baishou/app_flutter/BaiShou_Root',
      'file:///storage/emulated/0/BaiShou_Root',
      onProgress
    )
    expect(copyStorageRootContentsCore).not.toHaveBeenCalled()
  })

  it('falls back to core copy when native API is unavailable', async () => {
    isNativeStorageRootMigrationAvailable.mockReturnValue(false)

    await copyStorageRootContents(fileSystem, '/src', '/dest')

    expect(copyStorageRootContentsCore).toHaveBeenCalledWith(fileSystem, '/src', '/dest', undefined)
    expect(nativeCopyStorageRootAsync).not.toHaveBeenCalled()
  })
})
