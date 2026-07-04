import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { EditorView } from '@codemirror/view'
import { findTableNodeBounds } from './tableBounds'
import { parseTableFromDoc } from './table.model'
import { buildTableMarkdown } from './table.ops'
import { allowTableStructureEdit } from './tableEffects'
import { logTableDesktop } from './tableDesktopDebug'
import { encodeTableCellText } from './tableCellText'
import { readTableGridFromBlock } from './tableGridModel'

export const TABLE_CELL_SOURCE_SELECTOR = '.cm-table-cell-source'
export const TABLE_CELL_EDITOR_SELECTOR = '.cm-table-cell-editor'

/** 当前焦点是否在表格单元格可编辑区内（contenteditable 或嵌套 CM） */
export function isTableCellEditorFocused(): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  return (
    active.matches(TABLE_CELL_SOURCE_SELECTOR) ||
    Boolean(active.closest(TABLE_CELL_EDITOR_SELECTOR))
  )
}

export function blurTableCellEditor(): void {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return
  if (active.matches(TABLE_CELL_SOURCE_SELECTOR)) {
    active.blur()
    return
  }
  const editor = active.closest(TABLE_CELL_EDITOR_SELECTOR)
  if (editor instanceof HTMLElement) {
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
  return readTableGridFromBlock(block)
}

/** 从表格 widget 根节点查找外层日记编辑器（避开嵌套单元格 CM） */
export function findRootEditorViewFromTableBlock(block: HTMLElement): EditorView | null {
  let el: HTMLElement | null = block.parentElement
  while (el) {
    const view = EditorView.findFromDOM(el)
    if (view?.dom.contains(block)) return view
    el = el.parentElement
  }
  return null
}

/** 从 widget DOM 反查当前文档中的表格区间（随编辑实时变化） */
export function findCurrentTableRange(
  view: EditorView,
  block: HTMLElement
): { from: number; to: number } | null {
  const tableFrom = Number(block.dataset.tableFrom)
  if (!Number.isNaN(tableFrom)) {
    const bounds = findTableNodeBounds(view.state, tableFrom)
    if (bounds) {
      return { from: bounds.table.from, to: bounds.table.to }
    }
  }

  const pos = view.posAtDOM(block)
  if (pos < 0) return null

  const tree = syntaxTree(view.state)
  let node: SyntaxNode | null = tree.resolveInner(pos, 1)
  while (node && node.name !== 'Table') {
    node = node.parent
  }
  if (node) {
    const table = parseTableFromDoc(view.state.doc, node.from, node.to)
    if (table) return { from: table.from, to: table.to }
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
  const table = parseTableFromDoc(view.state.doc, found.from, found.to)
  if (!table) return null
  return { from: table.from, to: table.to }
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
  if (nextMarkdown === current) {
    logTableDesktop('dispatch:unchanged', { from: range.from, to: range.to })
    return false
  }

  logTableDesktop('dispatch:commit', {
    from: range.from,
    to: range.to,
    len: nextMarkdown.length,
    cellFocused: isTableCellEditorFocused()
  })
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
  placeAtEnd = false
): boolean {
  const source = block.querySelector(
    `${TABLE_CELL_SOURCE_SELECTOR}[data-row="${rowIndex}"][data-col="${colIndex}"]`
  ) as HTMLElement | null
  if (!source) return false
  source.focus()
  if (!placeAtEnd) return true
  const selection = source.ownerDocument.getSelection()
  if (!selection || !source.isConnected) return true
  try {
    const range = source.ownerDocument.createRange()
    range.selectNodeContents(source)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  } catch {
    // widget 重建时选区可能短暂无效
  }
  return true
}

/** 将光标置于点击位置（桌面端单击编辑） */
export function focusTableCellSourceAtPoint(
  block: HTMLElement,
  rowIndex: number,
  colIndex: number,
  clientX: number,
  clientY: number
): boolean {
  const source = block.querySelector(
    `${TABLE_CELL_SOURCE_SELECTOR}[data-row="${rowIndex}"][data-col="${colIndex}"]`
  ) as HTMLElement | null
  if (!source) return false
  source.focus()
  const doc = source.ownerDocument
  try {
    if (typeof doc.caretPositionFromPoint === 'function') {
      const pos = doc.caretPositionFromPoint(clientX, clientY)
      if (pos?.offsetNode && source.contains(pos.offsetNode)) {
        const range = doc.createRange()
        range.setStart(pos.offsetNode, pos.offset)
        range.collapse(true)
        const selection = doc.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        return true
      }
    }
    const legacy = doc.caretRangeFromPoint?.(clientX, clientY)
    if (legacy && source.contains(legacy.startContainer)) {
      const selection = doc.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(legacy)
      return true
    }
  } catch {
    // fall through
  }
  return focusTableCellSource(block, rowIndex, colIndex, false)
}

export function getAllTableCellSources(block: HTMLElement): HTMLElement[] {
  return Array.from(block.querySelectorAll(TABLE_CELL_SOURCE_SELECTOR))
}

/** 从 widget DOM（含未 blur 的编辑内容）序列化当前表格 markdown */
export function readTableMarkdownFromBlock(view: EditorView, block: HTMLElement): string | null {
  const model = readTableModelFromBlock(block)
  const range = findCurrentTableRange(view, block)
  if (!model || !range) return null

  const table = parseTableFromDoc(view.state.doc, range.from, range.to)
  if (!table) return view.state.doc.sliceString(range.from, range.to)

  return buildTableMarkdown({
    ...table,
    header: { ...table.header, cells: model.header },
    bodyRows: model.rows.map((cells, index) => ({
      lineFrom: table.bodyRows[index]?.lineFrom ?? range.to,
      lineTo: table.bodyRows[index]?.lineTo ?? range.to,
      cells
    }))
  })
}

export async function writeTextToClipboard(text: string): Promise<boolean> {
  if (writeTextToClipboardSync(text)) return true
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** 在用户手势回调中优先同步复制（菜单点击等场景更可靠） */
export function writeTextToClipboardSync(text: string): boolean {
  if (typeof document === 'undefined') return false
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    textarea.remove()
    return ok
  } catch {
    return false
  }
}

export async function copyTableMarkdownFromBlock(
  view: EditorView,
  block: HTMLElement
): Promise<boolean> {
  const markdown = readTableMarkdownFromBlock(view, block)
  if (!markdown) return false
  return writeTextToClipboard(markdown)
}
