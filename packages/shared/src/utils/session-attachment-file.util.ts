import { normalizePartData, resolveAttachmentAbsolutePath } from './message-attachment.util'

/** 解码并校验会话附件文件名，拒绝路径穿越与分隔符 */
export function sanitizeSessionAttachmentFileName(raw: string): string | null {
  if (!raw) return null
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    // 保持原串
  }
  const name = decoded.trim()
  if (!name || name === '.' || name === '..') return null
  if (name.includes('..') || /[/\\]/.test(name)) return null
  return name
}

/**
 * 从附件路径中解析「仅属于该会话附件目录」的文件名。
 * 跳过 emoji/avatars/网络/内联数据；跨端绝对路径只要含 `/{sessionId}/` 即可识别。
 */
export function resolveSessionAttachmentFileName(
  sessionId: string,
  rawPath: string | undefined | null
): string | null {
  if (!rawPath?.trim() || !sessionId.trim()) return null
  const trimmed = rawPath.trim()
  if (
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('content://')
  ) {
    return null
  }

  const abs = resolveAttachmentAbsolutePath(trimmed).replace(/\\/g, '/')
  if (!abs) return null
  if (/(^|\/)emojis\//i.test(abs) || /(^|\/)avatars\//i.test(abs)) return null

  const marker = `/${sessionId}/`
  const markerIdx = abs.lastIndexOf(marker)
  if (markerIdx < 0) return null

  const rest = abs.slice(markerIdx + marker.length)
  const fileName = rest.split('/').filter(Boolean)[0]
  return sanitizeSessionAttachmentFileName(fileName ?? '')
}

/** 从即将删除的 message parts 收集会话附件文件名（去重） */
export function collectSessionAttachmentFileNames(
  sessionId: string,
  parts: ReadonlyArray<{ type?: string; data?: unknown }>
): string[] {
  const names = new Set<string>()
  for (const part of parts) {
    const type = String(part.type ?? '').toLowerCase()
    if (type !== 'image' && type !== 'attachment') continue
    const data = normalizePartData(part.data)
    for (const raw of [data.filePath, data.url]) {
      if (typeof raw !== 'string') continue
      const fileName = resolveSessionAttachmentFileName(sessionId, raw)
      if (fileName) names.add(fileName)
    }
  }
  return [...names]
}
