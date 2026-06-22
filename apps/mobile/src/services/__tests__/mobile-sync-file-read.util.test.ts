import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-native', () => ({
  Platform: { OS: 'android' }
}))

vi.mock('expo-baishou-server', () => ({
  isHttpFileUploadNativeAvailable: () => false,
  isReadFileChunkNativeAvailable: () => false,
  httpUploadFileAsync: vi.fn(),
  readFileChunkBase64: vi.fn()
}))

vi.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: vi.fn()
}))

const { normalizeSyncFilePath } = await import('../android-external-fs')
const { base64ToArrayBuffer } = await import('../mobile-sync-file-read.util')

describe('normalizeSyncFilePath', () => {
  it('strips file:// from sandbox paths', () => {
    expect(normalizeSyncFilePath('file:///data/user/0/app/cache/sync.dat')).toBe(
      '/data/user/0/app/cache/sync.dat'
    )
  })

  it('normalizes external storage paths on android', () => {
    expect(
      normalizeSyncFilePath('file:///storage/emulated/0/BaiShou_Root/Journals/a.md')
    ).toBe('/storage/emulated/0/BaiShou_Root/Journals/a.md')
  })
})

describe('base64ToArrayBuffer', () => {
  it('decodes base64 payload', () => {
    const buf = base64ToArrayBuffer('aGk=')
    expect(new TextDecoder().decode(buf)).toBe('hi')
  })
})

describe('mobile-sync-file-read imports', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('exports normalizeSyncFilePath from android-external-fs for read util', async () => {
    const externalFs = await import('../android-external-fs')
    expect(typeof externalFs.normalizeSyncFilePath).toBe('function')
    const readUtil = await import('../mobile-sync-file-read.util')
    expect(typeof readUtil.httpUploadSyncFile).toBe('function')
    expect(typeof readUtil.readSyncFileChunk).toBe('function')
  })
})
