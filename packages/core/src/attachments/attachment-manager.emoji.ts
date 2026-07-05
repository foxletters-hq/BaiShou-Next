import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { IStoragePathService } from '../vault/storage-path.types'
import type { EmojiImportResult } from './attachment-manager.types'

export type { EmojiImportResult }

export class AttachmentEmojiOps {
  constructor(private readonly pathProvider: IStoragePathService) {}

  /**
   * Import an emoji image into the Vault emojis pool.
   * **保留原始文件名**，使 AI 能通过文件名理解表情包含义。
   * 若目标文件已存在（同名冲突），则返回错误而非覆盖。
   *
   * @returns EmojiImportResult 包含相对路径和可能的错误信息
   */
  async importEmoji(absoluteSourcePath: string): Promise<EmojiImportResult> {
    if (!absoluteSourcePath || absoluteSourcePath.trim() === '') {
      return { relativePath: '', originalName: '', error: '源路径为空' }
    }
    if (absoluteSourcePath.startsWith('emojis/')) {
      return { relativePath: absoluteSourcePath, originalName: '', error: null }
    }

    // Handle local:// URIs
    if (absoluteSourcePath.startsWith('local://')) {
      const match = absoluteSourcePath.match(/emojis[/\\]([^/\\]+)$/)
      if (match) {
        return { relativePath: `emojis/${match[1]}`, originalName: '', error: null }
      }
      try {
        const fileUrlNode = absoluteSourcePath.replace(/^local:/i, 'file:')
        const { fileURLToPath } = await import('node:url')
        absoluteSourcePath = fileURLToPath(fileUrlNode)
      } catch {
        absoluteSourcePath = decodeURIComponent(absoluteSourcePath.slice('local://'.length))
      }
    }

    try {
      const emojisDir = await this.pathProvider.getEmojisDirectory()

      // Handle data URLs — 生成一个带时间戳的文件名（data URL 无法提取有意义的原始名）
      if (absoluteSourcePath.startsWith('data:image/')) {
        const matches = absoluteSourcePath.match(/^data:image\/([^;]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          const extension =
            matches[1] === 'jpeg' ? '.jpg' : `.${matches[1]!.replace(/[^a-zA-Z0-9]/g, '')}`
          // data URL 没有原始文件名，用时间戳作为兜底
          const generatedName = `emoji_${Date.now()}${extension}`
          const newPath = path.join(emojisDir, generatedName)

          await fs.writeFile(newPath, Buffer.from(matches[2]!, 'base64'))
          return {
            relativePath: `emojis/${generatedName}`,
            originalName: generatedName.replace(/\.[^.]+$/, ''),
            error: null
          }
        }
      }

      // Handle file paths — 保留原始文件名
      if (!existsSync(absoluteSourcePath)) {
        return {
          relativePath: '',
          originalName: '',
          error: `源文件不存在: ${path.basename(absoluteSourcePath)}`
        }
      }

      const originalBasename = path.basename(absoluteSourcePath)
      const originalNameWithoutExt = originalBasename.replace(/\.[^.]+$/, '')
      const targetFileName = originalBasename
      const targetPath = path.join(emojisDir, targetFileName)

      // 检查名称冲突：如果目标文件已存在且不是当前源文件自身（同文件同目录不算冲突）
      if (existsSync(targetPath)) {
        const srcRealPath = await fs.realpath(absoluteSourcePath)
        const dstRealPath = await fs.realpath(targetPath).catch(() => '')
        if (srcRealPath !== dstRealPath) {
          return {
            relativePath: '',
            originalName: originalNameWithoutExt,
            error: `文件名冲突: "${targetFileName}" 已存在，请重命名后重试`
          }
        }
        // 同一个文件，跳过导入
        return {
          relativePath: `emojis/${targetFileName}`,
          originalName: originalNameWithoutExt,
          error: null
        }
      }

      await fs.copyFile(absoluteSourcePath, targetPath)
      return {
        relativePath: `emojis/${targetFileName}`,
        originalName: originalNameWithoutExt,
        error: null
      }
    } catch (e: any) {
      console.error('[AttachmentManager] Failed to import emoji:', e)
      return {
        relativePath: '',
        originalName: '',
        error: `导入失败: ${e?.message || String(e)}`
      }
    }
  }

  /**
   * Resolve a relative emoji path to a local:// absolute URI for rendering.
   */
  async resolveEmojiPath(relativePath: string): Promise<string> {
    if (!relativePath || !relativePath.startsWith('emojis/')) {
      return relativePath
    }

    const filename = relativePath.split(/[/\\]/).pop() || relativePath
    const emojisDir = await this.pathProvider.getEmojisDirectory()
    const absPath = path.join(emojisDir, filename)

    if (!existsSync(absPath)) {
      console.warn(`[AttachmentManager] Emoji file not found: ${relativePath}`)
      throw new Error('EMOJI_FILE_NOT_FOUND')
    }

    return pathToFileURL(absPath)
      .toString()
      .replace(/^file:/i, 'local:')
  }

  /**
   * List all emoji files in the emojis directory.
   * Returns an array of relative paths like 'emojis/猫猫头.png'.
   */
  async listEmojis(): Promise<string[]> {
    const emojisDir = await this.pathProvider.getEmojisDirectory()
    try {
      const entries = await fs.readdir(emojisDir)
      const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'])
      return entries
        .filter((name) => imageExtensions.has(path.extname(name).toLowerCase()))
        .map((name) => `emojis/${name}`)
    } catch {
      return []
    }
  }

  /**
   * Delete an emoji file by its relative path.
   */
  async deleteEmoji(relativePath: string): Promise<boolean> {
    if (!relativePath || !relativePath.startsWith('emojis/')) {
      return false
    }

    const filename = relativePath.split(/[/\\]/).pop() || relativePath
    const emojisDir = await this.pathProvider.getEmojisDirectory()
    const absPath = path.join(emojisDir, filename)

    try {
      if (existsSync(absPath)) {
        await fs.unlink(absPath)
        return true
      }
      return false
    } catch {
      return false
    }
  }
}