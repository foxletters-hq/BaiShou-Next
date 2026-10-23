import { describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/mobile-attachment-image-resolver', () => ({
  compressImageForAvatarImport: vi.fn(),
  compressImageForBackgroundImport: vi.fn()
}))
vi.mock('../android-external-fs', () => ({
  toFileUri: vi.fn((p) => `file://${p}`)
}))
vi.mock('../mobile-uri-import', () => ({
  importUriToPath: vi.fn(),
  inferImageExtension: vi.fn()
}))
vi.mock('../mobile-attachment-manager.emoji', () => ({
  deleteMobileEmoji: vi.fn(),
  importMobileEmoji: vi.fn(),
  listMobileEmojiAttachmentFiles: vi.fn(),
  listMobileEmojis: vi.fn(),
  resolveMobileEmojiPath: vi.fn()
}))

import { MobileAttachmentManagerService } from '../mobile-attachment-manager.service'
import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'

describe('MobileAttachmentManagerService', () => {
  const createMockServices = (
    initialFiles: Record<string, { isFile: boolean; isDir: boolean; size?: number }>
  ) => {
    const fsMap = new Map<string, { isFile: boolean; isDir: boolean; size?: number }>(
      Object.entries(initialFiles)
    )

    const pathService = {
      getAttachmentsBaseDirectory: vi.fn().mockResolvedValue('/mock/vault/Attachments'),
      getAvatarsDirectory: vi.fn().mockResolvedValue('/mock/vault/Attachments/avatars'),
      getUserAvatarsDirectory: vi
        .fn()
        .mockResolvedValue('/mock/vault/Attachments/avatars/UserAvatars'),
      getChatBackgroundsDirectory: vi.fn().mockResolvedValue('/mock/vault/Attachments/backgrounds'),
      getEmojisDirectory: vi.fn().mockResolvedValue('/mock/vault/Attachments/emojis'),
      getJournalsBaseDirectory: vi.fn().mockResolvedValue('/mock/vault/Journals')
    } as unknown as IStoragePathService

    const fileSystem = {
      exists: vi.fn(async (p: string) => fsMap.has(p)),
      readdir: vi.fn(async (p: string) => {
        const prefix = p.endsWith('/') ? p : `${p}/`
        const entries = new Set<string>()
        for (const key of fsMap.keys()) {
          if (key.startsWith(prefix)) {
            const rel = key.slice(prefix.length)
            const firstSegment = rel.split('/')[0]
            if (firstSegment) entries.add(firstSegment)
          }
        }
        return Array.from(entries)
      }),
      stat: vi.fn(async (p: string) => {
        const entry = fsMap.get(p)
        if (!entry) throw new Error(`Not found: ${p}`)
        return {
          isFile: entry.isFile,
          isDirectory: entry.isDir,
          size: entry.size ?? 0
        }
      }),
      rm: vi.fn(async (p: string) => {
        for (const key of Array.from(fsMap.keys())) {
          if (key === p || key.startsWith(`${p}/`)) {
            fsMap.delete(key)
          }
        }
      }),
      unlink: vi.fn(async (p: string) => {
        fsMap.delete(p)
      }),
      writeFile: vi.fn(async (p: string) => {
        fsMap.set(p, { isFile: true, isDir: false, size: 0 })
      }),
      mkdir: vi.fn(async (p: string) => {
        fsMap.set(p, { isFile: false, isDir: true })
      })
    } as unknown as IFileSystem

    const service = new MobileAttachmentManagerService(pathService, fileSystem)
    return { service, pathService, fileSystem, fsMap }
  }

  it('ignores attachment pool folders (emojis, avatars, backgrounds) in listSessionGroups', async () => {
    const { service } = createMockServices({
      '/mock/vault/Attachments': { isFile: false, isDir: true },
      '/mock/vault/Attachments/emojis': { isFile: false, isDir: true },
      '/mock/vault/Attachments/emojis/.nomedia': { isFile: true, isDir: false, size: 0 },
      '/mock/vault/Attachments/emojis/sticker1.png': { isFile: true, isDir: false, size: 1024 },
      '/mock/vault/Attachments/avatars': { isFile: false, isDir: true },
      '/mock/vault/Attachments/avatars/user.png': { isFile: true, isDir: false, size: 2048 },
      '/mock/vault/Attachments/backgrounds': { isFile: false, isDir: true },
      '/mock/vault/Attachments/backgrounds/bg.png': { isFile: true, isDir: false, size: 4096 },
      '/mock/vault/Attachments/session-1': { isFile: false, isDir: true },
      '/mock/vault/Attachments/session-1/doc.pdf': { isFile: true, isDir: false, size: 1048576 }
    })

    const groups = await service.listSessionGroups(new Set(['session-1']))
    expect(groups.length).toBe(1)
    expect(groups[0].sessionId).toBe('session-1')
    expect(groups[0].fileCount).toBe(1)
    expect(groups[0].files[0].name).toBe('doc.pdf')
  })

  it('skips .nomedia files when listing session group items', async () => {
    const { service } = createMockServices({
      '/mock/vault/Attachments': { isFile: false, isDir: true },
      '/mock/vault/Attachments/session-2': { isFile: false, isDir: true },
      '/mock/vault/Attachments/session-2/.nomedia': { isFile: true, isDir: false, size: 0 },
      '/mock/vault/Attachments/session-2/photo.jpg': { isFile: true, isDir: false, size: 2097152 }
    })

    const groups = await service.listSessionGroups(new Set())
    expect(groups.length).toBe(1)
    expect(groups[0].sessionId).toBe('session-2')
    expect(groups[0].isOrphan).toBe(true)
    expect(groups[0].fileCount).toBe(1)
    expect(groups[0].files[0].name).toBe('photo.jpg')
    expect(groups[0].files.some((f) => f.name === '.nomedia')).toBe(false)
  })

  it('refuses to delete attachment pool folders in deleteBatch', async () => {
    const { service, fileSystem } = createMockServices({
      '/mock/vault/Attachments': { isFile: false, isDir: true },
      '/mock/vault/Attachments/emojis': { isFile: false, isDir: true },
      '/mock/vault/Attachments/avatars': { isFile: false, isDir: true },
      '/mock/vault/Attachments/backgrounds': { isFile: false, isDir: true },
      '/mock/vault/Attachments/session-orphan': { isFile: false, isDir: true }
    })

    await service.deleteBatch(['emojis', 'avatars', 'backgrounds', 'session-orphan'])
    expect(fileSystem.rm).toHaveBeenCalledTimes(1)
    expect(fileSystem.rm).toHaveBeenCalledWith('/mock/vault/Attachments/session-orphan', {
      recursive: true,
      force: true
    })
  })

  it('refuses to delete pool files or .nomedia via deleteFile', async () => {
    const { service, fileSystem } = createMockServices({
      '/mock/vault/Attachments': { isFile: false, isDir: true },
      '/mock/vault/Attachments/emojis': { isFile: false, isDir: true },
      '/mock/vault/Attachments/emojis/.nomedia': { isFile: true, isDir: false, size: 0 },
      '/mock/vault/Attachments/session-1': { isFile: false, isDir: true },
      '/mock/vault/Attachments/session-1/.nomedia': { isFile: true, isDir: false, size: 0 },
      '/mock/vault/Attachments/session-1/img.png': { isFile: true, isDir: false, size: 100 }
    })

    await service.deleteFile('emojis', '.nomedia')
    expect(fileSystem.unlink).not.toHaveBeenCalled()

    await service.deleteFile('session-1', '.nomedia')
    expect(fileSystem.unlink).not.toHaveBeenCalled()

    await service.deleteFile('session-1', 'img.png')
    expect(fileSystem.unlink).toHaveBeenCalledWith('/mock/vault/Attachments/session-1/img.png')
  })
})
