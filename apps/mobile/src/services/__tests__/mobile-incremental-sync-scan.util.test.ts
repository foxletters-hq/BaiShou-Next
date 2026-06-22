import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IFileSystem } from '@baishou/core-mobile'
import { scanIncrementalSyncFilesForManifest } from '../mobile-incremental-sync-scan.util'

vi.mock('react-native', () => ({
  Platform: { OS: 'android' }
}))

const externalScanIncrementalSyncFiles = vi.fn()
const localScanIncrementalSyncFiles = vi.fn()

vi.mock('expo-baishou-server', () => ({
  externalScanIncrementalSyncFiles: (...args: unknown[]) =>
    externalScanIncrementalSyncFiles(...args),
  localScanIncrementalSyncFiles: (...args: unknown[]) =>
    localScanIncrementalSyncFiles(...args),
  isLocalFsNativeAvailable: () => true
}))

vi.mock('../android-external-fs', () => ({
  isExternalStoragePath: (path: string) => path.startsWith('/storage/'),
  isAndroidAppSandboxPath: (path: string) => path.startsWith('/data/user/')
}))

describe('scanIncrementalSyncFilesForManifest', () => {
  beforeEach(() => {
    externalScanIncrementalSyncFiles.mockReset()
    localScanIncrementalSyncFiles.mockReset()
  })

  it('外部存储原生扫描可用时直接返回结果', async () => {
    externalScanIncrementalSyncFiles.mockReturnValue([
      { relPath: 'a.md', size: 10, mtimeMs: 100, isFile: true }
    ])

    const files = await scanIncrementalSyncFilesForManifest(
      {} as IFileSystem,
      '/storage/emulated/0/BaiShou_Root'
    )

    expect(files).toHaveLength(1)
    expect(files[0]?.relPath).toBe('a.md')
    expect(externalScanIncrementalSyncFiles).toHaveBeenCalledWith('/storage/emulated/0/BaiShou_Root')
  })

  it('沙盒路径优先本地原生扫描', async () => {
    localScanIncrementalSyncFiles.mockReturnValue([
      { relPath: 'Personal/note.md', size: 5, mtimeMs: 50, isFile: true }
    ])

    const files = await scanIncrementalSyncFilesForManifest(
      {} as IFileSystem,
      '/data/user/0/com.app/files/BaiShou_Root'
    )

    expect(files).toHaveLength(1)
    expect(files[0]?.relPath).toBe('Personal/note.md')
    expect(localScanIncrementalSyncFiles).toHaveBeenCalled()
    expect(externalScanIncrementalSyncFiles).not.toHaveBeenCalled()
  })

  it('原生扫描返回空结果时回退 JS 扫描', async () => {
    externalScanIncrementalSyncFiles.mockReturnValue([])

    const fileSystem: IFileSystem = {
      readdir: async () => ['note.md'],
      stat: async (path: string) => ({
        isFile: path.endsWith('note.md'),
        isDirectory: false,
        size: 3,
        mtimeMs: 200
      }),
      exists: async () => true,
      readFile: async () => '',
      writeFile: async () => {},
      mkdir: async () => {},
      unlink: async () => {},
      copyFile: async () => {},
      rename: async () => {}
    }

    const files = await scanIncrementalSyncFilesForManifest(
      fileSystem,
      '/storage/emulated/0/BaiShou_Root'
    )

    expect(files).toHaveLength(1)
    expect(files[0]?.relPath).toBe('note.md')
  })

  it('原生扫描失败时回退 JS 扫描', async () => {
    externalScanIncrementalSyncFiles.mockImplementation(() => {
      throw new Error('native unavailable')
    })

    const fileSystem: IFileSystem = {
      readdir: async () => ['note.md'],
      stat: async (path: string) => ({
        isFile: path.endsWith('note.md'),
        isDirectory: false,
        size: 3,
        mtimeMs: 200
      }),
      exists: async () => true,
      readFile: async () => '',
      writeFile: async () => {},
      mkdir: async () => {},
      unlink: async () => {},
      copyFile: async () => {},
      rename: async () => {}
    }

    const files = await scanIncrementalSyncFilesForManifest(
      fileSystem,
      '/storage/emulated/0/BaiShou_Root'
    )

    expect(files).toHaveLength(1)
    expect(files[0]?.relPath).toBe('note.md')
  })
})
