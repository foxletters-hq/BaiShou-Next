import i18n from 'i18next'
import { StateEffect } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { normalizeTableCellDisplay } from '../table/tableCellText'
import { resolveTableKeyAction, type TableKeyCommand } from '../table/tableKeyResolver'
import { setActiveTableCell } from '../table/tableActiveCell'
import { setTableChromeSelection } from '../table/tableChromeSelection'
import {
  blurTableCellEditor,
  dispatchTableModelFromBlock,
  focusTableCellSource,
  readCellSourceRaw
} from '../table/tableDom'
import { pendingTableCellFocus } from '../table/tableEffects'
import { openTableCellContextMenu } from '../table/tableContextMenu'
import {
  isCellInTableRange,
  normalizeTableCellRange,
  setTableCellRangeSelection
} from '../table/tableRangeSelection'
import {
  copyTableRange,
  clearTableRange,
  pasteTableRange,
  readClipboardTextForTablePaste
} from '../table/tableRangeClipboard'
import { findTableToByFrom } from '../table/tableBounds'
import { placeCursorAfterTable } from '../table/tableFocus'
import { getTableCellEditorHost } from '../table/tableWidgetSync'
import { logTableDesktop } from '../table/tableDesktopDebug'
import { showMenu, syncActiveHandles } from './table-block-chrome'
import {
  commitFocusedCell,
  runTableBlockAction,
  type TableBlockWidgetContext
} from './table-block-widget-context'

/**
 * 单元格 DOM 与触摸端 contenteditable。
 * 与 chrome 分开：格子编辑改的是单元格源码，不该和行列把手拖拽写在同一段里。
 */
export function createCell(
  ctx: TableBlockWidgetContext,
  raw: string,
  rowIndex: number,
  colIndex: number,
  isHeader: boolean
): HTMLElement {
  const el = document.createElement(isHeader ? 'th' : 'td')
  el.className = 'cm-table-grid-cell'
  el.dataset.row = String(rowIndex)
  el.dataset.col = String(colIndex)
  if (ctx.chromeSelection?.kind === 'col' && ctx.chromeSelection.index === colIndex) {
    el.classList.add('cm-table-grid-cell--col-selected')
  }
  if (ctx.chromeSelection?.kind === 'row' && ctx.chromeSelection.index === rowIndex) {
    el.classList.add('cm-table-grid-cell--row-selected')
  }
  if (ctx.rangeSelection) {
    const bounds = normalizeTableCellRange(ctx.rangeSelection)
    if (isCellInTableRange(rowIndex, colIndex, bounds)) {
      el.classList.add('cm-table-grid-cell--range-selected')
    }
  }

  const align = ctx.columnAlignments[colIndex]
  if (align && align !== 'none') {
    el.setAttribute('align', align)
    el.style.textAlign = align
  }

  el.appendChild(
    ctx.platform?.interactionMode === 'touch'
      ? createEditableCell(ctx, raw, rowIndex, colIndex)
      : createCellContent(raw, rowIndex, colIndex)
  )

  const onCellContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const view = ctx.editorView()
    if (!view) return
    commitFocusedCell(ctx)
    if (ctx.rangeSelection) {
      openRangeContextMenu(ctx, view, event.clientX, event.clientY)
      return
    }
    logTableDesktop('cell:contextmenu', { rowIndex, colIndex })
    openTableCellContextMenu(view, ctx.table, rowIndex, colIndex, event.clientX, event.clientY)
  }
  el.addEventListener('contextmenu', onCellContextMenu, true)

  return el
}

export function createCellContent(raw: string, rowIndex: number, colIndex: number): HTMLElement {
  const inner = document.createElement('div')
  inner.className = 'cm-table-cell-inner'

  const viewEl = document.createElement('div')
  viewEl.className = 'cm-table-cell-view'
  viewEl.dataset.row = String(rowIndex)
  viewEl.dataset.col = String(colIndex)
  viewEl.textContent = normalizeTableCellDisplay(raw) || ''

  const source = document.createElement('div')
  source.className = 'cm-table-cell-source'
  source.hidden = true
  source.dataset.row = String(rowIndex)
  source.dataset.col = String(colIndex)
  source.dataset.raw = raw

  inner.appendChild(viewEl)
  inner.appendChild(source)

  return inner
}

/** @deprecated touch 路径仍使用 contenteditable */
export function createEditableCell(
  ctx: TableBlockWidgetContext,
  raw: string,
  rowIndex: number,
  colIndex: number
): HTMLElement {
  const source = document.createElement('div')
  source.className = 'cm-table-cell-source'
  source.contentEditable = 'true'
  source.spellcheck = false
  source.dataset.row = String(rowIndex)
  source.dataset.col = String(colIndex)
  source.dataset.raw = raw
  source.textContent = normalizeTableCellDisplay(raw) || ''

  let composing = false
  let committing = false
  const flushCommit = (reason: string) => {
    const root = ctx.getRootEl()
    if (!root) return
    const view = ctx.editorView()
    if (!view) return
    source.dataset.raw = readCellSourceRaw(source)
    committing = true
    logTableDesktop('cell:commit', {
      reason,
      rowIndex,
      colIndex,
      raw: source.dataset.raw,
      focused: document.activeElement === source
    })
    try {
      dispatchTableModelFromBlock(view, root)
    } finally {
      queueMicrotask(() => {
        committing = false
      })
    }
  }

  source.addEventListener('compositionstart', () => {
    composing = true
  })
  source.addEventListener('compositionend', () => {
    composing = false
    flushCommit('compositionend')
  })
  source.addEventListener('input', (event) => {
    if (composing || (event as InputEvent).isComposing) return
    logTableDesktop('cell:input', {
      rowIndex,
      colIndex,
      length: (source.textContent ?? '').length
    })
  })
  source.addEventListener('focus', () => {
    logTableDesktop('cell:focus', { rowIndex, colIndex })
    syncActiveHandles(ctx, rowIndex, colIndex)
    const view = ctx.editorView()
    if (!view) return
    const effects: StateEffect<unknown>[] = [
      setActiveTableCell.of({
        tableFrom: ctx.table.from,
        rowIndex,
        colIndex
      }),
      setTableCellRangeSelection.of(null)
    ]
    if (rowIndex >= 0) {
      effects.push(
        setTableChromeSelection.of({ tableFrom: ctx.table.from, kind: 'row', index: rowIndex })
      )
    } else {
      effects.push(
        setTableChromeSelection.of({ tableFrom: ctx.table.from, kind: 'col', index: colIndex })
      )
    }
    view.dispatch({ effects })
  })
  source.addEventListener('blur', () => {
    if (committing) return
    flushCommit('blur')
    const root = ctx.getRootEl()
    queueMicrotask(() => {
      if (root?.contains(document.activeElement)) return
      logTableDesktop('cell:blur-clear-active', {
        rowIndex,
        colIndex,
        activeElement:
          document.activeElement instanceof HTMLElement
            ? document.activeElement.className.slice(0, 40)
            : null
      })
      const view = ctx.editorView()
      view?.dispatch({ effects: setActiveTableCell.of(null) })
    })
  })
  source.addEventListener('keydown', (event) => {
    const command = mapTableKeyCommand(event)
    if (!command) return
    const action = resolveTableKeyAction(ctx.table, rowIndex, colIndex, command)
    if (!action) return
    event.preventDefault()
    event.stopPropagation()
    handleCellKeyAction(ctx, action, rowIndex, colIndex)
  })
  source.addEventListener('paste', (event) => {
    event.preventDefault()
    const text = (event.clipboardData?.getData('text/plain') ?? '').replace(/[\r\n]+/g, ' ')
    const selection = source.ownerDocument.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
    flushCommit('paste')
  })

  return source
}

export function handleCellKeyAction(
  ctx: TableBlockWidgetContext,
  action: ReturnType<typeof resolveTableKeyAction>,
  _rowIndex: number,
  _colIndex: number
): void {
  if (!action) return
  const root = ctx.getRootEl()
  if (!root) return
  const view = ctx.editorView()
  if (!view) return

  switch (action.kind) {
    case 'insert-inline-break': {
      const host = getTableCellEditorHost(root)
      if (!host) return
      const cm = host.editorView
      const head = cm.state.selection.main.head
      cm.dispatch({
        changes: { from: head, insert: action.insertText },
        selection: {
          anchor: head + action.insertText.length,
          head: head + action.insertText.length
        }
      })
      commitFocusedCell(ctx)
      return
    }
    case 'focus-cell': {
      commitFocusedCell(ctx)
      focusTableCellSource(root, action.rowIndex, action.colIndex)
      view.dispatch({
        effects: [
          setActiveTableCell.of({
            tableFrom: ctx.table.from,
            rowIndex: action.rowIndex,
            colIndex: action.colIndex
          }),
          pendingTableCellFocus.of({
            tableFrom: ctx.table.from,
            rowIndex: action.rowIndex,
            colIndex: action.colIndex
          })
        ]
      })
      return
    }
    case 'insert-row-below': {
      commitFocusedCell(ctx)
      const newRowIndex = action.afterRowIndex + 1
      runTableBlockAction(ctx, {
        type: 'addRow',
        tableFrom: ctx.table.from,
        tableTo: ctx.table.to,
        atIndex: newRowIndex,
        focusAfter: { rowIndex: newRowIndex, colIndex: 0 }
      })
      return
    }
    case 'exit-after': {
      commitFocusedCell(ctx)
      blurTableCellEditor()
      view.dispatch({ effects: setActiveTableCell.of(null) })
      const tableTo = findTableToByFrom(view.state, ctx.table.from) ?? ctx.table.to
      placeCursorAfterTable(view, tableTo)
      return
    }
  }
}

export function mapTableKeyCommand(event: KeyboardEvent): TableKeyCommand | null {
  if (event.key === 'Tab' && event.shiftKey) return 'shift-tab'
  if (event.key === 'Tab') return 'tab'
  if (event.key === 'Enter' && event.shiftKey) return 'shift-enter'
  if (event.key === 'Enter') return 'enter'
  if (event.key === 'Escape') return 'escape'
  return null
}

/** 框选右键菜单走单元格路径：选区属于格子内容，不是行列把手。 */
export function openRangeContextMenu(
  ctx: TableBlockWidgetContext,
  view: EditorView,
  clientX: number,
  clientY: number
): void {
  if (!ctx.rangeSelection) return
  const root = ctx.getRootEl()
  if (!root) return
  const bounds = normalizeTableCellRange(ctx.rangeSelection)
  const sections = [
    {
      items: [
        {
          id: 'cut-range',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L1324',
            '剪切'
          )
        },
        {
          id: 'copy-range',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L1325',
            '复制'
          )
        },
        {
          id: 'paste-range',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L1326',
            '粘贴'
          )
        }
      ]
    },
    {
      items: [
        {
          id: 'clear-range',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L1331',
            '清空选中的单元格'
          )
        },
        {
          id: 'delete-range',
          label: i18n.t(
            'auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L1332',
            '删除选中的单元格'
          ),
          destructive: true
        }
      ]
    }
  ]
  const items = sections.flatMap((s) => s.items)
  showMenu(ctx, items, clientX, clientY, (id) => {
    const currentRoot = ctx.getRootEl()
    if (!currentRoot) return
    if (id === 'copy-range') {
      copyTableRange(currentRoot, bounds)
      return
    }
    if (id === 'cut-range') {
      copyTableRange(currentRoot, bounds)
      clearTableRange(currentRoot, bounds)
      dispatchTableModelFromBlock(view, currentRoot)
      return
    }
    if (id === 'paste-range') {
      void readClipboardTextForTablePaste().then((text) => {
        const pasteRoot = ctx.getRootEl()
        if (!text || !pasteRoot) return
        pasteTableRange(pasteRoot, bounds, text)
        dispatchTableModelFromBlock(view, pasteRoot)
      })
      return
    }
    if (id === 'clear-range' || id === 'delete-range') {
      clearTableRange(currentRoot, bounds)
      dispatchTableModelFromBlock(view, currentRoot)
      view.dispatch({ effects: setTableCellRangeSelection.of(null) })
    }
  })
}
