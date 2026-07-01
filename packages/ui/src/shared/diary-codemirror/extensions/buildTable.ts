import type { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNodeRef } from '@lezer/common'
import { isCursorInRange, isCursorOnLine } from './cursor'
import { hideMark } from './styles'
import { isLastTableCellInRow, countTableColumns } from './tableCell.utils'
import type { TableBlockRange } from './buildTableChrome'

type DecorationMark = { from: number; to: number; value: Decoration }

function pushDecoration(
  marks: DecorationMark[],
  value: Decoration,
  from: number,
  to: number
): void {
  if (from < to) marks.push(value.range(from, to))
}

/** GFM 表格对齐行，例如 | --- | :---: | */
export function isTableSeparatorLine(lineText: string): boolean {
  const trimmed = lineText.trim()
  if (!trimmed.includes('-')) return false
  return (
    /^\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(trimmed) ||
    /^\|(?:\s*:?-{3,}:?\s*)+\|$/.test(trimmed)
  )
}

function isInsideTable(node: SyntaxNodeRef): boolean {
  return findTableRoot(node) != null
}

function findTableRoot(node: SyntaxNodeRef): { from: number; to: number } | null {
  let current = node.node
  while (current) {
    if (current.type.name === 'Table') {
      return { from: current.from, to: current.to }
    }
    current = current.parent
  }
  return null
}

function tableLineDecoration(classNames: string, columnCount?: number): Decoration {
  if (columnCount && columnCount > 0) {
    return Decoration.line({
      class: classNames,
      attributes: { style: `--cm-table-cols: ${columnCount}` }
    })
  }
  return Decoration.line({ class: classNames })
}

function pushTableLineStyle(
  marks: DecorationMark[],
  lineFrom: number,
  classNames: string,
  lineClassKeys: Set<string>,
  columnCount?: number
): void {
  const key = `${lineFrom}:${classNames}:${columnCount ?? 0}`
  if (lineClassKeys.has(key)) return
  lineClassKeys.add(key)
  marks.push(tableLineDecoration(classNames, columnCount).range(lineFrom))
}

function cellMarkDecoration(isHeader: boolean, isLast: boolean): Decoration {
  const classes = [
    'cm-table-cell',
    isHeader ? 'cm-table-header-cell' : '',
    isLast ? 'cm-table-cell-last' : ''
  ]
    .filter(Boolean)
    .join(' ')
  return Decoration.mark({ class: classes })
}

function isWidgetizedTable(tableFrom: number, tableTo: number, blocks: TableBlockRange[]): boolean {
  return blocks.some((b) => b.from === tableFrom && b.to === tableTo)
}

function decorateTableBlockLines(
  state: EditorState,
  cursors: number[],
  marks: DecorationMark[],
  hiddenSeparatorLines: Set<number>,
  widgetizedTables: TableBlockRange[]
): void {
  const doc = state.doc
  const tree = syntaxTree(state)
  const lineClassKeys = new Set<string>()

  tree.iterate({
    enter(node: SyntaxNodeRef) {
      if (node.type.name !== 'Table') return

      const tableFrom = node.from
      const tableTo = node.to
      if (isWidgetizedTable(tableFrom, tableTo, widgetizedTables)) return

      const contentLines: Array<{ from: number; kind: 'header' | 'row' }> = []
      const startLineNum = doc.lineAt(node.from).number
      const endLineNum = doc.lineAt(node.to).number
      let headerLineText: string | null = null

      for (let lineNum = startLineNum; lineNum <= endLineNum; lineNum += 1) {
        const curLine = doc.line(lineNum)
        if (isTableSeparatorLine(curLine.text)) {
          if (!isCursorOnLine(curLine.from, curLine.to, cursors)) {
            hiddenSeparatorLines.add(curLine.from)
            pushTableLineStyle(marks, curLine.from, 'cm-table-separator-line', lineClassKeys)
          }
          continue
        }

        if (lineNum === startLineNum) {
          headerLineText = curLine.text
          contentLines.push({ from: curLine.from, kind: 'header' })
        } else {
          contentLines.push({ from: curLine.from, kind: 'row' })
        }
      }

      const columnCount = countTableColumns(headerLineText ?? '')

      const lastContentLine = contentLines[contentLines.length - 1]
      for (const lineInfo of contentLines) {
        const line = doc.lineAt(lineInfo.from)
        const onActiveLine = isCursorOnLine(line.from, line.to, cursors)
        const isFirst = lineInfo.kind === 'header'
        const isLast = lineInfo.from === lastContentLine?.from

        const classes = ['cm-table-line']
        if (onActiveLine) {
          classes.push('cm-table-line-active')
        } else if (isFirst) {
          classes.push('cm-table-header-line')
        } else {
          classes.push('cm-table-row-line')
        }
        if (isFirst) classes.push('cm-table-line-first')
        if (isLast) classes.push('cm-table-line-last')

        pushTableLineStyle(marks, lineInfo.from, classes.join(' '), lineClassKeys, columnCount)
      }
    }
  })
}

/** 表格 live preview：隐藏分隔符、对齐行，并为表头/数据行加样式 */
export function collectTableDecorations(
  state: EditorState,
  cursors: number[],
  marks: DecorationMark[],
  widgetizedTables: TableBlockRange[] = []
): void {
  const tree = syntaxTree(state)
  const doc = state.doc
  const hiddenSeparatorLines = new Set<number>()

  decorateTableBlockLines(state, cursors, marks, hiddenSeparatorLines, widgetizedTables)

  tree.iterate({
    enter(node: SyntaxNodeRef) {
      if (!isInsideTable(node)) return

      const tableRoot = findTableRoot(node)
      if (tableRoot && isWidgetizedTable(tableRoot.from, tableRoot.to, widgetizedTables)) return

      const line = doc.lineAt(node.from)
      const onActiveLine = isCursorOnLine(line.from, line.to, cursors)
      const name = node.type.name

      if (name === 'TableDelimiter') {
        if (onActiveLine) return

        if (isTableSeparatorLine(line.text)) return

        const cursorInDelimiter = isCursorInRange(node.from, node.to, cursors)
        if (!cursorInDelimiter) {
          pushDecoration(marks, hideMark, node.from, node.to)
        }
        return
      }

      if (onActiveLine) return

      if (name === 'TableCell') {
        const parentName = node.node.parent?.type.name
        const isHeader = parentName === 'TableHeader'
        const isLast = isLastTableCellInRow(node.node)
        pushDecoration(marks, cellMarkDecoration(isHeader, isLast), node.from, node.to)
      }
    }
  })
}
