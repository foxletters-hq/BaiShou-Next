import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { IStoragePathService } from '../vault/storage-path.types'

export class AttachmentBackgroundOps {
  constructor(private readonly pathProvider: IStoragePathService) {}

  /**
   * Import a background image into the Vault backgrounds pool.
   * Handles both data URLs and file paths.
   * Returns a relative path like 'backgrounds/bg_1234567890.jpg'.
   */
  async importBackground(absoluteSourcePath: string): Promise<string> {
    if (!absoluteSourcePath || absoluteSourcePath.trim() === '') {
      return absoluteSourcePath
    }
    if (absoluteSourcePath.startsWith('backgrounds/')) {
      return absoluteSourcePath
    }

    if (absoluteSourcePath.startsWith('local://')) {
      try {
        const { fileURLToPath } = await import('node:url')
        const fileUrlNode = absoluteSourcePath.replace(/^local:/i, 'file:')
        absoluteSourcePath = fileURLToPath(fileUrlNode)
      } catch {
        absoluteSourcePath = decodeURIComponent(absoluteSourcePath.slice('local://'.length))
      }
    }

    try {
      const backgroundsDir = await this.pathProvider.getChatBackgroundsDirectory()

      if (absoluteSourcePath.startsWith('data:image/')) {
        const matches = absoluteSourcePath.match(/^data:image\/([^;]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          const extension =
            matches[1] === 'jpeg' ? '.jpg' : `.${matches[1]!.replace(/[^a-zA-Z0-9]/g, '')}`
          const newFileName = `bg_${Date.now()}${extension}`
          const newPath = path.join(backgroundsDir, newFileName)

          await fs.writeFile(newPath, Buffer.from(matches[2]!, 'base64'))
          return `backgrounds/${newFileName}`
        }
      }

      if (!existsSync(absoluteSourcePath)) {
        console.warn(`[AttachmentManager] Background source file not found: ${absoluteSourcePath}`)
        return ''
      }

      const ext = path.extname(absoluteSourcePath).toLowerCase()
      const newFileName = `bg_${Date.now()}${ext}`
      const newPath = path.join(backgroundsDir, newFileName)

      await fs.copyFile(absoluteSourcePath, newPath)
      return `backgrounds/${newFileName}`
    } catch (e) {
      console.error('[AttachmentManager] Failed to import background:', e)
      return absoluteSourcePath
    }
  }

  /**
   * Resolve a relative background path to a local:// absolute URI for rendering.
   */
  async resolveBackgroundPath(relativePath: string): Promise<string> {
    if (!relativePath || !relativePath.startsWith('backgrounds/')) {
      return relativePath
    }

    const filename = relativePath.split(/[/\\]/).pop() || relativePath
    const backgroundsDir = await this.pathProvider.getChatBackgroundsDirectory()
    const absPath = path.join(backgroundsDir, filename)

    if (!existsSync(absPath)) {
      console.warn(`[AttachmentManager] Background file not found: ${relativePath}`)
      throw new Error('BACKGROUND_FILE_NOT_FOUND')
    }

    return pathToFileURL(absPath).toString().replace(/^file:/i, 'local:')
  }
}