/** 将 DB 消息（含 parts）映射为 Agent UI 消息 */
export function mapSessionMessageFromDb(msg: {
  id: string
  role: string
  createdAt?: string | Date
  parts?: Array<{ type: string; data?: Record<string, unknown> | string }>
}) {
  const parts = msg.parts || []
  const textParts = parts.filter((p) => p.type === 'text')
  const content = textParts
    .filter(
      (p) =>
        !(typeof p.data === 'object' && p.data && (p.data as { isReasoning?: boolean }).isReasoning)
    )
    .map((p) => {
      if (typeof p.data === 'object' && p.data && 'text' in p.data)
        return String((p.data as { text?: string }).text ?? '')
      return typeof p.data === 'string' ? p.data : ''
    })
    .join('\n')

  const attachmentParts = parts.filter((p) => p.type === 'attachment')
  const attachments =
    attachmentParts.length > 0
      ? attachmentParts.map((p) => {
          const att = (typeof p.data === 'object' ? p.data : {}) as Record<string, unknown>
          return {
            id: (p as { id?: string }).id,
            fileName: att.name || att.fileName || 'Attachment',
            filePath: att.url || att.filePath || '',
            isImage: att.type === 'image' || att.isImage === true,
            isPdf: att.mimeType === 'application/pdf',
            isText: att.isText === true
          }
        })
      : undefined

  return {
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system',
    content,
    timestamp: new Date(msg.createdAt ?? Date.now()),
    attachments,
    parts: parts.length > 0 ? parts : undefined
  }
}
