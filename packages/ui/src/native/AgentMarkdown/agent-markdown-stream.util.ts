/** 每次从囤积缓冲释放一小段短语的间隔（毫秒，约 10 次/秒，将主线程与排版开销降至原来的 1/6） */
export const STREAMING_REVEAL_TICK_MS = 100

/** 首包先囤积的最小字符数（不足时最多等待 STREAMING_INITIAL_STOCKPILE_MS，避免首字蹦出后断流卡顿） */
export const STREAMING_INITIAL_STOCKPILE_CHARS = 12

/** 首包囤积最长等待时间（毫秒） */
export const STREAMING_INITIAL_STOCKPILE_MS = 140

/** Gemini / XMarkdown 风格尾部渐显窗口字符数 */
export const STREAMING_GRADIENT_TAIL_CHARS = 28

/** 每个渐变分片包含的字符数 */
export const STREAMING_GRADIENT_SLICE_CHARS = 2

/** 单个短语分片从 6% 透明度平滑渐显到 100% 的持续时长（毫秒） */
export const STREAMING_CHUNK_FADE_DURATION_MS = 320

/**
 * 根据待显示缓冲长度计算单次（每 100ms）释放的短语字符数。
 * 先囤积文字、再按从容的阅读速率分批释放，宁可稍慢一点也保证渐显与滚动绝对丝滑。
 */
export function computeStreamingRevealStep(backlog: number, isStreaming: boolean): number {
  if (backlog <= 0) return 0
  if (!isStreaming) {
    return Math.min(22, Math.max(6, Math.ceil(backlog / 10)))
  }
  if (backlog <= 14) return 5
  if (backlog <= 36) return 7
  if (backlog <= 80) return 10
  if (backlog <= 160) return 14
  if (backlog <= 280) return 18
  return Math.min(28, Math.ceil(backlog / 14))
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

function isInlineMarkdownMarker(ch: string): boolean {
  return ch === '*' || ch === '_' || ch === '~' || ch === '`' || ch === '#'
}

function isClauseBoundaryChar(ch: string): boolean {
  return (
    ch === '，' ||
    ch === '。' ||
    ch === '！' ||
    ch === '？' ||
    ch === '；' ||
    ch === '：' ||
    ch === '、' ||
    ch === ',' ||
    ch === '.' ||
    ch === '!' ||
    ch === '?' ||
    ch === ';' ||
    ch === ':' ||
    ch === '\n'
  )
}

/**
 * 若切片位置落在完整的 Markdown 链接 `[text](url)` 或图片 `![alt](url)` 的语法区间内，
 * 直接跨过 `)` 结尾，避免流式期间把半截 URL 裸露渲染成正文。
 */
function snapPastCompleteMarkdownLinkOrImage(text: string, index: number): number {
  const searchStart = Math.max(0, index - 240)
  const searchEnd = Math.min(text.length, index + 240)
  const windowText = text.slice(searchStart, searchEnd)
  const linkOrImageRe = /!?\[[^\n\]]*\]\([^\n)]+\)/g
  let match: RegExpExecArray | null
  while ((match = linkOrImageRe.exec(windowText)) !== null) {
    const start = searchStart + match.index
    const end = start + match[0].length
    if (index > start && index < end) {
      const isImage = match[0].startsWith('![')
      const bracketClose = text.indexOf('](', start)
      if (isImage || (bracketClose >= start && index >= bracketClose)) {
        return end
      }
    }
  }
  return index
}

/**
 * 修正流式揭示游标边界：
 * 1) 优先在附近（±4 字）的自然标点/分句边界断开，让每次渐显都是自然词句
 * 2) 不拆开 UTF-16 代理对（Emoji）
 * 3) 不停在完整的 Markdown 链接 URL / 图片语法中间
 * 4) 不停在连续的 Markdown 标记符（`**`、`~~`、`` ` ``、`###`）中间
 */
export function snapStreamingRevealIndex(
  text: string,
  targetIndex: number,
  minAdvanceFrom?: number
): number {
  if (!text) return 0
  let idx = Math.max(0, Math.min(text.length, targetIndex))
  if (idx >= text.length) return text.length

  if (minAdvanceFrom !== undefined && idx - minAdvanceFrom >= 5) {
    const searchFrom = Math.max(minAdvanceFrom + 3, idx - 3)
    const searchTo = Math.min(text.length - 1, idx + 4)
    for (let p = searchFrom; p <= searchTo; p++) {
      if (isClauseBoundaryChar(text.charAt(p))) {
        idx = p + 1
        break
      }
    }
    if (idx >= text.length) return text.length
  }

  if (
    idx > 0 &&
    isHighSurrogate(text.charCodeAt(idx - 1)) &&
    isLowSurrogate(text.charCodeAt(idx))
  ) {
    idx += 1
  }

  idx = snapPastCompleteMarkdownLinkOrImage(text, idx)
  if (idx >= text.length) return text.length

  if (isInlineMarkdownMarker(text.charAt(idx - 1)) || isInlineMarkdownMarker(text.charAt(idx))) {
    const limit = Math.min(text.length, idx + 6)
    while (idx < limit && isInlineMarkdownMarker(text.charAt(idx))) {
      idx += 1
    }
    if (idx < text.length && isHighSurrogate(text.charCodeAt(idx))) {
      idx = Math.min(text.length, idx + 2)
    }
  }

  return idx
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let pos = 0
  while (true) {
    const next = haystack.indexOf(needle, pos)
    if (next < 0) break
    count += 1
    pos = next + needle.length
  }
  return count
}

/**
 * 为尚未输出完的 Markdown 前缀自动补齐未闭合的代码围栏或行内强调标记，
 * 避免流式推进过程中先裸露 `**` / ```` ``` ```` 再跳变成富文本。
 */
export function completeStreamingMarkdownSlice(slice: string, isPartial: boolean): string {
  if (!slice || !isPartial) return slice

  const lines = slice.split('\n')
  let inFence = false
  let fenceChar = '`'
  let fenceLen = 3

  for (const line of lines) {
    const trimmed = line.trim()
    const match = trimmed.match(/^(`{3,}|~{3,})/)
    if (!match) continue
    const marker = match[1]!
    if (!inFence) {
      inFence = true
      fenceChar = marker[0]!
      fenceLen = marker.length
    } else if (marker[0] === fenceChar && marker.length >= fenceLen) {
      inFence = false
    }
  }

  if (inFence) {
    const closingFence = fenceChar.repeat(fenceLen)
    return slice.endsWith('\n') ? `${slice}${closingFence}` : `${slice}\n${closingFence}`
  }

  const lastBlankIdx = slice.lastIndexOf('\n\n')
  const tailParagraph = lastBlankIdx >= 0 ? slice.slice(lastBlankIdx + 2) : slice
  let suffix = ''

  const lastLine = lines[lines.length - 1] ?? ''
  const singleBackticks = countOccurrences(lastLine.replace(/`{2,}/g, ''), '`')
  if (singleBackticks % 2 === 1 && !lastLine.endsWith('`')) {
    suffix += '`'
  }

  const boldCount = countOccurrences(tailParagraph, '**')
  if (boldCount % 2 === 1 && !tailParagraph.endsWith('**')) {
    const lastBoldPos = tailParagraph.lastIndexOf('**')
    if (tailParagraph.slice(lastBoldPos + 2).trim().length > 0) {
      suffix += '**'
    }
  }

  const strikeCount = countOccurrences(tailParagraph, '~~')
  if (strikeCount % 2 === 1 && !tailParagraph.endsWith('~~')) {
    const lastStrikePos = tailParagraph.lastIndexOf('~~')
    if (tailParagraph.slice(lastStrikePos + 2).trim().length > 0) {
      suffix += '~~'
    }
  }

  return suffix ? `${slice}${suffix}` : slice
}

/**
 * 计算尾部渐变字符的透明度（0 = 紧邻已完全显现区，接近 1.0；越大越靠近最末端新字，接近 0.08）。
 */
export function computeStreamingTailAlpha(
  offsetFromSolid: number,
  maxTailChars: number = STREAMING_GRADIENT_TAIL_CHARS
): number {
  const windowSize = Math.max(1, maxTailChars)
  const clampedOffset = Math.max(0, Math.min(windowSize - 1, offsetFromSolid))
  const progress = Math.max(0, Math.min(1, 1 - (clampedOffset + 1) / (windowSize + 1)))
  const eased = 1 - Math.pow(1 - progress, 1.8)
  return Number((0.08 + 0.92 * eased).toFixed(3))
}

/**
 * 将任意主题颜色（#RGB / #RRGGBB / #RRGGBBAA / rgb / rgba）叠加 alpha 透明度，
 * 用于 React Native 嵌套 Text 的 ForegroundColorSpan 渐变渲染。
 */
export function applyAlphaToColor(color: string, alpha: number): string {
  const clampedAlpha = Math.max(0, Math.min(1, alpha))
  if (clampedAlpha >= 0.995 || !color) return color

  const trimmed = color.trim()
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1)
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0]!, 16)
      const g = parseInt(hex[1]! + hex[1]!, 16)
      const b = parseInt(hex[2]! + hex[2]!, 16)
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return `rgba(${r}, ${g}, ${b}, ${clampedAlpha.toFixed(3)})`
      }
    } else if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const baseA = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return `rgba(${r}, ${g}, ${b}, ${(baseA * clampedAlpha).toFixed(3)})`
      }
    }
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i
  )
  if (rgbMatch) {
    const r = Number(rgbMatch[1])
    const g = Number(rgbMatch[2])
    const b = Number(rgbMatch[3])
    const baseA = rgbMatch[4] !== undefined ? Number(rgbMatch[4]) : 1
    return `rgba(${r}, ${g}, ${b}, ${(baseA * clampedAlpha).toFixed(3)})`
  }

  return color
}
