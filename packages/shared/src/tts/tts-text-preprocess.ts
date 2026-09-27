/** 中英文句读分隔：中文 ，。！？； 与英文 , . ! ? ; */
const TTS_SENTENCE_BOUNDARY_RE = /(?:(?<=[，。！？；])|(?<=[.!?;,])(?!\d))\s*/

const FENCED_CODE_BLOCK_RE =
  /```[^\n]*\n[\s\S]*?```|```[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~|~~~[\s\S]*?~~~/g

const MATH_BLOCK_RE = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/g
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g
const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/g

const DEFAULT_MAX_CHUNK_CHARS = 400

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\([^)]+\)/g
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\([^)]+\)/g
const MARKDOWN_AUTOLINK_RE = /<https?:\/\/[^>]+>/gi
const BARE_URL_RE = /\bhttps?:\/\/[^\s<>\u4e00-\u9fa5，。！？；、（）()]+/gi

const MARKDOWN_INLINE_CODE_RE = /`([^`]+)`/g
const MARKDOWN_BOLD_RE = /\*\*([^*]+)\*\*/g
const MARKDOWN_ITALIC_STAR_RE = /\*([^*]+)\*/g
const MARKDOWN_BOLD_UNDER_RE = /__([^_]+)__/g
const MARKDOWN_ITALIC_UNDER_RE = /_([^_]+)_/g
const MARKDOWN_STRIKE_RE = /~~([^~]+)~~/g
const MARKDOWN_HASHTAG_RE = /#([^\s#]+)/g
const MARKDOWN_HR_RE = /^[-*_]{3,}\s*$/gm

const INLINE_MATH_RE = /\$(?!\s)([^\$\n]+?)(?<!\s)\$/g

/** 剥离 Markdown 围栏代码块（``` / ~~~）。 */
export function stripFencedCodeBlocks(text: string): string {
  return text.replace(FENCED_CODE_BLOCK_RE, ' ')
}

/**
 * 判断一行是否为 Markdown 表格的分隔行（如 | --- | :---: | ---: | 或 --- | ---）
 */
function isTableDelimiterRow(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || !trimmed.includes('-')) return false
  if (!trimmed.includes('|')) return false
  const stripped = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  const cells = stripped.split('|')
  if (cells.length === 0) return false
  return cells.every((cell) => /^\s*:?-+:?\s*$/.test(cell))
}

/**
 * 转换包含竖线的表格行或行内管道符为自然连贯的文本。
 */
function cleanTableRow(line: string): string {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return line
  const stripped = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  const cells = stripped
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean)
  if (cells.length === 0) return ''

  let result = ''
  for (const cell of cells) {
    if (!result) {
      result = cell
    } else {
      const endsWithPunct = /[，。！？；、,.!?]$/.test(result)
      result += (endsWithPunct ? ' ' : '，') + cell
    }
  }
  return result
}

/**
 * 将 Markdown / 日记正文转为适合 TTS 的纯文本（去格式、保留可读语义）。
 */
export function stripMarkdownForTts(text: string): string {
  if (!text.trim()) return ''

  // 1. 剥离代码块、块级数学公式与 HTML 注释
  let out = stripFencedCodeBlocks(text)
  out = out.replace(MATH_BLOCK_RE, ' ')
  out = out.replace(HTML_COMMENT_RE, ' ')

  // 2. 处理图片、链接、裸链接与 HTML 标签
  out = out.replace(MARKDOWN_IMAGE_RE, (_, alt: string) => {
    const trimmed = String(alt ?? '').trim()
    return trimmed ? `${trimmed} ` : ' '
  })
  out = out.replace(MARKDOWN_LINK_RE, '$1')
  out = out.replace(MARKDOWN_AUTOLINK_RE, ' ')
  out = out.replace(BARE_URL_RE, (match) => {
    const trailingPunctMatch = match.match(/[.,!?;:]+$/)
    return trailingPunctMatch ? trailingPunctMatch[0] : ' '
  })
  out = out.replace(HTML_TAG_RE, ' ')

  // 3. 常见 HTML 实体转义解码
  out = out
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")

  // 4. 行级语法处理（标题、引用、列表、表格行与分隔线）
  const lines = out.split('\n')
  const processed: string[] = []
  for (const line of lines) {
    if (isTableDelimiterRow(line)) {
      continue
    }

    let current = line
    current = current.replace(/^#{1,6}\s*(\d{2}:\d{2}(?::\d{2})?)\s*$/, '$1')
    current = current.replace(/^#{1,6}\s+/, '')
    current = current.replace(/^>\s?/, '')
    current = current.replace(/^(\s*)[-*+]\s+/, '$1')
    current = current.replace(/^(\s*)\d+\.\s+/, '$1')

    if (current.includes('|')) {
      current = cleanTableRow(current)
    }

    processed.push(current)
  }
  out = processed.join('\n')

  // 5. 行内数学公式简易修饰
  out = out.replace(INLINE_MATH_RE, (_, expr: string) => {
    const cleanExpr = expr
      .replace(/\\times\b/g, '×')
      .replace(/\\div\b/g, '÷')
      .replace(/\\le\b|\\leq\b/g, '≤')
      .replace(/\\ge\b|\\geq\b/g, '≥')
      .replace(/\\neq\b/g, '≠')
      .replace(/\\approx\b/g, '≈')
      .replace(/\\pm\b/g, '±')
      .replace(/\\[a-zA-Z]+/g, ' ')
    return cleanExpr.trim()
  })

  // 6. 行内标记与修饰符剥离
  out = out.replace(MARKDOWN_INLINE_CODE_RE, '$1')
  out = out.replace(MARKDOWN_BOLD_RE, '$1')
  out = out.replace(MARKDOWN_STRIKE_RE, '$1')
  out = out.replace(MARKDOWN_BOLD_UNDER_RE, '$1')
  out = out.replace(MARKDOWN_ITALIC_STAR_RE, '$1')
  out = out.replace(MARKDOWN_ITALIC_UNDER_RE, '$1')
  out = out.replace(MARKDOWN_HASHTAG_RE, '$1')
  out = out.replace(MARKDOWN_HR_RE, ' ')
  out = out.replace(/\|/g, ' ')

  // 7. 标点与空白符号规整
  out = out.replace(/\s+([，。！？；、,.!?])/g, '$1')
  out = out.replace(/[，,]{2,}/g, '，')
  out = out.replace(/[：:]\s*[，,、]/g, '：')
  out = out.replace(/^[，,、]\s*/gm, '')

  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
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
