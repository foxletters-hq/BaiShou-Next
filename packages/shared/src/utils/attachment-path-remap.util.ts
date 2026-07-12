import { resolveAttachmentAbsolutePath } from './message-attachment.util'

/**
 * 从任意平台绝对路径 / URI 中提取 `{VaultName}/Attachments/{rest}`。
 * 用于跨端同步后把 Android / Windows 路径映射到当前存储根。
 */
export function extractVaultAttachmentsRelativePath(rawPath: string): string | null {
  if (!rawPath?.trim()) return null
  const abs = resolveAttachmentAbsolutePath(rawPath.trim()).replace(/\\/g, '/')
  const relMatch = abs.match(/([^/]+)\/Attachments\/(.+)$/i)
  if (!relMatch?.[1] || relMatch[2] == null) return null
  return `${relMatch[1]}/Attachments/${relMatch[2]}`
}

/**
 * 将外端绝对路径（如 `/storage/emulated/0/...` 或 `D:/OtherRoot/...`）
 * 重写到当前 `storageRoot/{VaultName}/Attachments/...`。
 * 已在本机 root 下、或非 Attachments 路径则原样返回（去协议后的绝对路径）。
 */
export function remapAttachmentPathToStorageRoot(rawPath: string, storageRoot: string): string {
  if (!rawPath?.trim()) return ''
  const trimmed = rawPath.trim()
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed
  }

  const root = storageRoot.replace(/\\/g, '/').replace(/\/+$/, '')
  const abs = resolveAttachmentAbsolutePath(trimmed).replace(/\\/g, '/')
  if (!root) return abs

  if (abs === root || abs.startsWith(`${root}/`)) {
    return abs
  }

  const relative = extractVaultAttachmentsRelativePath(trimmed)
  if (relative) {
    return `${root}/${relative}`
  }

  return abs
}
