const BRACKET_TIME_PREFIX = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]\s*/
const BRACKET_TIME_GLOBAL = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]\s*/g
/** 闭合或未闭合：模型常只吐出 <message-time>YYYY-MM-DD HH:mm 后直接接正文 */
const TAG_TIME = /<message-time>\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?:<\/(?:message-time|time)>)?\s*/gi
const TAG_CONTENT_BLOCK = /<message-content>\s*([\s\S]*?)\s*<\/message-content>/gi
const ORPHAN_MESSAGE_CONTENT_TAG = /<\/?message-content>/gi
const ORPHAN_MESSAGE_TIME_TAG = /<\/?message-time>/gi
const ORPHAN_TIME_CLOSE_TAG = /<\/time>/gi
const ORPHAN_THINKING_TAG = /<\/?thinking>/gi
const ORPHAN_REDACTED_THINKING_TAG = /<\/?redacted_thinking>/gi
const ORPHAN_THINK_TAG = /<\/?think>/gi
const TAG_CONVERSATION_TIME_BLOCK = /<conversation_time>\s*[\s\S]*?<\/conversation_time>\s*/gi
const ORPHAN_CONVERSATION_TIME_TAG = /<\/?conversation_time>/gi
const CLOSED_FUNCTION_CALLS_BLOCK = /<function_calls>[\s\S]*?<\/function_calls>/gi
const CLOSED_INVOKE_BLOCK = /<invoke\s+name=["'][^"']+["'][^>]*>[\s\S]*?<\/invoke>/gi
const UNCLOSED_TOOL_MARKUP = /<function_calls>|<invoke\s+name=/i

function stripOrphanMetadataTags(text: string): string {
  return text
    .replace(TAG_TIME, '')
    .replace(TAG_CONVERSATION_TIME_BLOCK, '')
    .replace(BRACKET_TIME_GLOBAL, '')
    .replace(ORPHAN_MESSAGE_CONTENT_TAG, '')
    .replace(ORPHAN_MESSAGE_TIME_TAG, '')
    .replace(ORPHAN_CONVERSATION_TIME_TAG, '')
    .replace(ORPHAN_TIME_CLOSE_TAG, '')
    .replace(ORPHAN_THINKING_TAG, '')
    .replace(ORPHAN_REDACTED_THINKING_TAG, '')
    .replace(ORPHAN_THINK_TAG, '')
}

/** 模型把工具调用写成 XML 正文时，展示和落盘都要拿掉，避免半截标签卡在气泡里。 */
function stripLeakedToolCallMarkup(text: string): string {
  let rest = text.replace(CLOSED_FUNCTION_CALLS_BLOCK, '').replace(CLOSED_INVOKE_BLOCK, '')
  const unclosed = rest.search(UNCLOSED_TOOL_MARKUP)
  if (unclosed >= 0) rest = rest.slice(0, unclosed)
  return rest.replace(/\n{3,}/g, '\n\n')
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
  rest = stripLeakedToolCallMarkup(rest)
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
    if (TAG_TIME.test(rest)) {
      TAG_TIME.lastIndex = 0
      rest = rest.replace(TAG_TIME, '')
      changed = true
      continue
    }
    if (rest.startsWith('<message-time>')) {
      rest = rest.replace(/^<message-time>\s*/, '')
      changed = true
      continue
    }
    if (rest.startsWith('</message-time>') || rest.startsWith('</time>')) {
      rest = rest.replace(/^<\/(?:message-time|time)>\s*/, '')
      changed = true
      continue
    }
    if (rest.startsWith('<conversation_time>')) {
      rest = rest.replace(/^<conversation_time>\s*/, '')
      changed = true
      continue
    }
    if (rest.startsWith('</conversation_time>')) {
      rest = rest.replace(/^<\/conversation_time>\s*/, '')
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
  if (
    !raw.includes('<message-content>') &&
    !raw.includes('<message-time>') &&
    !raw.includes('<conversation_time>')
  ) {
    return raw
  }
  return sanitizeAssistantGeneratedText(raw)
}

/** @deprecated 使用 sanitizeAssistantGeneratedText */
export const stripLeakedMessageTimeFromAssistantText = sanitizeAssistantGeneratedText
