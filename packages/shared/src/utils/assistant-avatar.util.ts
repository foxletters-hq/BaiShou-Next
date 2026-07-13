import {
  BUILTIN_ASSISTANT_AVATAR_PREFIX,
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
  isBuiltinAssistantAvatarPath
} from '../constants/builtin-assistant-avatars.constants'

/** @deprecated 旧版默认占位，读取时映射为 {@link DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH} */
export const ASSISTANT_DEFAULT_AVATAR_SENTINEL = 'default-assistant'

/** 是否使用内置伙伴头像（含 legacy 占位与 builtin 路径） */
export function isDefaultAssistantAvatarPath(avatarPath: string | null | undefined): boolean {
  if (!avatarPath) return true
  const trimmed = avatarPath.trim()
  if (!trimmed) return true
  return trimmed === ASSISTANT_DEFAULT_AVATAR_SENTINEL || isBuiltinAssistantAvatarPath(trimmed)
}

/** 将磁盘/历史占位规范为当前内置头像路径 */
export function normalizeAssistantAvatarPath(avatarPath: string | null | undefined): string {
  if (!avatarPath || !avatarPath.trim()) {
    return DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH
  }
  const trimmed = avatarPath.trim()
  if (trimmed === ASSISTANT_DEFAULT_AVATAR_SENTINEL) {
    return DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH
  }
  if (isBuiltinAssistantAvatarPath(trimmed)) {
    return trimmed
  }
  return trimmed
}

/** 伙伴头像是否为相对存储路径（需通过 AttachmentManager 解析为本地 URI） */
export function isAssistantAvatarRelativePath(avatarPath: string | null | undefined): boolean {
  if (!avatarPath) return false
  return avatarPath.startsWith('avatars/')
}

/** 是否为用户上传的自定义图片（非内置预设） */
export function isAssistantCustomAvatar(avatarPath: string | null | undefined): boolean {
  if (!avatarPath) return false
  const trimmed = avatarPath.trim()
  if (!trimmed || isDefaultAssistantAvatarPath(trimmed)) return false
  if (isAssistantAvatarRelativePath(trimmed) || isAssistantAvatarDirectUri(trimmed)) return true
  // findAll 可能已 resolve 为 local://…/avatars/… 或绝对路径，仍视为自定义
  return Boolean(extractAvatarsRelativeKey(trimmed))
}

/** 是否可直接作为 Image uri 使用（file://、local://、content:// 等） */
export function isAssistantAvatarDirectUri(avatarPath: string | null | undefined): boolean {
  if (!avatarPath) return false
  return /^(file:|local:|secure-file:|content:|https?:|data:)/i.test(avatarPath)
}

/** 从 local:// 或绝对路径中提取 `avatars/…` 相对键 */
export function extractAvatarsRelativeKey(avatarPath: string): string | null {
  const normalized = avatarPath.replace(/\\/g, '/')
  const idx = normalized.toLowerCase().lastIndexOf('avatars/')
  if (idx < 0) return null
  return normalized.slice(idx)
}

/** 将磁盘/桌面持久化路径规范为 `avatars/…` 相对键 */
export function normalizePersistedAvatarPath(
  avatarPath: string | null | undefined
): string | null | undefined {
  if (!avatarPath) return avatarPath
  const trimmed = avatarPath.trim()
  if (!trimmed) return trimmed
  if (isBuiltinAssistantAvatarPath(trimmed) || trimmed === ASSISTANT_DEFAULT_AVATAR_SENTINEL) {
    return normalizeAssistantAvatarPath(trimmed)
  }
  if (trimmed.startsWith('avatars/')) return trimmed
  const extracted = extractAvatarsRelativeKey(trimmed)
  return extracted ?? trimmed
}

/** 文件名是否为「用户身份卡」头像（存于 UserAvatars 子目录） */
export function isUserAvatarRelativePath(relativePath: string): boolean {
  const filename = relativePath.split(/[/\\]/).pop() || relativePath
  return filename.startsWith('user_avatar')
}

/** 同步相对路径是否为伙伴头像文件（Attachments/avatars/agent_*） */
export function isSyncedAgentAvatarFilePath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/')
  const base = normalized.split('/').pop() || ''
  if (!base.startsWith('agent_')) return false
  return /\/Attachments\/avatars\//i.test(`/${normalized}`)
}

/** 从同步相对路径取出伙伴头像文件名；非伙伴头像返回 null */
export function syncedAgentAvatarBasename(relPath: string): string | null {
  if (!isSyncedAgentAvatarFilePath(relPath)) return null
  return relPath.replace(/\\/g, '/').split('/').pop() || null
}

/** 从 removed / 路径列表收集伙伴头像 basename */
export function collectSyncedAgentAvatarBasenames(paths: Iterable<string>): string[] {
  const out = new Set<string>()
  for (const filePath of paths) {
    const base = syncedAgentAvatarBasename(filePath)
    if (base) out.add(base)
  }
  return [...out]
}

export { BUILTIN_ASSISTANT_AVATAR_PREFIX }
