import type { Text } from '@codemirror/state'

export interface FencedCodeBlockRange {
  from: number
  to: number
  content: string
  focusAnchor: number
  contentFrom: number
  contentTo: number
  openFenceFrom: number
  openFenceTo: number
  closeFenceFrom: number | null
  closeFenceTo: number | null
}

const FENCE_OPEN_RE = /^\s*(`{3,}|~{3,})(.*)$/
const FENCE_CLOSE_RE = /^\s*(`{3,}|~{3,})\s*$/

/** 行级扫描围栏块（表后重定向等需与 Lezer 树互补） */
export function collectFencedCodeBlockRanges(doc: Text): FencedCodeBlockRange[] {
  const blocks: FencedCodeBlockRange[] = []
  let openLine: {
    from: number
    to: number
    fenceFrom: number
    fenceTo: number
    contentFrom: number
    inlineContent: string
  } | null = null
  const bodyLines: string[] = []

  const flushOpen = () => {
    if (!openLine) return
    const content = bodyLines.length > 0 ? bodyLines.join('\n') : openLine.inlineContent
    blocks.push({
      from: openLine.from,
      to: openLine.to,
      content,
      focusAnchor: openLine.contentFrom,
      contentFrom: openLine.contentFrom,
      contentTo: openLine.to,
      openFenceFrom: openLine.fenceFrom,
      openFenceTo: openLine.fenceTo,
      closeFenceFrom: null,
      closeFenceTo: null
    })
    openLine = null
    bodyLines.length = 0
  }

  for (let lineNum = 1; lineNum <= doc.lines; lineNum += 1) {
    const line = doc.line(lineNum)
    const text = line.text

    if (!openLine) {
      const open = text.match(FENCE_OPEN_RE)
      if (!open) continue
      const fenceLen = open[1].length
      const leading = text.match(/^\s*/)?.[0].length ?? 0
      const rest = open[2] ?? ''
      openLine = {
        from: line.from,
        to: line.to,
        fenceFrom: line.from + leading,
        fenceTo: line.from + leading + fenceLen,
        contentFrom: line.from + leading + fenceLen + (rest.length > 0 ? 0 : 1),
        inlineContent: rest
      }
      if (rest.length > 0) {
        bodyLines.push(rest)
      }
      continue
    }

    const close = text.match(FENCE_CLOSE_RE)
    if (close) {
      const leading = text.match(/^\s*/)?.[0].length ?? 0
      const fenceLen = close[1].length
      const content = bodyLines.length > 0 ? bodyLines.join('\n') : openLine.inlineContent
      const contentTo = bodyLines.length > 0 ? doc.line(lineNum - 1).to : openLine.fenceTo
      blocks.push({
        from: openLine.from,
        to: line.to,
        content,
        focusAnchor:
          bodyLines.length > 0 || openLine.inlineContent ? openLine.contentFrom : openLine.fenceTo,
        contentFrom: openLine.contentFrom,
        contentTo: Math.max(openLine.contentFrom, contentTo),
        openFenceFrom: openLine.fenceFrom,
        openFenceTo: openLine.fenceTo,
        closeFenceFrom: line.from + leading,
        closeFenceTo: line.from + leading + fenceLen
      })
      openLine = null
      bodyLines.length = 0
      continue
    }

    bodyLines.push(text)
    openLine.to = line.to
  }

  if (openLine) {
    flushOpen()
  }

  return blocks
}

export function findFencedCodeBlockContaining(doc: Text, pos: number): FencedCodeBlockRange | null {
  return (
    collectFencedCodeBlockRanges(doc).find((block) => pos >= block.from && pos <= block.to) ?? null
  )
}

/** 表格重定向应跳过：在围栏块内，紧挨闭围栏后，或落在表后围栏块/其正文中 */
export function shouldDeferTableCaretRedirect(
  doc: Text,
  pos: number,
  tableRange?: { rowTo: number; nodeTo: number }
): boolean {
  const blocks = collectFencedCodeBlockRanges(doc)
  for (const block of blocks) {
    if (pos >= block.from && pos <= block.to) return true
    if (pos > block.to && pos <= block.to + 3) return true
    const closeLine = doc.lineAt(block.to)
    if (closeLine.number < doc.lines) {
      const nextLine = doc.line(closeLine.number + 1)
      if (pos >= nextLine.from && pos <= nextLine.to) return true
    }
  }
  if (tableRange && pos > tableRange.rowTo && pos < tableRange.nodeTo) {
    for (const block of blocks) {
      if (block.from > tableRange.rowTo && pos >= block.from) return true
    }
  }
  return false
}
