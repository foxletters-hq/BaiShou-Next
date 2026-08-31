import type { FileDiff } from '@baishou/shared'

export type GitDiffLineKind = 'context' | 'add' | 'remove' | 'empty' | 'replace'

export interface GitInlineChange {
  prefix: string
  changed: string
  suffix: string
}

export interface GitSplitDiffRow {
  leftNum?: number
  rightNum?: number
  leftText?: string
  rightText?: string
  leftInline?: GitInlineChange
  rightInline?: GitInlineChange
  kind: GitDiffLineKind
}

export type GitUnifiedDiffRow =
  | { kind: 'hunk'; text: string }
  | { kind: 'meta' }
  | {
      kind: 'context' | 'add' | 'remove'
      oldNum: number | null
      newNum: number | null
      text: string
      marker: string
      inline?: GitInlineChange
    }

function hunkLines(content: string): string[] {
  const rawLines = content.replace(/\r\n/g, '\n').split('\n')
  return rawLines[rawLines.length - 1] === '' ? rawLines.slice(0, -1) : rawLines
}

function isDiffHeaderLine(line: string): boolean {
  return (
    line.startsWith('diff ') ||
    line.startsWith('index ') ||
    line.startsWith('--- ') ||
    line.startsWith('+++ ') ||
    line.includes('(diff truncated)')
  )
}

export function isNoNewlineMarker(line: string): boolean {
  const trimmed = line.trim()
  return trimmed === '\\ No newline at end of file' || trimmed.startsWith('\\ No newline')
}

/** 取公共前后缀，标出行内真正改动的片段；两端几乎无共同点时不标，避免整行误高亮 */
export function splitInlineChange(
  oldText: string,
  newText: string
): { old: GitInlineChange; next: GitInlineChange } | null {
  if (!oldText || !newText || oldText === newText) return null

  let start = 0
  const minLen = Math.min(oldText.length, newText.length)
  while (start < minLen && oldText[start] === newText[start]) start += 1

  let oldEnd = oldText.length
  let newEnd = newText.length
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd -= 1
    newEnd -= 1
  }

  const common = start + (oldText.length - oldEnd)
  const shorter = Math.min(oldText.length, newText.length)
  if (common < 2 || common < Math.min(4, Math.floor(shorter * 0.35))) {
    return null
  }

  return {
    old: {
      prefix: oldText.slice(0, start),
      changed: oldText.slice(start, oldEnd),
      suffix: oldText.slice(oldEnd)
    },
    next: {
      prefix: newText.slice(0, start),
      changed: newText.slice(start, newEnd),
      suffix: newText.slice(newEnd)
    }
  }
}

function applyUnifiedInlineHighlights(rows: GitUnifiedDiffRow[]): GitUnifiedDiffRow[] {
  const result = rows.slice()
  let i = 0
  while (i < result.length) {
    const row = result[i]
    if (!row || row.kind !== 'remove') {
      i += 1
      continue
    }
    const removeStart = i
    while (i < result.length && result[i]?.kind === 'remove') i += 1
    const addStart = i
    while (i < result.length && result[i]?.kind === 'add') i += 1
    const pairCount = Math.min(addStart - removeStart, i - addStart)
    for (let k = 0; k < pairCount; k += 1) {
      const rem = result[removeStart + k]
      const add = result[addStart + k]
      if (!rem || !add || rem.kind !== 'remove' || add.kind !== 'add') continue
      const inline = splitInlineChange(rem.text, add.text)
      if (!inline) continue
      result[removeStart + k] = { ...rem, inline: inline.old }
      result[addStart + k] = { ...add, inline: inline.next }
    }
  }
  return result
}

export function fileDiffToUnifiedRows(diff: FileDiff): GitUnifiedDiffRow[] {
  const rows: GitUnifiedDiffRow[] = []

  for (const hunk of diff.hunks) {
    if (hunk.oldLines > 0 || hunk.newLines > 0 || hunk.oldStart > 0 || hunk.newStart > 0) {
      rows.push({
        kind: 'hunk',
        text: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
      })
    }

    let oldLine = hunk.oldStart
    let newLine = hunk.newStart

    for (const line of hunkLines(hunk.content)) {
      if (!line || isDiffHeaderLine(line)) continue
      if (isNoNewlineMarker(line)) {
        rows.push({ kind: 'meta' })
        continue
      }

      const prefix = line.charAt(0)
      const text = line.slice(1)

      if (prefix === ' ' || prefix === '') {
        rows.push({
          kind: 'context',
          oldNum: oldLine,
          newNum: newLine,
          text: prefix === ' ' ? text : line,
          marker: ' '
        })
        oldLine += 1
        newLine += 1
        continue
      }

      if (prefix === '-') {
        rows.push({
          kind: 'remove',
          oldNum: oldLine,
          newNum: null,
          text,
          marker: '-'
        })
        oldLine += 1
        continue
      }

      if (prefix === '+') {
        rows.push({
          kind: 'add',
          oldNum: null,
          newNum: newLine,
          text,
          marker: '+'
        })
        newLine += 1
      }
    }
  }

  return applyUnifiedInlineHighlights(rows)
}

function alignSplitRows(rows: GitSplitDiffRow[]): GitSplitDiffRow[] {
  const aligned: GitSplitDiffRow[] = []
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const next = rows[i + 1]
    if (row && next && row.kind === 'remove' && next.kind === 'add') {
      const inline = splitInlineChange(row.leftText ?? '', next.rightText ?? '')
      aligned.push({
        leftNum: row.leftNum,
        rightNum: next.rightNum,
        leftText: row.leftText,
        rightText: next.rightText,
        leftInline: inline?.old,
        rightInline: inline?.next,
        kind: 'replace'
      })
      i += 1
      continue
    }
    if (row) aligned.push(row)
  }
  return aligned
}

/** 将 unified diff hunks 转为左右对照行；相邻删除/新增会对齐到同一行 */
export function fileDiffToSplitRows(diff: FileDiff): GitSplitDiffRow[] {
  const rows: GitSplitDiffRow[] = []

  for (const hunk of diff.hunks) {
    let oldLine = hunk.oldStart
    let newLine = hunk.newStart

    for (const line of hunkLines(hunk.content)) {
      if (isDiffHeaderLine(line) || isNoNewlineMarker(line)) continue
      const prefix = line.charAt(0)
      const text = line.slice(1)

      if (prefix === ' ') {
        rows.push({
          leftNum: oldLine,
          rightNum: newLine,
          leftText: text,
          rightText: text,
          kind: 'context'
        })
        oldLine += 1
        newLine += 1
        continue
      }

      if (prefix === '-') {
        rows.push({
          leftNum: oldLine,
          leftText: text,
          kind: 'remove'
        })
        oldLine += 1
        continue
      }

      if (prefix === '+') {
        rows.push({
          rightNum: newLine,
          rightText: text,
          kind: 'add'
        })
        newLine += 1
      }
    }
  }

  return alignSplitRows(rows)
}
