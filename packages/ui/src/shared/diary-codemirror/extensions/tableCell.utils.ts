import type { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { TextLine } from '@codemirror/state'
import { isTableSeparatorLine } from './buildTable'

export interface TableCellBounds {
  from: number
  to: number
  line: TextLine
}

export function isTableContentLine(lineText: string): boolean {
  const trimmed = lineText.trim()
  return trimmed.startsWith('|') && !isTableSeparatorLine(trimmed)
}

/** 统计管道符表格一行的列数 */
export function countTableColumns(lineText: string): number {
  const trimmed = lineText.trim()
  if (!trimmed.includes('|')) return 1

  const segments = trimmed.split('|')
  if (trimmed.startsWith('|')) segments.shift()
  if (trimmed.endsWith('|')) segments.pop()

  return Math.max(1, segments.length)
}

/** 按管道符切分，定位光标所在单元格内容区间（含行内编辑态） */
export function findTableCellBoundsInLine(line: TextLine, pos: number): TableCellBounds | null {
  const text = line.text
  if (!isTableContentLine(text)) return null

  let scan = 0
  while (scan < text.length) {
    const pipeIndex = text.indexOf('|', scan)
    if (pipeIndex === -1) break

    const cellContentStart = pipeIndex + 1
    const nextPipe = text.indexOf('|', cellContentStart)
    if (nextPipe === -1) break

    const cellFrom = line.from + cellContentStart
    const cellTo = line.from + nextPipe
    if (pos >= cellFrom && pos <= cellTo) {
      return { from: cellFrom, to: cellTo, line }
    }

    scan = nextPipe
  }

  return null
}

export function getTableCellBoundsFromSyntax(
  state: EditorState,
  pos: number
): TableCellBounds | null {
  const line = state.doc.lineAt(pos)
  const node = syntaxTree(state).resolveInner(pos, -1)

  for (let current = node; current; current = current.parent) {
    if (current.type.name === 'TableCell') {
      return { from: current.from, to: current.to, line }
    }
  }

  return findTableCellBoundsInLine(line, pos)
}

export function isLastTableCellInRow(node: { nextSibling: { type: { name: string } } | null }): boolean {
  let sibling = node.nextSibling
  while (sibling) {
    if (sibling.type.name === 'TableCell') return false
    sibling = sibling.nextSibling
  }
  return true
}
