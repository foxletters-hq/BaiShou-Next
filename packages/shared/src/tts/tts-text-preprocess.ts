/** 中英文句读分隔：中文 ，。！？； 与英文 , . ! ? ; */
const TTS_SENTENCE_BOUNDARY_RE =
  /(?:(?<=[，。！？；])|(?<=[.!?;,])(?!\d))\s*/

const FENCED_CODE_BLOCK_RE = /```[^\n]*\n[\s\S]*?```|```[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~|~~~[\s\S]*?~~~/g

const DEFAULT_MAX_CHUNK_CHARS = 400

/** 剥离 Markdown 围栏代码块（``` / ~~~）。 */
export function stripFencedCodeBlocks(text: string): string {
  return text.replace(FENCED_CODE_BLOCK_RE, ' ')
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

/** 朗读前完整预处理：去代码块 + 分片。 */
export function prepareTtsSpeechChunks(
  content: string,
  maxChunkChars: number = DEFAULT_MAX_CHUNK_CHARS
): string[] {
  const withoutCode = stripFencedCodeBlocks(content)
  return splitTtsTextIntoChunks(withoutCode, maxChunkChars)
}
