export interface MarkdownLinkPreviewRanges {
  labelFrom: number
  labelTo: number
  hideRanges: Array<{ from: number; to: number }>
}

function findBalancedLabelClose(raw: string): number | null {
  let depth = 0
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    if (ch === '\\') {
      i += 1
      continue
    }
    if (ch === '[') depth += 1
    else if (ch === ']') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return null
}

/**
 * 解析 `[文字](网址)` / `[文字][引用]`，供 live preview 隐藏括号与目标。
 * 图片 `![]()`、尖括号自动链接不处理。
 */
export function markdownInlineLinkPreviewRanges(
  raw: string,
  nodeFrom: number
): MarkdownLinkPreviewRanges | null {
  if (raw.startsWith('![')) return null
  if (!raw.startsWith('[')) return null

  const labelClose = findBalancedLabelClose(raw)
  if (labelClose == null) return null
  const after = raw[labelClose + 1]
  if (after !== '(' && after !== '[') return null

  const labelFrom = nodeFrom + 1
  const labelTo = nodeFrom + labelClose
  if (labelTo < labelFrom) return null

  return {
    labelFrom,
    labelTo,
    hideRanges: [
      { from: nodeFrom, to: nodeFrom + 1 },
      { from: nodeFrom + labelClose, to: nodeFrom + raw.length }
    ]
  }
}

/** 光标落在链接区间内（含起点、不含终点）或选区与链接相交时视为正在编辑该链接。 */
export function selectionTouchesLinkRange(
  ranges: readonly { from: number; to: number }[],
  from: number,
  to: number
): boolean {
  for (const range of ranges) {
    if (range.from === range.to) {
      if (range.from >= from && range.from < to) return true
      continue
    }
    if (range.from < to && range.to > from) return true
  }
  return false
}
