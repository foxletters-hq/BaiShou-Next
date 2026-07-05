import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isPathUnderAllowedRoots,
  resolveAttachmentInputPath
} from '../attachment-path-cache'
import type { DesktopStoragePathService } from '../../services/path.service'

describe('isPathUnderAllowedRoots', () => {
  const roots = {
    attachmentsBase: path.join('D:', 'Vaults', 'Personal', 'Attachments'),
    journalsBase: path.join('D:', 'Vaults', 'Personal', 'Journals')
  }

  it('allows files under attachments root', () => {
    const file = path.join(roots.attachmentsBase, 'session-id', 'photo.png')
    expect(isPathUnderAllowedRoots(file, roots)).toBe(true)
  })

  it('allows files under journals root', () => {
    const file = path.join(roots.journalsBase, '2026', '06', 'attachment', 'img.png')
    expect(isPathUnderAllowedRoots(file, roots)).toBe(true)
  })

  it('rejects paths outside allowed roots', () => {
    const file = path.join('D:', 'Other', 'secret.png')
    expect(isPathUnderAllowedRoots(file, roots)).toBe(false)
  })

  it('rejects sibling directories that share a prefix', () => {
    const file = path.join('D:', 'Vaults', 'PersonalBackup', 'Attachments', 'photo.png')
    expect(isPathUnderAllowedRoots(file, roots)).toBe(false)
  })
})

describe('resolveAttachmentInputPath', () => {
  const vaultPath = path.join('D:', 'Vaults', 'Personal')
  const attachmentsBase = path.join(vaultPath, 'Attachments')
  const emojisDir = path.join(attachmentsBase, 'emojis')

  const pathService = {
    getActiveVaultPath: async () => vaultPath,
    getEmojisDirectory: async () => emojisDir
  } as unknown as DesktopStoragePathService

  it('resolves emoji vault relative keys under Attachments/emojis', async () => {
    const resolved = await resolveAttachmentInputPath('emojis/cat.png', pathService)
    expect(resolved).toBe(path.join(emojisDir, 'cat.png'))
  })

  it('resolves local protocol emoji urls', async () => {
    const resolved = await resolveAttachmentInputPath('local:///emojis/cat.png', pathService)
    expect(resolved).toBe(path.join(emojisDir, 'cat.png'))
  })

  it('keeps absolute filesystem paths unchanged', async () => {
    const absolute = path.join(emojisDir, 'cat.png')
    const resolved = await resolveAttachmentInputPath(absolute, pathService)
    expect(resolved).toBe(path.resolve(absolute))
  })
})
