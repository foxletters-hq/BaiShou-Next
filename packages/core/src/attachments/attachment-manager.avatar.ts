import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import type { IStoragePathService } from '../vault/storage-path.types'

type AvatarPathProvider = IStoragePathService & {
  getGlobalAgentAvatarsDirectory?: () => Promise<string>
  listAgentAvatarSearchDirectories?: () => Promise<string[]>
}

function isUserAvatarRelativePath(relativePath: string): boolean {
  const filename = relativePath.split(/[/\\]/).pop() || relativePath
  if (filename.startsWith('user_avatar')) return true
  if (/^avatar_\d+/.test(filename)) return true
  if (filename.startsWith('avatar_imported_')) return true
  return false
}

function isPartnerAvatarImportPrefix(prefix: string): boolean {
  return prefix === 'agent' || prefix.startsWith('agent_')
}

export class AttachmentAvatarOps {
  constructor(private readonly pathProvider: AvatarPathProvider) {}

  private extendedProvider(): AvatarPathProvider {
    return this.pathProvider
  }

  private isUserAvatarPrefix(prefix: string): boolean {
    return prefix === 'user_avatar' || prefix.startsWith('user_avatar')
  }

  private async getAvatarsDirectoriesForImport(prefix: string): Promise<string> {
    if (this.isUserAvatarPrefix(prefix)) {
      return await this.pathProvider.getUserAvatarsDirectory()
    }
    // 伙伴头像必须落在 vault 内 Attachments/avatars，才能被增量同步扫描上传
    return await this.pathProvider.getAvatarsDirectory()
  }

  /** 桌面端额外镜像到全局目录，便于跨 vault 本地解析；同步仍以 vault 副本为准 */
  private async mirrorPartnerAvatarToGlobalIfNeeded(
    prefix: string,
    absoluteAvatarPath: string,
    fileName: string
  ): Promise<void> {
    if (!isPartnerAvatarImportPrefix(prefix)) return
    const extended = this.extendedProvider()
    if (!extended.getGlobalAgentAvatarsDirectory) return
    try {
      const globalDir = await extended.getGlobalAgentAvatarsDirectory()
      const dest = path.join(globalDir, fileName)
      if (path.normalize(dest) === path.normalize(absoluteAvatarPath)) return
      let shouldCopy = !existsSync(dest)
      if (!shouldCopy) {
        try {
          const [srcStat, destStat] = await Promise.all([
            fs.stat(absoluteAvatarPath),
            fs.stat(dest)
          ])
          // 源更新更晚时覆盖全局陈旧副本，避免多 vault 解析一直命中旧头像
          shouldCopy = srcStat.mtimeMs > destStat.mtimeMs
        } catch {
          shouldCopy = true
        }
      }
      if (shouldCopy) {
        await fs.copyFile(absoluteAvatarPath, dest)
      }
    } catch (e) {
      console.warn('[AttachmentManager] Failed to mirror partner avatar to global dir:', e)
    }
  }

  private async getAvatarsDirectoriesForResolve(relativePath: string): Promise<string[]> {
    if (!relativePath.startsWith('avatars/')) {
      return []
    }
    if (isUserAvatarRelativePath(relativePath)) {
      const userDir = await this.pathProvider.getUserAvatarsDirectory()
      const vaultDir = await this.pathProvider.getAvatarsDirectory()
      return [userDir, vaultDir]
    }
    const extended = this.extendedProvider()
    if (extended.listAgentAvatarSearchDirectories) {
      return extended.listAgentAvatarSearchDirectories()
    }
    return [await this.pathProvider.getAvatarsDirectory()]
  }

  async importAvatar(
    absoluteSourcePath: string,
    prefix: string = 'avatar',
    _sourceByteSize?: number
  ): Promise<string> {
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
      const avatarsDir = await this.getAvatarsDirectoriesForImport(prefix)

      if (absoluteSourcePath.startsWith('data:image/')) {
        const matches = absoluteSourcePath.match(/^data:image\/([^;]+);base64,(.+)$/)
        if (matches && matches.length === 3) {
          const extension =
            matches[1] === 'jpeg' ? '.jpg' : `.${matches[1]!.replace(/[^a-zA-Z0-9]/g, '')}`
          const newFileName = `${prefix}_${Date.now()}${extension}`
          const newPath = path.join(avatarsDir, newFileName)

          await fs.writeFile(newPath, Buffer.from(matches[2]!, 'base64'))
          await this.mirrorPartnerAvatarToGlobalIfNeeded(prefix, newPath, newFileName)
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
      await this.mirrorPartnerAvatarToGlobalIfNeeded(prefix, newPath, newFileName)
      return `avatars/${newFileName}`
    } catch (e) {
      console.error('[AttachmentManager] Failed to copy/decode avatar:', e)
      return absoluteSourcePath
    }
  }

  async resolveAvatarPath(relativePath: string): Promise<string> {
    if (!relativePath || !relativePath.startsWith('avatars/')) {
      return relativePath
    }

    const filename = relativePath.split(/[/\\]/).pop() || relativePath
    const directories = await this.getAvatarsDirectoriesForResolve(relativePath)

    for (let i = 0; i < directories.length; i++) {
      const avatarsDir = directories[i]!
      const absPath = path.join(avatarsDir, filename)
      if (!existsSync(absPath)) {
        continue
      }

      // Migrate legacy per-vault user avatars into the global folder
      if (isUserAvatarRelativePath(relativePath) && i > 0) {
        try {
          const globalDir = directories[0]!
          const globalPath = path.join(globalDir, filename)
          if (!existsSync(globalPath)) {
            await fs.copyFile(absPath, globalPath)
          }
        } catch (e) {
          console.warn('[AttachmentManager] Failed to migrate user avatar to global dir:', e)
        }
      }

      return pathToFileURL(absPath)
        .toString()
        .replace(/^file:/i, 'local:')
    }

    console.warn(`[AttachmentManager] Avatar file not found: ${relativePath}`)
    throw new Error('AVATAR_FILE_NOT_FOUND')
  }
}
