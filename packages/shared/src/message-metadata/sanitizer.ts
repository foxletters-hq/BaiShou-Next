const BRACKET_TIME_PREFIX = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]\s*/
const BRACKET_TIME_GLOBAL = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]\s*/g
const TAG_TIME_PREFIX = /^<message-time>\d{4}-\d{2}-\d{2} \d{2}:\d{2}<\/message-time>\s*/
const TAG_TIME_GLOBAL = /<message-time>\d{4}-\d{2}-\d{2} \d{2}:\d{2}<\/message-time>\s*/g
const TAG_CONTENT_OPEN = /^<message-content>\s*/
const TAG_CONTENT_CLOSE = /^<\/message-content>\s*/
const TAG_CONTENT_BLOCK = /<message-content>\s*([\s\S]*?)\s*<\/message-content>/g
const ORPHAN_THINKING_TAG = /<\/?thinking>/gi
const ORPHAN_REDACTED_THINKING_TAG = /<\/?redacted_thinking>/gi

function stripOrphanMetadataTags(text: string): string {
  return text
    .replace(TAG_TIME_GLOBAL, '')
    .replace(BRACKET_TIME_GLOBAL, '')
    .replace(ORPHAN_THINKING_TAG, '')
    .replace(ORPHAN_REDACTED_THINKING_TAG, '')
}

/**
 * 剥离 assistant 生成文本中误输出的元数据（落库 / 流式展示前调用）。
 * 与 formatter 对称：formatter 在「读入上下文」时加壳，sanitizer 在「写出回复」时脱壳。
 */
export function sanitizeAssistantGeneratedText(text: string): string {
  let rest = stripOrphanMetadataTags(text ?? '')

  rest = rest.replace(TAG_CONTENT_BLOCK, (_, inner: string) => inner ?? '')

  let changed = true
  while (changed) {
    changed = false
    if (BRACKET_TIME_PREFIX.test(rest)) {
      rest = rest.replace(BRACKET_TIME_PREFIX, '')
      changed = true
      continue
    }
    if (TAG_TIME_PREFIX.test(rest)) {
      rest = rest.replace(TAG_TIME_PREFIX, '')
      changed = true
      continue
    }
    const wrapped = rest.match(/^<message-content>\s*([\s\S]*?)\s*<\/message-content>\s*$/)
    if (wrapped) {
      rest = wrapped[1] ?? rest
      changed = true
      continue
    }
    if (TAG_CONTENT_OPEN.test(rest)) {
      rest = rest.replace(TAG_CONTENT_OPEN, '')
      changed = true
    }
    if (TAG_CONTENT_CLOSE.test(rest)) {
      rest = rest.replace(TAG_CONTENT_CLOSE, '')
      changed = true
    }
  }

  return stripOrphanMetadataTags(rest).trim()
}

/** @deprecated 使用 sanitizeAssistantGeneratedText */
export const stripLeakedMessageTimeFromAssistantText = sanitizeAssistantGeneratedText
