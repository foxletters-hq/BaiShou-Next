import type { FileDiff } from '@baishou/shared'

export type GitDiffLineKind = 'context' | 'add' | 'remove' | 'empty'

export interface GitSplitDiffRow {
  leftNum?: number
  rightNum?: number
  leftText?: string
  rightText?: string
  kind: GitDiffLineKind
}

/** 将 unified diff hunks 转为 VS Code 风格的左右对照行 */
export function fileDiffToSplitRows(diff: FileDiff): GitSplitDiffRow[] {
  const rows: GitSplitDiffRow[] = []

  for (const hunk of diff.hunks) {
    let oldLine = hunk.oldStart
    let newLine = hunk.newStart
    const rawLines = hunk.content.split('\n')
    const lines = rawLines[rawLines.length - 1] === '' ? rawLines.slice(0, -1) : rawLines

    for (const line of lines) {
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

  return rows
}
