import { EditorState, type Transaction } from '@codemirror/state'
import type { Text, TextLine } from '@codemirror/state'
import { isTableSeparatorLine } from './buildTable'
import { isTableContentLine } from './tableCell.utils'

const TABLE_CELL_LINE_BREAK = '<br>'

function isTableStructureLine(lineText: string): boolean {
  return isTableContentLine(lineText) || isTableSeparatorLine(lineText)
}

function isDeletingEntireLine(line: TextLine, fromA: number, toA: number): boolean {
  return fromA <= line.from && toA >= line.to
}

/** 删除区间是否完整覆盖表格的每一行（允许整表删除） */
function isDeletingWholeTableRun(
  doc: Text,
  fromA: number,
  toA: number,
  tableLines: TextLine[]
): boolean {
  if (tableLines.length === 0) return false
  return tableLines.every((line) => isDeletingEntireLine(line, fromA, toA))
}

function collectTableLinesInRange(doc: Text, fromA: number, toA: number): TextLine[] {
  const lines: TextLine[] = []
  const seen = new Set<number>()
  let pos = fromA
  while (pos < toA) {
    const line = doc.lineAt(pos)
    if (!seen.has(line.number) && isTableStructureLine(line.text)) {
      seen.add(line.number)
      lines.push(line)
    }
    pos = line.to + 1
  }
  return lines
}

function rangeDeletesPipe(
  doc: Text,
  line: TextLine,
  fromA: number,
  toA: number,
  tableLinesInDelete: TextLine[]
): boolean {
  const sliceFrom = Math.max(fromA, line.from)
  const sliceTo = Math.min(toA, line.to)
  if (sliceFrom >= sliceTo) return false

  for (let pos = sliceFrom; pos < sliceTo; pos++) {
    if (doc.sliceString(pos, pos + 1) !== '|') continue
    if (isDeletingEntireLine(line, fromA, toA)) continue
    if (isDeletingWholeTableRun(doc, fromA, toA, tableLinesInDelete)) continue
    return true
  }
  return false
}

function rangeMergesTableLines(doc: Text, fromA: number, toA: number): boolean {
  if (fromA >= toA) return false
  const deleted = doc.sliceString(fromA, toA)
  if (!deleted.includes('\n')) return false

  let scan = fromA
  while (scan < toA) {
    if (doc.sliceString(scan, scan + 1) !== '\n') {
      scan++
      continue
    }
    const above = doc.lineAt(scan)
    const below = scan + 1 < doc.length ? doc.lineAt(scan + 1) : null
    if (!below) {
      scan++
      continue
    }

    if (isTableContentLine(above.text) && isTableContentLine(below.text)) {
      const aboveFullyRemoved = fromA <= above.from && toA >= above.to
      const belowFullyRemoved = fromA <= below.from && toA >= below.to
      if (!aboveFullyRemoved && !belowFullyRemoved) {
        return true
      }
    }

    scan++
  }
  return false
}

function insertionSplitsTableRow(
  doc: Text,
  fromA: number,
  toA: number,
  inserted: string
): boolean {
  if (!inserted.includes('\n')) return false

  const startLine = doc.lineAt(fromA)
  const endLine = doc.lineAt(toA > fromA ? toA - 1 : fromA)

  for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
    const line = doc.line(lineNum)
    if (!isTableContentLine(line.text)) continue

    const insertsInsideRow =
      (fromA > line.from && fromA < line.to) ||
      (toA > line.from && toA < line.to) ||
      (fromA < toA && fromA >= line.from && toA <= line.to)

    if (insertsInsideRow) return true
  }

  return false
}

/** 是否允许该事务修改文档（保护表格管道符与行结构） */
export function isTableStructureChangeAllowed(tr: Transaction): boolean {
  if (!tr.docChanged) return true

  const oldDoc = tr.startState.doc

  let allowed = true
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (!allowed) return

    const insertedText = inserted.toString()
    const tableLinesInDelete = collectTableLinesInRange(oldDoc, fromA, toA)

    if (fromA < toA) {
      let pos = fromA
      while (pos < toA) {
        const line = oldDoc.lineAt(pos)
        if (isTableStructureLine(line.text)) {
          if (rangeDeletesPipe(oldDoc, line, fromA, toA, tableLinesInDelete)) {
            allowed = false
            return
          }
        }
        pos = line.to + 1
      }

      if (rangeMergesTableLines(oldDoc, fromA, toA)) {
        allowed = false
        return
      }
    }

    if (insertionSplitsTableRow(oldDoc, fromA, toA, insertedText)) {
      allowed = false
    }
  })

  return allowed
}

export const tableStructureProtectFilter = EditorState.changeFilter.of((tr) =>
  isTableStructureChangeAllowed(tr)
)

export { TABLE_CELL_LINE_BREAK }
