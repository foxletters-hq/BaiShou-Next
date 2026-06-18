import type { IAttachmentManager, IFileSystem } from '@baishou/core-mobile'
import {
  isBuiltinAssistantAvatarPath,
  isDefaultAssistantAvatarPath,
  parseBuiltinAssistantAvatarId,
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID
} from '@baishou/shared'
import { Image } from 'react-native'
import { NATIVE_BUILTIN_ASSISTANT_AVATAR_SOURCES } from '@baishou/ui/native'
import { isExternalStoragePath, stripFileScheme, toFileUri } from '../services/android-external-fs'
import type { AttachmentImagePurpose } from '../utils/mobile-attachment-image-cache'
import { resolveAttachmentImageDataUri } from '../utils/mobile-attachment-image-resolver'
import { resolveAssistantAvatarDisplayUri } from './assistant-avatar-uri'
import { invalidateUserAvatarDisplayCache } from './user-avatar-display.util'

const avatarDisplayCache = new Map<string, string>()

type AvatarCacheMode = 'builtin' | 'fast' | 'full'

function avatarCacheKey(avatarPath: string, mode: AvatarCacheMode): string {
  return mode === 'builtin' ? avatarPath : `${avatarPath}::${mode}`
}

function resolveCacheMode(options?: ResolveAssistantAvatarOptions): AvatarCacheMode {
  return options?.preferFileUri === false ? 'full' : 'fast'
}

function deleteAvatarCacheKeys(avatarPath: string): void {
  avatarDisplayCache.delete(avatarPath)
  avatarDisplayCache.delete(avatarCacheKey(avatarPath, 'fast'))
  avatarDisplayCache.delete(avatarCacheKey(avatarPath, 'full'))
}

/** 外部存储头像需读为 data: URI，RN Image 才能显示 BaiShou_Root 下的文件 */
async function toDisplayableAvatarUri(
  uri: string,
  fileSystem: IFileSystem,
  options?: { preferFileUri?: boolean }
): Promise<string> {
  if (!uri) return uri
  if (uri.startsWith('data:') || uri.startsWith('content://')) return uri

  const absPath = stripFileScheme(uri)
  if (!isExternalStoragePath(absPath)) {
    return uri.startsWith('file://') ? uri : toFileUri(absPath)
  }

  const purpose: AttachmentImagePurpose = options?.preferFileUri === false ? 'preview' : 'thumbnail'
  const dataUri = await resolveAttachmentImageDataUri(fileSystem, absPath, purpose)
  if (dataUri) return dataUri

  console.warn('[AssistantAvatar] failed to resolve external avatar, falling back to file://')
  return toFileUri(absPath)
}

export function invalidateAssistantAvatarDisplayCache(avatarPath?: string): void {
  if (avatarPath) {
    deleteAvatarCacheKeys(avatarPath)
    return
  }
  avatarDisplayCache.clear()
}

/** 同步读取已解析的伙伴头像 URI；内置头像会立即预热缓存 */
export function peekAssistantAvatarDisplayCache(
  avatarPath?: string | null,
  options?: ResolveAssistantAvatarOptions
): string | undefined {
  if (!avatarPath) return undefined

  if (isDefaultAssistantAvatarPath(avatarPath) || isBuiltinAssistantAvatarPath(avatarPath)) {
    const cacheKey = avatarCacheKey(avatarPath, 'builtin')
    const cached = avatarDisplayCache.get(cacheKey)
    if (cached) return cached
    const id = parseBuiltinAssistantAvatarId(avatarPath) ?? DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID
    const source = NATIVE_BUILTIN_ASSISTANT_AVATAR_SOURCES[id]
    const displayUri = Image.resolveAssetSource(source).uri
    avatarDisplayCache.set(cacheKey, displayUri)
    return displayUri
  }

  const cacheMode = resolveCacheMode(options)
  return avatarDisplayCache.get(avatarCacheKey(avatarPath, cacheMode))
}

export function invalidateAllAvatarDisplayCaches(): void {
  avatarDisplayCache.clear()
  invalidateUserAvatarDisplayCache()
}

export type ResolveAssistantAvatarOptions = {
  /** false 时用稍大的预览图；默认缩略图，适合列表/侧边栏 */
  preferFileUri?: boolean
}

/** 将 settings 中的 avatarPath 解析为移动端 Image 可展示的 URI */
export async function resolveAssistantAvatarForMobileUi(
  avatarPath: string | undefined,
  attachmentManager: IAttachmentManager,
  fileSystem: IFileSystem,
  options?: ResolveAssistantAvatarOptions
): Promise<string | undefined> {
  if (!avatarPath) return undefined

  if (isDefaultAssistantAvatarPath(avatarPath) || isBuiltinAssistantAvatarPath(avatarPath)) {
    const cacheKey = avatarCacheKey(avatarPath, 'builtin')
    const cached = avatarDisplayCache.get(cacheKey)
    if (cached) return cached
    const id = parseBuiltinAssistantAvatarId(avatarPath) ?? DEFAULT_BUILTIN_ASSISTANT_AVATAR_ID
    const source = NATIVE_BUILTIN_ASSISTANT_AVATAR_SOURCES[id]
    const displayUri = Image.resolveAssetSource(source).uri
    avatarDisplayCache.set(cacheKey, displayUri)
    return displayUri
  }

  const cacheMode = resolveCacheMode(options)
  const cacheKey = avatarCacheKey(avatarPath, cacheMode)
  const cached = avatarDisplayCache.get(cacheKey)
  if (cached) return cached

  const resolved = await resolveAssistantAvatarDisplayUri(avatarPath, (path) =>
    attachmentManager.resolveAvatarPath(path)
  )
  if (!resolved) return undefined

  const displayUri = await toDisplayableAvatarUri(resolved, fileSystem, options)
  avatarDisplayCache.set(cacheKey, displayUri)
  return displayUri
}
