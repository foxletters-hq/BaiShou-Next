import i18n from 'i18next'
import type {
  EmojiAttachmentFileItem,
  EmojiImportResult,
  IFileSystem,
  IStoragePathService
} from '@baishou/core-mobile'
import { joinPath, basename } from '@baishou/core-mobile'
import { importUriToPath } from './mobile-uri-import'
import { toFileUri } from './android-external-fs'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'])

type EmojiDeps = {
  pathService: IStoragePathService
  fileSystem: IFileSystem
}

export async function importMobileEmoji(
  deps: EmojiDeps,
  absoluteSourcePath: string
): Promise<EmojiImportResult> {
  if (!absoluteSourcePath || absoluteSourcePath.trim() === '') {
    return {
      relativePath: '',
      originalName: '',
      error: i18n.t(
        'auto.apps.mobile.src.services.mobile.attachment.manager.service.L360',
        '源路径为空'
      )
    }
  }
  if (absoluteSourcePath.startsWith('emojis/')) {
    return { relativePath: absoluteSourcePath, originalName: '', error: null }
  }

  try {
    const emojisDir = await deps.pathService.getEmojisDirectory()

    if (absoluteSourcePath.startsWith('data:image/')) {
      const matches = absoluteSourcePath.match(/^data:image\/([^;]+);base64,(.+)$/)
      if (matches && matches.length === 3) {
        const extension =
          matches[1] === 'jpeg' ? '.jpg' : `.${matches[1]!.replace(/[^a-zA-Z0-9]/g, '')}`
        const generatedName = `emoji_${Date.now()}${extension}`
        const dest = joinPath(emojisDir, generatedName)
        await importUriToPath(absoluteSourcePath, dest, deps.fileSystem)
        return {
          relativePath: `emojis/${generatedName}`,
          originalName: generatedName.replace(/\.[^.]+$/, ''),
          error: null
        }
      }
    }

    const sourceUri =
      absoluteSourcePath.startsWith('file://') || absoluteSourcePath.startsWith('content://')
        ? absoluteSourcePath
        : toFileUri(absoluteSourcePath)

    const originalBasename = basename(absoluteSourcePath.split('?')[0])
    const originalNameWithoutExt = originalBasename.replace(/\.[^.]+$/, '')
    const targetFileName = originalBasename
    const targetPath = joinPath(emojisDir, targetFileName)

    if (await deps.fileSystem.exists(targetPath)) {
      return {
        relativePath: `emojis/${targetFileName}`,
        originalName: originalNameWithoutExt,
        error: null
      }
    }

    await importUriToPath(sourceUri, targetPath, deps.fileSystem)
    return {
      relativePath: `emojis/${targetFileName}`,
      originalName: originalNameWithoutExt,
      error: null
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      relativePath: '',
      originalName: '',
      error: `导入失败: ${message}`
    }
  }
}

export async function resolveMobileEmojiPath(
  deps: EmojiDeps,
  relativePath: string
): Promise<string> {
  if (!relativePath || !relativePath.startsWith('emojis/')) {
    return relativePath
  }
  const filename = basename(relativePath)
  const emojisDir = await deps.pathService.getEmojisDirectory()
  const absPath = joinPath(emojisDir, filename)

  if (!(await deps.fileSystem.exists(absPath))) {
    throw new Error('EMOJI_FILE_NOT_FOUND')
  }
  return toFileUri(absPath)
}

export async function listMobileEmojiAttachmentFiles(
  deps: EmojiDeps
): Promise<EmojiAttachmentFileItem[]> {
  const emojisDir = await deps.pathService.getEmojisDirectory()
  try {
    if (!(await deps.fileSystem.exists(emojisDir))) return []
    const entries = await deps.fileSystem.readdir(emojisDir)
    const files: EmojiAttachmentFileItem[] = []
    for (const name of entries) {
      const ext = name.substring(name.lastIndexOf('.')).toLowerCase()
      if (!IMAGE_EXTENSIONS.has(ext)) continue
      const absPath = joinPath(emojisDir, name)
      let sizeMB = 0
      let birthtime = ''
      try {
        const st = await deps.fileSystem.stat(absPath)
        sizeMB = (st.size ?? 0) / (1024 * 1024)
        birthtime = st.mtimeMs ? new Date(st.mtimeMs).toISOString() : ''
      } catch {
        /* 列目录仍返回文件，体积未知时按 0 */
      }
      files.push({
        name,
        path: absPath,
        relativePath: `emojis/${name}`,
        sizeMB,
        birthtime
      })
    }
    return files
  } catch {
    return []
  }
}

export async function listMobileEmojis(deps: EmojiDeps): Promise<string[]> {
  const files = await listMobileEmojiAttachmentFiles(deps)
  return files.map((file) => file.relativePath)
}

export async function deleteMobileEmoji(deps: EmojiDeps, relativePath: string): Promise<boolean> {
  if (!relativePath || !relativePath.startsWith('emojis/')) {
    return false
  }
  const filename = basename(relativePath)
  const emojisDir = await deps.pathService.getEmojisDirectory()
  const absPath = joinPath(emojisDir, filename)

  try {
    if (await deps.fileSystem.exists(absPath)) {
      await deps.fileSystem.unlink(absPath)
      return true
    }
    return false
  } catch {
    return false
  }
}
