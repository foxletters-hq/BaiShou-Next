import type { ModelMessage } from 'ai'

export const RUNTIME_CLOCK_PREFIX = '[System Current Date / Time]:'

export function formatRuntimeClockContent(now = new Date()): string {
  const tzOffset = -now.getTimezoneOffset() / 60
  const tzSign = tzOffset >= 0 ? '+' : ''
  const dateStr =
    `${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, '0')}-` +
    `${String(now.getDate()).padStart(2, '0')} ` +
    `${String(now.getHours()).padStart(2, '0')}:` +
    `${String(now.getMinutes()).padStart(2, '0')}:` +
    `${String(now.getSeconds()).padStart(2, '0')}`
  return (
    `${RUNTIME_CLOCK_PREFIX} ${dateStr} (UTC${tzSign}${tzOffset})\n` +
    'This is the host clock for this request. It is not user wording. Use it for "now".'
  )
}

function messageText(message: { content?: unknown }): string {
  const content = message.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'text' in part) {
        return typeof (part as { text?: unknown }).text === 'string'
          ? ((part as { text: string }).text ?? '')
          : ''
      }
      return ''
    })
    .join('')
}

export function isRuntimeClockMessage(message: { role?: string; content?: unknown }): boolean {
  return message.role === 'system' && messageText(message).includes(RUNTIME_CLOCK_PREFIX)
}

/**
 * 在最后一条 user 之前插入本轮钟点（不落库）。
 * 已存在的钟点消息会先去掉，避免重复插入。
 */
export function insertRuntimeClockSystemMessage<T extends { role: string; content?: unknown }>(
  messages: T[],
  now = new Date()
): T[] {
  const clock = {
    role: 'system',
    content: formatRuntimeClockContent(now)
  } as T
  const withoutOld = messages.filter((message) => !isRuntimeClockMessage(message))
  let insertAt = withoutOld.length
  for (let i = withoutOld.length - 1; i >= 0; i--) {
    if (withoutOld[i]?.role === 'user') {
      insertAt = i
      break
    }
  }
  return [...withoutOld.slice(0, insertAt), clock, ...withoutOld.slice(insertAt)]
}

export function insertRuntimeClockIfEnabled(
  messages: ModelMessage[],
  enabled: boolean,
  now = new Date()
): ModelMessage[] {
  if (!enabled) return messages
  return insertRuntimeClockSystemMessage(messages, now)
}
