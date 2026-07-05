/** 中英文句读分隔：中文 ，。！？； 与英文 , . ! ? ; */
const TTS_SENTENCE_BOUNDARY_RE = /(?:(?<=[，。！？；])|(?<=[.!?;,])(?!\d))\s*/

const FENCED_CODE_BLOCK_RE =
  /```[^\n]*\n[\s\S]*?```|```[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~|~~~[\s\S]*?~~~/g

const DEFAULT_MAX_CHUNK_CHARS = 400

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\([^)]+\)/g
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\([^)]+\)/g
const MARKDOWN_AUTOLINK_RE = /<https?:\/\/[^>]+>/gi
const MARKDOWN_INLINE_CODE_RE = /`([^`]+)`/g
const MARKDOWN_BOLD_RE = /\*\*([^*]+)\*\*/g
const MARKDOWN_ITALIC_STAR_RE = /\*([^*]+)\*/g
const MARKDOWN_BOLD_UNDER_RE = /__([^_]+)__/g
const MARKDOWN_ITALIC_UNDER_RE = /_([^_]+)_/g
const MARKDOWN_STRIKE_RE = /~~([^~]+)~~/g
const MARKDOWN_HASHTAG_RE = /#([^\s#]+)/g
const MARKDOWN_HR_RE = /^[-*_]{3,}\s*$/gm

/** 剥离 Markdown 围栏代码块（``` / ~~~）。 */
export function stripFencedCodeBlocks(text: string): string {
  return text.replace(FENCED_CODE_BLOCK_RE, ' ')
}

/**
 * 将 Markdown / 日记正文转为适合 TTS 的纯文本（去格式、保留可读语义）。
 */
export function stripMarkdownForTts(text: string): string {
  if (!text.trim()) return ''

  let out = stripFencedCodeBlocks(text)

  out = out.replace(MARKDOWN_IMAGE_RE, (_, alt: string) => {
    const trimmed = String(alt ?? '').trim()
    return trimmed ? `${trimmed} ` : ' '
  })
  out = out.replace(MARKDOWN_LINK_RE, '$1')
  out = out.replace(MARKDOWN_AUTOLINK_RE, ' ')

  const lines = out.split('\n')
  const processed = lines.map((line) => {
    let current = line
    current = current.replace(/^#{1,6}\s*(\d{2}:\d{2}(?::\d{2})?)\s*$/, '$1')
    current = current.replace(/^#{1,6}\s+/, '')
    current = current.replace(/^>\s?/, '')
    current = current.replace(/^(\s*)[-*+]\s+/, '$1')
    current = current.replace(/^(\s*)\d+\.\s+/, '$1')
    return current
  })
  out = processed.join('\n')

  out = out.replace(MARKDOWN_INLINE_CODE_RE, '$1')
  out = out.replace(MARKDOWN_BOLD_RE, '$1')
  out = out.replace(MARKDOWN_STRIKE_RE, '$1')
  out = out.replace(MARKDOWN_BOLD_UNDER_RE, '$1')
  out = out.replace(MARKDOWN_ITALIC_STAR_RE, '$1')
  out = out.replace(MARKDOWN_ITALIC_UNDER_RE, '$1')
  out = out.replace(MARKDOWN_HASHTAG_RE, '$1')
  out = out.replace(MARKDOWN_HR_RE, ' ')
  out = out.replace(/\s+([，。！？；、,.!?])/g, '$1')

  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

export function normalizeTtsWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function splitLongSegment(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]

  const parts: string[] = []
  let remaining = text

  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars)
    let cut =
      Math.max(window.lastIndexOf(' '), window.lastIndexOf('，'), window.lastIndexOf(',')) ||
      maxChars

    if (cut < maxChars * 0.4) {
      cut = maxChars
    }

    const piece = remaining.slice(0, cut).trim()
    if (piece) parts.push(piece)
    remaining = remaining.slice(cut).trim()
  }

  if (remaining) parts.push(remaining)
  return parts
}

/**
 * 按中英文标点分句，并对超长片段二次切分。
 */
export function splitTtsTextIntoChunks(
  text: string,
  maxChunkChars: number = DEFAULT_MAX_CHUNK_CHARS
): string[] {
  const normalized = normalizeTtsWhitespace(text)
  if (!normalized) return []

  const rawParts = normalized
    .split(TTS_SENTENCE_BOUNDARY_RE)
    .map((part) => part.trim())
    .filter(Boolean)

  const chunks: string[] = []
  for (const part of rawParts) {
    if (part.length <= maxChunkChars) {
      chunks.push(part)
      continue
    }
    chunks.push(...splitLongSegment(part, maxChunkChars))
  }

  return chunks
}

/** 朗读前完整预处理：Markdown 纯化 + 分片。 */
export function prepareTtsSpeechChunks(
  content: string,
  maxChunkChars: number = DEFAULT_MAX_CHUNK_CHARS
): string[] {
  const readable = stripMarkdownForTts(content)
  return splitTtsTextIntoChunks(readable, maxChunkChars)
}
