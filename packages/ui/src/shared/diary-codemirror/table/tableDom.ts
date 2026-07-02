import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import type { EditorView } from '@codemirror/view'
import { findTableNodeBounds, resolveTableSurfaceRange } from './tableBounds'
import { parseTableFromDoc } from './table.model'
import { buildTableMarkdown } from './table.ops'
import { allowTableStructureEdit } from './tableEffects'
import { encodeTableCellText } from './tableCellText'

export const TABLE_CELL_SOURCE_SELECTOR = '.cm-table-cell-source'

/** 当前焦点是否在表格单元格可编辑区内 */
export function isTableCellEditorFocused(): boolean {
  const active = document.activeElement
  return active instanceof HTMLElement && active.matches(TABLE_CELL_SOURCE_SELECTOR)
}

export function blurTableCellEditor(): void {
  const active = document.activeElement
  if (active instanceof HTMLElement && active.matches(TABLE_CELL_SOURCE_SELECTOR)) {
    active.blur()
  }
}

export function readCellSourceRaw(source: HTMLElement): string {
  const text = (source.textContent ?? '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
  return encodeTableCellText(text)
}

export function readTableModelFromBlock(block: HTMLElement): {
  header: string[]
  rows: string[][]
} | null {
  const header = Array.from(block.querySelectorAll('thead th .cm-table-cell-source')).map((el) =>
    readCellSourceRaw(el as HTMLElement)
  )
  if (header.length === 0) return null
  const rows = Array.from(block.querySelectorAll('tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td .cm-table-cell-source')).map((el) =>
      readCellSourceRaw(el as HTMLElement)
    )
  )
  return { header, rows }
}

/** 从 widget DOM 反查当前文档中的表格区间（随编辑实时变化） */
export function findCurrentTableRange(
  view: EditorView,
  block: HTMLElement
): { from: number; to: number } | null {
  const pos = view.posAtDOM(block)
  if (pos < 0) return null

  const tree = syntaxTree(view.state)
  let node: SyntaxNode | null = tree.resolveInner(pos, 1)
  while (node && node.name !== 'Table') {
    node = node.parent
  }
  if (node) {
    const surface = resolveTableSurfaceRange(view.state, node.from, node.to)
    if (surface) return { from: surface.nodeFrom, to: surface.nodeTo }
    return { from: node.from, to: node.to }
  }

  const tableFrom = Number(block.dataset.tableFrom)
  if (!Number.isNaN(tableFrom)) {
    const bounds = findTableNodeBounds(view.state, tableFrom)
    if (bounds) {
      const surface = resolveTableSurfaceRange(view.state, bounds.nodeFrom, bounds.nodeTo)
      if (surface) return { from: surface.nodeFrom, to: surface.nodeTo }
      return { from: bounds.nodeFrom, to: bounds.nodeTo }
    }
  }

  let found: SyntaxNode | null = null
  tree.iterate({
    enter(n) {
      if (n.name !== 'Table') return
      if (n.from <= pos && n.to >= pos) {
        found = n.node
        return false
      }
    }
  })
  if (!found) return null
  return { from: found.from, to: found.to }
}

export function dispatchTableModelFromBlock(view: EditorView, block: HTMLElement): boolean {
  const model = readTableModelFromBlock(block)
  if (!model) return false
  const range = findCurrentTableRange(view, block)
  if (!range) return false

  const table = parseTableFromDoc(view.state.doc, range.from, range.to)
  if (!table) return false

  const nextMarkdown = buildTableMarkdown({
    ...table,
    header: { ...table.header, cells: model.header },
    bodyRows: model.rows.map((cells, index) => ({
      lineFrom: table.bodyRows[index]?.lineFrom ?? range.to,
      lineTo: table.bodyRows[index]?.lineTo ?? range.to,
      cells
    }))
  })

  const current = view.state.doc.sliceString(range.from, range.to)
  if (nextMarkdown === current) return false

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: nextMarkdown },
    annotations: allowTableStructureEdit.of(true)
  })
  return true
}

export function focusTableCellSource(
  block: HTMLElement,
  rowIndex: number,
  colIndex: number,
  placeAtEnd = true
): boolean {
  const source = block.querySelector(
    `${TABLE_CELL_SOURCE_SELECTOR}[data-row="${rowIndex}"][data-col="${colIndex}"]`
  ) as HTMLElement | null
  if (!source) return false
  source.focus()
  if (!placeAtEnd) return true
  const selection = source.ownerDocument.getSelection()
  if (!selection) return true
  const range = source.ownerDocument.createRange()
  range.selectNodeContents(source)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
  return true
}

export function getAllTableCellSources(block: HTMLElement): HTMLElement[] {
  return Array.from(block.querySelectorAll(TABLE_CELL_SOURCE_SELECTOR))
}
