import type { SessionRepository } from '@baishou/database'

type EmojiItem = { id: string; name: string; relativePath: string }
type ToolCallSnapshot = { callId?: string; name?: string; arguments?: unknown }

/** 计算新 assistant 消息应挂载的父级 orderIndex（重发/编辑时优先锚定用户消息） */
export async function resolveAssistantParentOrderIndex(
  sessionRepo: SessionRepository,
  sessionId: string,
  options: { skipUserMessageRecording?: boolean; userMessageId?: string }
): Promise<number> {
  if (options.skipUserMessageRecording && options.userMessageId) {
    const userMsg = await sessionRepo.getMessageById(options.userMessageId)
    if (userMsg && typeof userMsg.orderIndex === 'number') {
      return userMsg.orderIndex
    }
  }

  const history = await sessionRepo.getMessagesBySession(sessionId, 1)
  return history.length > 0 && history[0] ? history[0].orderIndex : 0
}

/** 模糊匹配 emoji：支持 ID（含/不含扩展名）、名称、子串匹配 */
export function findEmojiById(query: string, emojis: EmojiItem[]): EmojiItem | undefined {
  const normalizedQuery = query.trim().toLowerCase()

  const exactMatch = emojis.find(
    (e) => e.id === normalizedQuery || e.id.toLowerCase() === normalizedQuery
  )
  if (exactMatch) return exactMatch

  const idNoExtMatch = emojis.find(
    (e) => e.id.replace(/\.[^.]+$/, '').toLowerCase() === normalizedQuery
  )
  if (idNoExtMatch) return idNoExtMatch

  const normalizeName = (s: string) =>
    s
      .toLowerCase()
      .replace(/[_\s]+/g, ' ')
      .trim()
  const normalizedNameQuery = normalizeName(normalizedQuery)
  const nameMatch = emojis.find((e) => normalizeName(e.name) === normalizedNameQuery)
  if (nameMatch) return nameMatch

  const idContainsMatch = emojis.find((e) =>
    e.id
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .includes(normalizedQuery)
  )
  if (idContainsMatch) return idContainsMatch

  const nameContainsMatch = emojis.find((e) => normalizeName(e.name).includes(normalizedNameQuery))
  if (nameContainsMatch) return nameContainsMatch

  return undefined
}

/** 从 emoji_send 工具调用参数中解析 emoji_id */
export function parseEmojiIdFromArgs(args: unknown): string | null {
  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args)
      if (parsed?.emoji_id && typeof parsed.emoji_id === 'string') return parsed.emoji_id
    } catch {
      if (args.length > 0) return args
    }
  } else if (args && typeof args === 'object') {
    const obj = args as Record<string, unknown>
    if (obj.emoji_id && typeof obj.emoji_id === 'string') return obj.emoji_id
  }
  return null
}

function generatePartId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** 将 emoji_send 工具调用转为 assistant 消息内的 image parts（排在文本之前） */
export function buildEmojiImagePartsFromToolCalls(
  toolCalls: readonly ToolCallSnapshot[],
  assistantMsgId: string,
  sessionId: string,
  userConfig?: Record<string, unknown>
): Array<{
  id: string
  messageId: string
  sessionId: string
  type: 'image'
  data: Record<string, unknown>
}> {
  const emojiConfig = userConfig?.['emojiConfig'] as { emojis?: EmojiItem[] } | undefined
  const emojis = emojiConfig?.emojis
  if (!emojis?.length) return []

  const parts: Array<{
    id: string
    messageId: string
    sessionId: string
    type: 'image'
    data: Record<string, unknown>
  }> = []

  for (const tc of toolCalls) {
    if (tc?.name !== 'emoji_send') continue
    const emojiId = parseEmojiIdFromArgs(tc.arguments)
    if (!emojiId) continue
    const emoji = findEmojiById(emojiId, emojis)
    if (!emoji) continue

    const fileName = emoji.relativePath.split('/').pop() || 'emoji'
    parts.push({
      id: generatePartId(),
      messageId: assistantMsgId,
      sessionId,
      type: 'image',
      data: {
        type: 'image',
        filePath: emoji.relativePath,
        url: `local:///${emoji.relativePath.replace(/\\/g, '/')}`,
        isImage: true,
        fileName,
        name: emoji.name || fileName
      }
    })
  }

  return parts
}
