import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { IStoragePathService } from '../vault/storage-path.types'
import type { AttachmentItem, SessionAttachmentGroup } from './attachment-manager.types'
import { getDirectoryFiles, getDirectorySize } from './attachment-manager.utils'

export class AttachmentSessionOps {
  constructor(private readonly pathProvider: IStoragePathService) {}

  async listOrphans(activeSessionIds: Set<string>): Promise<AttachmentItem[]> {
    const items: AttachmentItem[] = []
    let attachBase: string
    try {
      attachBase = await this.pathProvider.getAttachmentsBaseDirectory()
      if (!existsSync(attachBase)) {
        return []
      }
    } catch {
      return []
    }

    try {
      const folders = await fs.readdir(attachBase, { withFileTypes: true })

      for (const folder of folders) {
        if (!folder.isDirectory() || folder.name === 'avatars') {
          continue
        }

        const sessionId = folder.name
        const fullDir = path.join(attachBase, sessionId)
        const { size, count } = await getDirectorySize(fullDir)

        if (count === 0 && size === 0) {
          try {
            await fs.rm(fullDir, { recursive: true, force: true })
          } catch {}
          continue
        }

        const stat = await fs.stat(fullDir)

        items.push({
          id: sessionId,
          name: sessionId,
          sizeMB: size / (1024 * 1024),
          isOrphan: !activeSessionIds.has(sessionId),
          fileCount: count,
          date: stat.mtime.toISOString()
        })
      }
    } catch (e) {
      console.error('[AttachmentManager] Error listing attachments:', e)
    }

    return items
  }

  async deleteBatch(ids: string[]): Promise<void> {
    const attachBase = await this.pathProvider.getAttachmentsBaseDirectory()
    for (const id of ids) {
      const safeId = id.replace(/[/\\]/g, '')
      if (safeId === 'avatars' || safeId.trim() === '') continue

      const targetDir = path.join(attachBase, safeId)
      try {
        if (existsSync(targetDir)) {
          await fs.rm(targetDir, { recursive: true, force: true })
        }
      } catch (e) {
        console.error(`[AttachmentManager] Failed to delete attachment directory ${targetDir}:`, e)
      }
    }
  }

  async listSessionGroups(activeSessionIds: Set<string>): Promise<SessionAttachmentGroup[]> {
    const groups: SessionAttachmentGroup[] = []
    let attachBase: string
    try {
      attachBase = await this.pathProvider.getAttachmentsBaseDirectory()
      if (!existsSync(attachBase)) {
        return []
      }
    } catch {
      return []
    }

    try {
      const folders = await fs.readdir(attachBase, { withFileTypes: true })

      for (const folder of folders) {
        if (!folder.isDirectory() || folder.name === 'avatars') {
          continue
        }

        const sessionId = folder.name
        const fullDir = path.join(attachBase, sessionId)
        const files = await getDirectoryFiles(fullDir)

        if (files.length === 0) {
          try {
            await fs.rm(fullDir, { recursive: true, force: true })
          } catch {}
          continue
        }

        const totalSizeMB = files.reduce((sum, f) => sum + f.sizeMB, 0)

        groups.push({
          sessionId,
          isOrphan: !activeSessionIds.has(sessionId),
          totalSizeMB,
          fileCount: files.length,
          files
        })
      }
    } catch (e) {
      console.error('[AttachmentManager] Error listing session groups:', e)
    }

    return groups
  }

  async deleteFile(sessionId: string, fileName: string): Promise<void> {
    const attachBase = await this.pathProvider.getAttachmentsBaseDirectory()
    const safeSessionId = sessionId.replace(/[/\\]/g, '')
    const safeFileName = fileName.replace(/[/\\]/g, '')

    if (safeSessionId === 'avatars' || safeSessionId.trim() === '' || safeFileName.trim() === '') {
      return
    }

    const targetPath = path.join(attachBase, safeSessionId, safeFileName)
    try {
      if (existsSync(targetPath)) {
        await fs.rm(targetPath, { force: true })
      }

      const dirPath = path.dirname(targetPath)
      if (existsSync(dirPath)) {
        const remaining = await fs.readdir(dirPath)
        if (remaining.length === 0) {
          await fs.rm(dirPath, { recursive: true, force: true })
        }
      }
    } catch (e) {
      console.error(`[AttachmentManager] Failed to delete attachment file ${targetPath}:`, e)
    }
  }
}
