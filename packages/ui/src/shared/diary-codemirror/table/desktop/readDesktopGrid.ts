import { EditorView } from '@codemirror/view'
import { encodeTableCellText } from '../tableCellText'
import { domRowToParsedRow } from './models/cellLocation'
import type { TableGridModel } from '../tableGridModel'
import { parseTableFromDoc } from '../table.model'
import { readTableAlignmentsFromDoc } from '../table.ops'
import { findTableNodeBounds } from '../tableBounds'

const SOURCE = '.cm-table-cell-source'
const EDITOR_MOUNT = '.cm-table-cell-editor'

/** 从桌面 widget 读取网格（data-row：0=表头） */
export function readTableGridFromDesktopBlock(
  block: HTMLElement,
  view?: EditorView
): TableGridModel | null {
  const colCount = block.querySelectorAll('.cm-table-preview thead th').length
  if (colCount === 0) return null

  const header: string[] = []
  const rows: string[][] = []

  block.querySelectorAll('.cm-table-grid-cell').forEach((cell) => {
    const el = cell as HTMLElement
    const domRow = Number(el.dataset.row)
    const col = Number(el.dataset.col)
    if (Number.isNaN(domRow) || Number.isNaN(col)) return

    const raw = readCellRaw(el)
    const parsedRow = domRowToParsedRow(domRow)
    if (parsedRow === -1) {
      header[col] = raw
    } else {
      if (!rows[parsedRow]) rows[parsedRow] = []
      rows[parsedRow]![col] = raw
    }
  })

  while (header.length < colCount) header.push('')
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? []
    while (row.length < colCount) row.push('')
    rows[r] = row.slice(0, colCount)
  }

  const grid: TableGridModel = { header, rows }
  if (view) {
    const tableFrom = Number(block.dataset.tableFrom)
    if (!Number.isNaN(tableFrom)) {
      const bounds = findTableNodeBounds(view.state, tableFrom)
      if (bounds) {
        const table = parseTableFromDoc(view.state.doc, bounds.table.from, bounds.table.to)
        if (table) grid.alignments = readTableAlignmentsFromDoc(table, view.state.doc)
      }
    }
  }

  return grid
}

function readCellRaw(cell: HTMLElement): string {
  const mount = cell.querySelector(EDITOR_MOUNT) as HTMLElement | null
  if (mount) {
    const cm = EditorView.findFromDOM(mount)
    if (cm) return encodeTableCellText(cm.state.doc.toString())
  }
  const source = cell.querySelector(SOURCE) as HTMLElement | null
  if (source?.dataset.raw != null) return source.dataset.raw
  return encodeTableCellText(source?.textContent ?? '')
}
