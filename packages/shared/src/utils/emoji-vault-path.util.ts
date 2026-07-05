import { resolveAttachmentAbsolutePath } from './message-attachment.util'

/** 配置与落库使用的表情包相对键（实际文件在 Attachments/emojis/ 下） */
export const EMOJI_VAULT_RELATIVE_PREFIX = 'emojis/'

/** 将表情包相对键转为 Vault 内 Attachments 下的完整相对路径 */
export function emojiVaultKeyToAttachmentsRelativePath(relativePath: string): string {
  const trimmed = relativePath.trim().replace(/\\/g, '/')
  if (!trimmed) return trimmed

  const withoutLocal = trimmed.replace(/^local:\/\/+\/?/i, '')
  if (withoutLocal.startsWith('Attachments/emojis/')) {
    return withoutLocal
  }
  if (withoutLocal.startsWith(EMOJI_VAULT_RELATIVE_PREFIX)) {
    return `Attachments/${withoutLocal}`
  }

  const abs = resolveAttachmentAbsolutePath(trimmed).replace(/\\/g, '/')
  if (abs.startsWith('Attachments/emojis/')) {
    return abs
  }
  if (abs.startsWith(EMOJI_VAULT_RELATIVE_PREFIX)) {
    return `Attachments/${abs}`
  }

  const match = abs.match(/(?:^|\/)emojis\/(.+)$/i)
  if (match?.[1]) {
    return `Attachments/emojis/${match[1]}`
  }

  return trimmed
}

export function isEmojiVaultRelativePath(filePath?: string): boolean {
  if (!filePath?.trim()) return false
  const normalized = filePath.trim().replace(/\\/g, '/')
  if (normalized.startsWith(EMOJI_VAULT_RELATIVE_PREFIX)) return true
  if (/^local:\/\/+\/?emojis\//i.test(normalized)) return true
  if (normalized.includes('/Attachments/emojis/')) return true
  const abs = resolveAttachmentAbsolutePath(normalized).replace(/\\/g, '/')
  return abs.startsWith(EMOJI_VAULT_RELATIVE_PREFIX) || abs.includes('/Attachments/emojis/')
}
