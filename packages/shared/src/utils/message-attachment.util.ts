import type { MockChatAttachment } from '../mock/agent.mock'

export type MessagePartLike = {
  id?: string
  type?: string
  data?: unknown
}

/** 将 DB part.data 规范化为对象（兼容 libsql / 原始 SQL 写入的 JSON 字符串） */
export function normalizePartData(data: unknown): Record<string, unknown> {
  if (data == null) return {}
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  return {}
}

/** 将附件路径转为可在 Electron local 协议下加载的 URL */
export function resolveAttachmentImageSrc(filePath?: string): string {
  if (!filePath) return ''
  if (
    filePath.startsWith('blob:') ||
    filePath.startsWith('local://') ||
    filePath.startsWith('data:')
  ) {
    return filePath
  }
  return `local:///${filePath.replace(/\\/g, '/')}`
}

/** 将 local:// / file:// 路径还原为本地绝对路径，供 shell.openPath 等使用 */
export function resolveAttachmentAbsolutePath(filePath?: string): string {
  if (!filePath) return ''
  if (filePath.startsWith('local:///')) {
    return decodeURIComponent(filePath.slice('local:///'.length))
  }
  if (filePath.startsWith('local://')) {
    return decodeURIComponent(filePath.slice('local://'.length))
  }
  if (filePath.startsWith('file:')) {
    // file:///storage/... → /storage/...；file:///D:/x → D:/x
    const rest = decodeURIComponent(filePath.replace(/^file:\/\//i, ''))
    if (/^\/[a-zA-Z]:/.test(rest)) {
      return rest.slice(1)
    }
    return rest
  }
  return filePath
}

function toLocalAttachmentPath(rawPath: string): string {
  if (!rawPath) return ''
  if (
    rawPath.startsWith('blob:') ||
    rawPath.startsWith('local://') ||
    rawPath.startsWith('data:')
  ) {
    return rawPath
  }
  if (rawPath.startsWith('file://')) {
    return rawPath.replace(/^file:/i, 'local:')
  }
  const normalized = rawPath.replace(/\\/g, '/')
  if (normalized.startsWith('emojis/')) {
    return `local:///${normalized}`
  }
  if (/^[a-zA-Z]:[\\/]/.test(rawPath) || rawPath.startsWith('/')) {
    return `local:///${normalized}`
  }
  return rawPath
}

/** 将 message parts 中的 attachment 条目映射为 ChatBubble 所需的 attachments 数组 */
export function mapAttachmentsFromParts(
  parts: readonly MessagePartLike[] | undefined
): MockChatAttachment[] | undefined {
  if (!parts?.length) return undefined

  const attachmentParts = parts.filter((p) => {
    const t = String(p.type ?? '').toLowerCase()
    return t === 'attachment' || t === 'image'
  })
  if (attachmentParts.length === 0) return undefined

  const attachments = attachmentParts.map((p) => {
    const att = normalizePartData(p.data)
    const fileName = String(att.name || att.fileName || 'Attachment')
    const isImage =
      String(p.type ?? '').toLowerCase() === 'image' || att.type === 'image' || att.isImage === true
    const isPdf =
      att.mimeType === 'application/pdf' || att.isPdf === true || /\.pdf$/i.test(fileName)
    const isText = att.isText === true || att.type === 'text' || /\.(txt|md)$/i.test(fileName)
    const rawPath = String(att.url || att.filePath || '')
    return {
      id: String(p.id ?? fileName),
      fileName,
      filePath: toLocalAttachmentPath(rawPath),
      isImage,
      isPdf,
      isText
    }
  })

  return attachments.length > 0 ? attachments : undefined
}

/** 落库/落盘前去掉内联 base64，仅保留路径与元数据 */
export function stripAttachmentBinaryForStorage(
  att: Record<string, unknown>
): Record<string, unknown> {
  const { data: _data, ...rest } = att
  return rest
}

/** 写入会话 JSON 前清理附件 part 中的 base64，并收集需回写 SQLite 的 part */
export function sanitizeSessionAggregateForDisk(aggregate: {
  session?: unknown
  messages?: Array<{
    parts?: Array<{ id?: string; type?: string; data?: unknown }>
  }>
}): {
  aggregate: typeof aggregate
  partUpdates: Array<{ id: string; data: unknown }>
} {
  const partUpdates: Array<{ id: string; data: unknown }> = []

  const messages = aggregate.messages?.map((message) => ({
    ...message,
    parts: message.parts?.map((part) => {
      const partType = String(part.type ?? '').toLowerCase()
      if (partType !== 'attachment' && partType !== 'image') {
        return part
      }

      const att = normalizePartData(part.data)
      if (typeof att.data !== 'string' || att.data.length === 0) {
        return part
      }

      const cleaned = stripAttachmentBinaryForStorage(att)
      if (part.id) {
        partUpdates.push({ id: part.id, data: cleaned })
      }
      return { ...part, data: cleaned }
    })
  }))

  return {
    aggregate: { ...aggregate, messages },
    partUpdates
  }
}

/** 将 save-user-message 返回的附件对象映射为 UI 附件（发送后即时补齐气泡展示） */
export function mapSavedAttachmentsForUi(
  attachments: readonly unknown[] | undefined
): MockChatAttachment[] | undefined {
  if (!attachments?.length) return undefined

  const mapped = attachments.map((raw, index) => {
    const att = normalizePartData(raw)
    const fileName = String(att.name || att.fileName || 'Attachment')
    const isImage = att.type === 'image' || att.isImage === true
    const isPdf =
      att.mimeType === 'application/pdf' || att.isPdf === true || /\.pdf$/i.test(fileName)
    const isText = att.isText === true || att.type === 'text' || /\.(txt|md)$/i.test(fileName)
    const rawPath = String(att.url || att.filePath || '')

    return {
      id: String(att.id ?? `saved-att-${index}`),
      fileName,
      filePath: toLocalAttachmentPath(rawPath),
      isImage,
      isPdf,
      isText
    }
  })

  return mapped.length > 0 ? mapped : undefined
}
