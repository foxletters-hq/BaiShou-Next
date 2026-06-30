export interface StreamingMarkdownSplitResult {
  /** 已完成、可稳定 Markdown 渲染的块（以双换行拼接） */
  stableMarkdown: string
  /** 当前正在流式输出的块 */
  activeBlock: string
  /** 稳定块数量，用于检测块边界变化 */
  stableBlockCount: number
  /** 是否降级为整段纯文本流式（复杂表格、极短内容等） */
  degradeToPlainText: boolean
}

const TABLE_DIVIDER_RE = /\|[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)*\|/
const CODE_FENCE_OPEN_RE = /^(`{3,}|~{3,})(.*)$/

function isBlankLine(line: string): boolean {
  return line.trim() === ''
}

function isHeadingLine(line: string): boolean {
  return /^#{1,6}\s/.test(line.trim())
}

function isBlockquoteLine(line: string): boolean {
  return /^>/.test(line.trim())
}

function isListLine(line: string): boolean {
  return /^(\s*)([-*+]|\d+\.)\s/.test(line)
}

function isHorizontalRuleLine(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())
}

function fenceMarkerFromLine(line: string): string | null {
  const trimmed = line.trim()
  const match = trimmed.match(CODE_FENCE_OPEN_RE)
  return match ? match[1] : null
}

function isClosingFenceLine(line: string, openMarker: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.startsWith(openMarker[0])) return false
  const closeMatch = trimmed.match(CODE_FENCE_OPEN_RE)
  if (!closeMatch) return false
  return closeMatch[1].length >= openMarker.length
}

/** 将 Markdown 文本拆成逻辑块（段落、标题、列表、引用、代码围栏等） */
export function splitMarkdownIntoBlocks(content: string): string[] {
  if (!content) return []

  const lines = content.split('\n')
  const blocks: string[] = []
  let current: string[] = []
  let inCodeFence = false
  let openFenceMarker = ''

  const flushCurrent = () => {
    if (current.length === 0) return
    blocks.push(current.join('\n'))
    current = []
  }

  const firstLineOf = (blockLines: string[]) => blockLines[0] ?? ''

  for (const line of lines) {
    const openMarker = fenceMarkerFromLine(line)

    if (inCodeFence) {
      current.push(line)
      if (openMarker && isClosingFenceLine(line, openFenceMarker)) {
        flushCurrent()
        inCodeFence = false
        openFenceMarker = ''
      }
      continue
    }

    if (openMarker) {
      flushCurrent()
      inCodeFence = true
      openFenceMarker = openMarker
      current.push(line)
      continue
    }

    if (isBlankLine(line)) {
      flushCurrent()
      continue
    }

    if (current.length === 0) {
      current.push(line)
      continue
    }

    const first = firstLineOf(current)

    if (isHorizontalRuleLine(line)) {
      flushCurrent()
      blocks.push(line)
      continue
    }

    if (isHeadingLine(line) && !isHeadingLine(first)) {
      flushCurrent()
      current.push(line)
      continue
    }

    if (isBlockquoteLine(line) && isBlockquoteLine(first)) {
      current.push(line)
      continue
    }

    if (isListLine(line) && isListLine(first)) {
      current.push(line)
      continue
    }

    if (
      (isHeadingLine(line) || isBlockquoteLine(line) || isListLine(line)) &&
      !isBlockquoteLine(first) &&
      !isListLine(first) &&
      !isHeadingLine(first)
    ) {
      flushCurrent()
      current.push(line)
      continue
    }

    current.push(line)
  }

  flushCurrent()
  return blocks
}

export function hasUnclosedCodeFence(content: string): boolean {
  const lines = content.split('\n')
  let inFence = false
  let openMarker = ''

  for (const line of lines) {
    const marker = fenceMarkerFromLine(line)
    if (!inFence) {
      if (marker) {
        inFence = true
        openMarker = marker
      }
      continue
    }

    if (marker && isClosingFenceLine(line, openMarker)) {
      inFence = false
      openMarker = ''
    }
  }

  return inFence
}

function findUnclosedCodeFenceStart(content: string): number {
  const lines = content.split('\n')
  let inFence = false
  let openMarker = ''
  let openLineIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const marker = fenceMarkerFromLine(line)
    if (!inFence) {
      if (marker) {
        inFence = true
        openMarker = marker
        openLineIndex = i
      }
      continue
    }

    if (marker && isClosingFenceLine(line, openMarker)) {
      inFence = false
      openMarker = ''
      openLineIndex = -1
    }
  }

  if (!inFence || openLineIndex < 0) return -1

  let offset = 0
  for (let i = 0; i < openLineIndex; i++) {
    offset += lines[i].length + 1
  }
  return offset
}

function shouldDegradeToPlainText(content: string): boolean {
  if (content.length < 16) return true
  if (TABLE_DIVIDER_RE.test(content)) return true
  return false
}

function joinStableBlocks(blocks: string[]): string {
  return blocks.filter(Boolean).join('\n\n')
}

/**
 * 将流式 Markdown 拆成「稳定块 + 当前块」。
 * 稳定块交给 MarkdownRenderer；当前块交给 printer。
 */
export function splitStreamingMarkdownBlocks(content: string): StreamingMarkdownSplitResult {
  const empty: StreamingMarkdownSplitResult = {
    stableMarkdown: '',
    activeBlock: '',
    stableBlockCount: 0,
    degradeToPlainText: false
  }

  if (!content) return empty

  try {
    if (shouldDegradeToPlainText(content)) {
      return {
        stableMarkdown: '',
        activeBlock: content,
        stableBlockCount: 0,
        degradeToPlainText: true
      }
    }

    const fenceStart = findUnclosedCodeFenceStart(content)
    if (fenceStart >= 0) {
      const stablePart = content.slice(0, fenceStart).replace(/\n+$/, '')
      const activePart = content.slice(fenceStart)
      const stableBlocks = splitMarkdownIntoBlocks(stablePart)

      return {
        stableMarkdown: joinStableBlocks(stableBlocks),
        activeBlock: activePart,
        stableBlockCount: stableBlocks.length,
        degradeToPlainText: false
      }
    }

    const blocks = splitMarkdownIntoBlocks(content)
    if (blocks.length === 0) {
      return {
        stableMarkdown: '',
        activeBlock: content,
        stableBlockCount: 0,
        degradeToPlainText: false
      }
    }

    if (blocks.length === 1) {
      return {
        stableMarkdown: '',
        activeBlock: blocks[0],
        stableBlockCount: 0,
        degradeToPlainText: false
      }
    }

    const stableBlocks = blocks.slice(0, -1)
    const activeBlock = blocks[blocks.length - 1] ?? ''

    return {
      stableMarkdown: joinStableBlocks(stableBlocks),
      activeBlock,
      stableBlockCount: stableBlocks.length,
      degradeToPlainText: false
    }
  } catch {
    return {
      stableMarkdown: '',
      activeBlock: content,
      stableBlockCount: 0,
      degradeToPlainText: true
    }
  }
}
