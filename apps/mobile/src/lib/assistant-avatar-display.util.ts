import type { IAttachmentManager, IFileSystem } from '@baishou/core-mobile'
import { guessImageMimeType } from '@baishou/ui/native'
import { isExternalStoragePath, stripFileScheme, toFileUri } from '../services/android-external-fs'
import { resolveAssistantAvatarDisplayUri } from './assistant-avatar-uri'

const avatarDisplayCache = new Map<string, string>()

/** 外部存储头像需读为 data: URI，RN Image 才能显示 BaiShou_Root 下的文件 */
async function toDisplayableAvatarUri(uri: string, fileSystem: IFileSystem): Promise<string> {
  if (!uri) return uri
  if (uri.startsWith('data:') || uri.startsWith('content://')) return uri

  const absPath = stripFileScheme(uri)
  if (!isExternalStoragePath(absPath)) {
    return uri.startsWith('file://') ? uri : toFileUri(absPath)
  }

  try {
    const fileName = absPath.split('/').pop() || 'avatar.jpg'
    const b64 = await fileSystem.readFile(absPath, 'base64')
    if (!b64) return toFileUri(absPath)
    return `data:${guessImageMimeType(fileName)};base64,${b64}`
  } catch (e) {
    console.warn('[AssistantAvatar] read data URI failed:', e)
    return toFileUri(absPath)
  }
}

export function invalidateAssistantAvatarDisplayCache(avatarPath?: string): void {
  if (avatarPath) {
    avatarDisplayCache.delete(avatarPath)
    return
  }
  avatarDisplayCache.clear()
}

/** 将 settings 中的 avatarPath 解析为移动端 Image 可展示的 URI */
export async function resolveAssistantAvatarForMobileUi(
  avatarPath: string | undefined,
  attachmentManager: IAttachmentManager,
  fileSystem: IFileSystem
): Promise<string | undefined> {
  if (!avatarPath) return undefined

  const cached = avatarDisplayCache.get(avatarPath)
  if (cached) return cached

  const resolved = await resolveAssistantAvatarDisplayUri(avatarPath, (path) =>
    attachmentManager.resolveAvatarPath(path)
  )
  if (!resolved) return undefined

  const displayUri = await toDisplayableAvatarUri(resolved, fileSystem)
  avatarDisplayCache.set(avatarPath, displayUri)
  return displayUri
}
