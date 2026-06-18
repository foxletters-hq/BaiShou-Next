import type { IAttachmentManager, IFileSystem } from '@baishou/core-mobile'
import { isCustomUserAvatar, USER_DEFAULT_AVATAR_SENTINEL } from '@baishou/shared'
import { guessImageMimeType } from '@baishou/ui/native'
import { isExternalStoragePath, stripFileScheme, toFileUri } from '../services/android-external-fs'
import { resolveAssistantAvatarDisplayUri } from './assistant-avatar-uri'

const userAvatarDisplayCache = new Map<string, string>()

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
  } catch {
    return toFileUri(absPath)
  }
}

export function invalidateUserAvatarDisplayCache(avatarPath?: string): void {
  if (avatarPath) {
    userAvatarDisplayCache.delete(avatarPath)
    return
  }
  userAvatarDisplayCache.clear()
}

/** 同步读取已解析的用户头像 URI，避免 hook 重跑时先闪默认图 */
export function peekUserAvatarDisplayCache(avatarPath?: string | null): string | undefined {
  if (
    !avatarPath ||
    !isCustomUserAvatar(avatarPath) ||
    avatarPath === USER_DEFAULT_AVATAR_SENTINEL
  ) {
    return undefined
  }
  return userAvatarDisplayCache.get(avatarPath)
}

/** 将 settings 中的用户头像路径解析为移动端 Image 可展示的 URI */
export async function resolveUserAvatarForMobileUi(
  avatarPath: string | undefined | null,
  attachmentManager: IAttachmentManager,
  fileSystem: IFileSystem
): Promise<string | undefined> {
  if (
    !avatarPath ||
    !isCustomUserAvatar(avatarPath) ||
    avatarPath === USER_DEFAULT_AVATAR_SENTINEL
  ) {
    return undefined
  }

  const cached = userAvatarDisplayCache.get(avatarPath)
  if (cached) return cached

  const resolved = await resolveAssistantAvatarDisplayUri(avatarPath, (path) =>
    attachmentManager.resolveAvatarPath(path)
  )
  if (!resolved) return undefined

  const displayUri = await toDisplayableAvatarUri(resolved, fileSystem)
  userAvatarDisplayCache.set(avatarPath, displayUri)
  return displayUri
}
