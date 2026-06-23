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

function extractClosedThinkingBlocks(content: string, reasoning: string) {
  let cleanContent = content || ''
  let cleanReasoning = reasoning || ''

  for (const thinkRegex of CLOSED_THINK_PATTERNS) {
    thinkRegex.lastIndex = 0
    let match
    while ((match = thinkRegex.exec(content || '')) !== null) {
      if (match[1]) {
        cleanReasoning += (cleanReasoning ? '\n' : '') + match[1].trim()
      }
    }
    cleanContent = cleanContent.replace(thinkRegex, '')
  }

  return { cleanContent, cleanReasoning }
}

function extractUnclosedThinkingBlocks(content: string, reasoning: string) {
  let cleanContent = content
  let cleanReasoning = reasoning

  for (const openTag of UNCLOSED_THINK_OPEN_TAGS) {
    if (!cleanContent.includes(openTag)) continue
    const parts = cleanContent.split(openTag)
    cleanContent = parts[0] || ''
    const unclosed = parts.slice(1).join(openTag)
    if (unclosed) {
      cleanReasoning += (cleanReasoning ? '\n' : '') + unclosed.trim()
    }
  }

  return { cleanContent, cleanReasoning }
}

/** 从 AI 正文中剥离 think 标签并脱壳元数据，与 desktop/native ChatBubble 共用 */
export function parseRedactedThinking(content: string, reasoning = '') {
  const closed = extractClosedThinkingBlocks(content, reasoning)
  const unclosed = extractUnclosedThinkingBlocks(closed.cleanContent, closed.cleanReasoning)

  return {
    cleanContent: sanitizeAssistantGeneratedText(unclosed.cleanContent),
    cleanReasoning: unclosed.cleanReasoning.trim()
  }
}
