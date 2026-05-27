import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import type { IStoragePathService } from '../vault/storage-path.types'

export class AttachmentAvatarOps {
  constructor(private readonly pathProvider: IStoragePathService) {}

  async importAvatar(absoluteSourcePath: string, prefix: string = 'avatar'): Promise<string> {
    if (!absoluteSourcePath || absoluteSourcePath.trim() === '') {
      return absoluteSourcePath
    }
    if (absoluteSourcePath.startsWith('avatars/')) {
      return absoluteSourcePath
    }

    if (absoluteSourcePath.startsWith('local://')) {
      const match = absoluteSourcePath.match(/avatars[/\\]([^/\\]+)$/)
      if (match) {
        return `avatars/${match[1]}`
      }
      try {
        const fileUrlNode = absoluteSourcePath.replace(/^local:/i, 'file:')
        absoluteSourcePath = fileURLToPath(fileUrlNode)
      } catch {
        console.warn('[AttachmentManager] fallback parsing local URI')
        absoluteSourcePath = decodeURIComponent(absoluteSourcePath.slice('local://'.length))
      }
    }

    try {
      const avatarsDir = await this.pathProvider.getAvatarsDirectory()

      if (absoluteSourcePath.startsWith('data:image/')) {
        const matches = absoluteSourcePath.match(/^data:image\/([^;]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          const extension =
            matches[1] === 'jpeg' ? '.jpg' : `.${matches[1]!.replace(/[^a-zA-Z0-9]/g, '')}`
          const newFileName = `${prefix}_${Date.now()}${extension}`
          const newPath = path.join(avatarsDir, newFileName)

          await fs.writeFile(newPath, Buffer.from(matches[2]!, 'base64'))
          return `avatars/${newFileName}`
        }
      }

      if (!existsSync(absoluteSourcePath)) {
        console.warn(`[AttachmentManager] Source file not found: ${absoluteSourcePath}`)
        return ''
      }

      const ext = path.extname(absoluteSourcePath).toLowerCase()
      const newFileName = `${prefix}_${Date.now()}${ext}`
      const newPath = path.join(avatarsDir, newFileName)

      await fs.copyFile(absoluteSourcePath, newPath)
      return `avatars/${newFileName}`
    } catch (e) {
      console.error('[AttachmentManager] Failed to copy/decode avatar:', e)
      return absoluteSourcePath
    }
  }

  async resolveAvatarPath(relativePath: string): Promise<string> {
    if (relativePath && relativePath.startsWith('avatars/')) {
      try {
        const avatarsDir = await this.pathProvider.getAvatarsDirectory()
        const filename = relativePath.split(/[/\\]/).pop() || relativePath
        const absPath = path.join(avatarsDir, filename)

        if (!existsSync(absPath)) {
          console.warn(`[AttachmentManager] Avatar file not found: ${absPath}`)
          throw new Error('AVATAR_FILE_NOT_FOUND')
        }

        return pathToFileURL(absPath)
          .toString()
          .replace(/^file:/i, 'local:')
      } catch (e) {
        if (e instanceof Error && e.message === 'AVATAR_FILE_NOT_FOUND') {
          throw e
        }
        console.error('[AttachmentManager] Failed to resolve avatar path:', e)
      }
    }
    return relativePath
  }
}
