import { sanitizeAssistantGeneratedText } from '@baishou/shared'

const OPEN_REDacted = '<' + 'redacted_thinking>'
const CLOSE_REDacted = '<' + '/redacted_thinking>'
const OPEN_THINKING = '<' + 'thinking>'
const CLOSE_THINKING = '<' + '/thinking>'
const OPEN_THINK = '<' + 'think>'
const CLOSE_THINK = '<' + '/think>'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const CLOSED_THINK_PATTERNS = [
  new RegExp(`${escapeRegExp(OPEN_REDacted)}([\\s\\S]*?)${escapeRegExp(CLOSE_REDacted)}`, 'gi'),
  new RegExp(`${escapeRegExp(OPEN_THINKING)}([\\s\\S]*?)${escapeRegExp(CLOSE_THINKING)}`, 'gi'),
  new RegExp(`${escapeRegExp(OPEN_THINK)}([\\s\\S]*?)${escapeRegExp(CLOSE_THINK)}`, 'gi')
]

const UNCLOSED_THINK_OPEN_TAGS = [OPEN_REDacted, OPEN_THINKING, OPEN_THINK]
const CLOSE_THINK_TAGS = [CLOSE_REDacted, CLOSE_THINKING, CLOSE_THINK]

/** reasoning 流里误带的闭合标签及之后正文，挪回 content */
function partitionReasoningAtCloseTag(reasoning: string): {
  reasoning: string
  leakedContent: string
} {
  let reasoningPart = reasoning || ''
  let leakedContent = ''

  for (const closeTag of CLOSE_THINK_TAGS) {
    const idx = reasoningPart.indexOf(closeTag)
    if (idx === -1) continue
    leakedContent = reasoningPart.slice(idx + closeTag.length).trim()
    reasoningPart = reasoningPart.slice(0, idx).trim()
    break
  }

  for (const openTag of UNCLOSED_THINK_OPEN_TAGS) {
    if (reasoningPart.startsWith(openTag)) {
      reasoningPart = reasoningPart.slice(openTag.length).trim()
    }
  }

  return { reasoning: reasoningPart, leakedContent }
}

/** 正文流先到达的闭合标签（思考在 reasoning 通道时已开未关） */
function stripLeadingCloseTagsFromContent(content: string): string {
  let contentPart = content || ''
  let changed = true
  while (changed) {
    changed = false
    const trimmed = contentPart.trimStart()
    for (const closeTag of CLOSE_THINK_TAGS) {
      if (trimmed.startsWith(closeTag)) {
        contentPart = trimmed.slice(closeTag.length).trimStart()
        changed = true
        break
      }
    }
  }
  return contentPart
}

function mergeContentParts(...parts: Array<string | undefined>): string {
  return parts
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .join('\n')
}

export interface ParseRedactedThinkingOptions {
  /**
   * 是否把正文里的 think 标签拆到 reasoning。
   * 流式阶段为 true；已落库消息为 false，避免角色扮演正文被藏进折叠「思考过程」。
   */
  extractContentThinkTags?: boolean
}

function unwrapClosedThinkTagsInline(content: string): string {
  let cleanContent = content || ''
  for (const thinkRegex of CLOSED_THINK_PATTERNS) {
    thinkRegex.lastIndex = 0
    const matches: Array<{ full: string; inner: string; index: number }> = []
    let match: RegExpExecArray | null
    while ((match = thinkRegex.exec(cleanContent)) !== null) {
      matches.push({
        full: match[0],
        inner: (match[1] ?? '').trim(),
        index: match.index
      })
    }
    for (let i = matches.length - 1; i >= 0; i--) {
      const { full, inner, index } = matches[i]
      cleanContent =
        cleanContent.slice(0, index) + (inner || '') + cleanContent.slice(index + full.length)
    }
  }
  return cleanContent
}

function stripUnclosedThinkOpenTagsInline(content: string): string {
  let cleanContent = content
  for (const openTag of UNCLOSED_THINK_OPEN_TAGS) {
    cleanContent = cleanContent.split(openTag).join('')
  }
  for (const closeTag of CLOSE_THINK_TAGS) {
    cleanContent = cleanContent.split(closeTag).join('')
  }
  return cleanContent
}

function isThinkBlockAtContentStart(content: string, tagIndex: number): boolean {
  return tagIndex === 0 || content.slice(0, tagIndex).trim() === ''
}

function extractClosedThinkingBlocks(content: string, reasoning: string) {
  let cleanContent = content || ''
  let cleanReasoning = reasoning || ''

  for (const thinkRegex of CLOSED_THINK_PATTERNS) {
    thinkRegex.lastIndex = 0
    const matches: Array<{ full: string; inner: string; index: number }> = []
    let match: RegExpExecArray | null
    while ((match = thinkRegex.exec(cleanContent)) !== null) {
      matches.push({
        full: match[0],
        inner: (match[1] ?? '').trim(),
        index: match.index
      })
    }

    for (let i = matches.length - 1; i >= 0; i--) {
      const { full, inner, index } = matches[i]
      const atStart = isThinkBlockAtContentStart(cleanContent, index)
      if (atStart && inner) {
        cleanReasoning = cleanReasoning ? `${cleanReasoning}\n${inner}` : inner
        cleanContent = cleanContent.slice(0, index) + cleanContent.slice(index + full.length)
        continue
      }

      const replacement = inner || ''
      cleanContent =
        cleanContent.slice(0, index) + replacement + cleanContent.slice(index + full.length)
    }
  }

  return { cleanContent, cleanReasoning }
}

function extractUnclosedThinkingBlocks(content: string, reasoning: string) {
  let cleanContent = content
  let cleanReasoning = reasoning

  for (const openTag of UNCLOSED_THINK_OPEN_TAGS) {
    const tagIndex = cleanContent.indexOf(openTag)
    if (tagIndex === -1) continue

    const before = cleanContent.slice(0, tagIndex)
    const after = cleanContent.slice(tagIndex + openTag.length)
    const atStart = isThinkBlockAtContentStart(cleanContent, tagIndex)

    if (atStart) {
      cleanContent = before.trimEnd()
      const unclosed = after.trim()
      if (unclosed) {
        cleanReasoning = cleanReasoning ? `${cleanReasoning}\n${unclosed}` : unclosed
      }
      continue
    }

    // 正文中间的泄漏 open 标签：去掉标签，保留前后对话在同一段展示
    cleanContent = `${before}${after}`
  }

  return { cleanContent, cleanReasoning }
}

/** 从 AI 正文中剥离 think 标签并脱壳元数据，与 desktop/native ChatBubble 共用 */
export function parseRedactedThinking(
  content: string,
  reasoning = '',
  options: ParseRedactedThinkingOptions = {}
) {
  const extractContentThinkTags = options.extractContentThinkTags !== false
  const partitioned = partitionReasoningAtCloseTag(reasoning)
  const contentWithoutLeadingClose = stripLeadingCloseTagsFromContent(content)
  const mergedContent = mergeContentParts(partitioned.leakedContent, contentWithoutLeadingClose)

  if (!extractContentThinkTags) {
    const unwrapped = stripUnclosedThinkOpenTagsInline(
      unwrapClosedThinkTagsInline(mergedContent)
    )
    return {
      cleanContent: sanitizeAssistantGeneratedText(unwrapped),
      cleanReasoning: partitioned.reasoning.trim()
    }
  }

  const closed = extractClosedThinkingBlocks(mergedContent, partitioned.reasoning)
  const unclosed = extractUnclosedThinkingBlocks(closed.cleanContent, closed.cleanReasoning)

  return {
    cleanContent: sanitizeAssistantGeneratedText(unclosed.cleanContent),
    cleanReasoning: unclosed.cleanReasoning.trim()
  }
}
