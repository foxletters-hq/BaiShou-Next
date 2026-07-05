const BRACKET_TIME_PREFIX = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]\s*/
const BRACKET_TIME_GLOBAL = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]\s*/g
const TAG_TIME_LINE = /<message-time>\d{4}-\d{2}-\d{2} \d{2}:\d{2}<\/(?:message-time|time)>\s*/gi
const TAG_TIME_GLOBAL = /<message-time>\d{4}-\d{2}-\d{2} \d{2}:\d{2}<\/message-time>\s*/g
const TAG_CONTENT_BLOCK = /<message-content>\s*([\s\S]*?)\s*<\/message-content>/gi
const ORPHAN_MESSAGE_CONTENT_TAG = /<\/?message-content>/gi
const ORPHAN_THINKING_TAG = /<\/?thinking>/gi
const ORPHAN_REDACTED_THINKING_TAG = /<\/?redacted_thinking>/gi
const ORPHAN_THINK_TAG = /<\/?think>/gi

function stripOrphanMetadataTags(text: string): string {
  return text
    .replace(TAG_TIME_LINE, '')
    .replace(TAG_TIME_GLOBAL, '')
    .replace(BRACKET_TIME_GLOBAL, '')
    .replace(ORPHAN_MESSAGE_CONTENT_TAG, '')
    .replace(ORPHAN_THINKING_TAG, '')
    .replace(ORPHAN_REDACTED_THINKING_TAG, '')
    .replace(ORPHAN_THINK_TAG, '')
}

function unwrapMessageContentBlocks(text: string): string {
  let rest = text
  let prev = ''
  while (rest !== prev) {
    prev = rest
    rest = rest.replace(TAG_CONTENT_BLOCK, (_, inner: string) => inner ?? '')
  }

  const openTag = '<message-content>'
  const openIdx = rest.lastIndexOf(openTag)
  if (openIdx >= 0) {
    const afterOpen = rest.indexOf('</message-content>', openIdx)
    if (afterOpen < 0) {
      rest = rest.slice(openIdx + openTag.length).trimStart()
    }
  }

  return rest
}

/**
 * 剥离 assistant 生成文本中误输出的元数据（落库 / 流式展示前调用）。
 * 与 formatter 对称：formatter 在「读入上下文」时加壳，sanitizer 在「写出回复」时脱壳。
 */
export function sanitizeAssistantGeneratedText(text: string): string {
  let rest = unwrapMessageContentBlocks(text ?? '')
  rest = stripOrphanMetadataTags(rest)

  let changed = true
  while (changed) {
    changed = false
    const trimmed = rest.trimStart()
    if (trimmed !== rest) {
      rest = trimmed
      changed = true
    }
    if (BRACKET_TIME_PREFIX.test(rest)) {
      rest = rest.replace(BRACKET_TIME_PREFIX, '')
      changed = true
      continue
    }
    if (TAG_TIME_LINE.test(rest)) {
      TAG_TIME_LINE.lastIndex = 0
      rest = rest.replace(TAG_TIME_LINE, '')
      changed = true
      continue
    }
    if (rest.startsWith('<message-content>')) {
      rest = rest.replace(/^<message-content>\s*/, '')
      changed = true
      continue
    }
    if (rest.startsWith('</message-content>')) {
      rest = rest.replace(/^<\/message-content>\s*/, '')
      changed = true
    }
  }

  return stripOrphanMetadataTags(rest).trim()
}

/** 聊天 UI 展示用：若正文误含 message 元数据标签则脱壳（不落库逻辑） */
export function unwrapMessageMetadataForDisplay(text: string): string {
  const raw = text ?? ''
  if (!raw.includes('<message-content>') && !raw.includes('<message-time>')) {
    return raw
  }
  return sanitizeAssistantGeneratedText(raw)
}

/** @deprecated 使用 sanitizeAssistantGeneratedText */
export const stripLeakedMessageTimeFromAssistantText = sanitizeAssistantGeneratedText
