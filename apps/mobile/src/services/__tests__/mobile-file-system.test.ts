import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const externalGetInfoAsync = vi.fn()
const externalMakeDirectoryAsync = vi.fn()
const externalWriteStringAsync = vi.fn()
const externalAppendStringAsync = vi.fn()
const externalWriteBase64Async = vi.fn()
const externalReadStringAsync = vi.fn()
const externalReadBase64Async = vi.fn()
const externalDeleteAsync = vi.fn()
const externalReadDirectoryAsync = vi.fn()
const externalMoveAsync = vi.fn()
const externalCopyAsync = vi.fn()
const externalCopyFileAsync = vi.fn()
const localGetInfoAsync = vi.fn()
const localReadDirectoryAsync = vi.fn()
const localAppendStringAsync = vi.fn()

vi.mock('react-native', () => ({
  Platform: { OS: 'android' }
}))

vi.mock('expo-baishou-server', () => ({
  isExternalStorageNativeAvailable: () => true,
  isLocalFsNativeAvailable: () => true,
  externalGetInfo: vi.fn(),
  externalGetInfoAsync,
  externalMakeDirectory: vi.fn(),
  externalMakeDirectoryAsync,
  externalWriteString: vi.fn(),
  externalWriteStringAsync,
  externalAppendString: vi.fn(),
  externalAppendStringAsync,
  externalWriteBase64: vi.fn(),
  externalWriteBase64Async,
  externalReadString: vi.fn(),
  externalReadStringAsync,
  externalReadBase64: vi.fn(),
  externalReadBase64Async,
  externalDelete: vi.fn(),
  externalDeleteAsync,
  externalReadDirectory: vi.fn(),
  externalReadDirectoryAsync,
  externalMove: vi.fn(),
  externalMoveAsync,
  externalCopy: vi.fn(),
  externalCopyAsync,
  externalCopyFileAsync,
  localGetInfo: vi.fn(),
  localGetInfoAsync,
  localReadDirectory: vi.fn(),
  localReadDirectoryAsync,
  localAppendString: vi.fn(),
  localAppendStringAsync,
  localMd5Hex: vi.fn(),
  externalMd5Hex: vi.fn()
}))

vi.mock('../mobile-sandbox-fs', () => ({
  EncodingType: { Base64: 'base64' },
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
  deleteAsync: vi.fn(),
  copyAsync: vi.fn(),
  readDirectoryAsync: vi.fn(),
  moveAsync: vi.fn()
}))

const { MobileFileSystem } = await import('../mobile-file-system')

describe('MobileFileSystem async native bridge', () => {
  const fs = new MobileFileSystem()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses async native methods for Android external storage reads, writes, stats and listings', async () => {
    externalGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      modificationTime: 1_700_000_000_000,
      size: 64
    })
    externalReadStringAsync.mockResolvedValue('hello')
    externalWriteStringAsync.mockResolvedValue(undefined)
    externalAppendStringAsync.mockResolvedValue(undefined)
    externalDeleteAsync.mockResolvedValue(undefined)
    externalMoveAsync.mockResolvedValue(undefined)
    externalCopyAsync.mockResolvedValue(undefined)

    expect(await fs.exists('/storage/emulated/124/0312/a.json')).toBe(true)
    expect(await fs.readFile('/storage/emulated/124/0312/a.json')).toBe('hello')
    await fs.writeFile('/storage/emulated/124/0312/b.json', 'world')
    await fs.appendFile('/storage/emulated/124/0312/a.json', '!')
    await fs.rename('/storage/emulated/124/0312/a.json', '/storage/emulated/124/0312/c.json')
    await fs.copyFile('/storage/emulated/124/0312/b.json', '/storage/emulated/124/0312/d.json')
    await fs.unlink('/storage/emulated/124/0312/c.json')

    expect(externalReadStringAsync).toHaveBeenCalledWith('file:///storage/emulated/124/0312/a.json')
    expect(externalWriteStringAsync).toHaveBeenCalledWith(
      'file:///storage/emulated/124/0312/b.json',
      'world'
    )
    expect(externalAppendStringAsync).toHaveBeenCalledWith(
      'file:///storage/emulated/124/0312/a.json',
      '!'
    )
    expect(externalMoveAsync).toHaveBeenCalledWith(
      'file:///storage/emulated/124/0312/a.json',
      'file:///storage/emulated/124/0312/c.json'
    )
    expect(externalCopyAsync).toHaveBeenCalledWith(
      'file:///storage/emulated/124/0312/b.json',
      'file:///storage/emulated/124/0312/d.json'
    )
    expect(externalDeleteAsync).toHaveBeenCalledWith(
      'file:///storage/emulated/124/0312/c.json',
      true
    )
  })

  it('throws ENOENT when reading a missing external file via async bridge', async () => {
    externalGetInfoAsync.mockResolvedValue({
      exists: false,
      isDirectory: false,
      modificationTime: 0,
      size: 0
    })

    await expect(fs.readFile('/storage/emulated/124/0312/missing.json')).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('appends atomically via native append without TOCTOU exists-then-write check', async () => {
    externalAppendStringAsync.mockResolvedValue(undefined)

    await fs.appendFile('/storage/emulated/124/0312/log.jsonl', '{"a":1}\n')

    expect(externalGetInfoAsync).not.toHaveBeenCalled()
    expect(externalWriteStringAsync).not.toHaveBeenCalled()
    expect(externalAppendStringAsync).toHaveBeenCalledWith(
      'file:///storage/emulated/124/0312/log.jsonl',
      '{"a":1}\n'
    )
  })

  it('normalizes native FileNotFoundException during read/readdir into ENOENT', async () => {
    externalGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      modificationTime: 1_700_000_000_000,
      size: 16
    })
    externalReadStringAsync.mockRejectedValue(
      new Error('externalReadStringAsync failed: java.io.FileNotFoundException: vanished')
    )
    await expect(fs.readFile('/storage/emulated/124/0312/vanished.json')).rejects.toMatchObject({
      code: 'ENOENT'
    })

    externalGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: true,
      modificationTime: 1_700_000_000_000,
      size: 0
    })
    externalReadDirectoryAsync.mockRejectedValue(
      new Error('externalReadDirectoryAsync failed: java.io.FileNotFoundException: gone')
    )
    await expect(fs.readdir('/storage/emulated/124/0312/gone')).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('uses single-thread FIFO executor in ExpoBaishouServerModule to preserve file ordering', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const ktPath = join(
      here,
      '../../../modules/expo-baishou-server/android/src/main/java/expo/modules/baishouserver/ExpoBaishouServerModule.kt'
    )
    const src = readFileSync(ktPath, 'utf8')
    expect(src).toContain('Executors.newSingleThreadExecutor')
    expect(src).not.toContain('Executors.newFixedThreadPool')
  })
})
