import { describe, expect, it, vi } from 'vitest'
import { importMobileEmoji } from '../mobile-attachment-manager.emoji'
import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'

vi.mock('../../utils/mobile-attachment-image-resolver', () => ({
  compressImageForEmojiImport: vi.fn(async (uri: string) => uri)
}))

vi.mock('../mobile-uri-import', () => ({
  importUriToPath: vi.fn(async () => {}),
  inferImageExtension: vi.fn((uri: string) => {
    if (uri.includes('.png')) return 'png'
    if (uri.includes('.gif')) return 'gif'
    return 'jpg'
  })
}))

vi.mock('../android-external-fs', () => ({
  toFileUri: vi.fn((p) => (p.startsWith('file://') ? p : `file://${p}`))
}))

describe('importMobileEmoji', () => {
  const createMockDeps = (initialFiles: Record<string, boolean> = {}) => {
    const files = new Set(Object.keys(initialFiles))
    const pathService = {
      getEmojisDirectory: vi.fn().mockResolvedValue('/mock/vault/Attachments/emojis')
    } as unknown as IStoragePathService
    const fileSystem = {
      exists: vi.fn(async (p: string) => files.has(p)),
      writeFile: vi.fn(async () => {})
    } as unknown as IFileSystem
    return { pathService, fileSystem, files }
  }

  it('rejects empty source path', async () => {
    const deps = createMockDeps()
    const result = await importMobileEmoji(deps, '')
    expect(result.error).toBeTruthy()
    expect(result.relativePath).toBe('')
  })

  it('returns directly if already an emoji relative path', async () => {
    const deps = createMockDeps()
    const result = await importMobileEmoji(deps, 'emojis/happy.png')
    expect(result.error).toBeNull()
    expect(result.relativePath).toBe('emojis/happy.png')
  })

  it('infers extension and normalizes numeric content uri from photo picker', async () => {
    const deps = createMockDeps()
    const result = await importMobileEmoji(
      deps,
      'content://media/picker/0/com.android.providers.media.photopicker/media/1000000034',
      { originalFileName: 'my_cat.png' }
    )
    expect(result.error).toBeNull()
    expect(result.relativePath).toMatch(/^emojis\/my_cat\.png$/)
    expect(result.originalName).toBe('my_cat')
  })

  it('handles purely numeric uri without extension safely', async () => {
    const deps = createMockDeps()
    const result = await importMobileEmoji(
      deps,
      'content://media/picker/0/com.android.providers.media.photopicker/media/1000000034'
    )
    expect(result.error).toBeNull()
    expect(result.relativePath).toMatch(/^emojis\/emoji_\d+\.jpg$/)
  })

  it('adds timestamp suffix when target file already exists', async () => {
    const existing = '/mock/vault/Attachments/emojis/sticker.png'
    const deps = createMockDeps({ [existing]: true })
    const result = await importMobileEmoji(deps, 'file:///data/user/0/cache/sticker.png', {
      originalFileName: 'sticker.png'
    })
    expect(result.error).toBeNull()
    expect(result.relativePath).toMatch(/^emojis\/sticker_[a-z0-9]+\.png$/)
  })
})
