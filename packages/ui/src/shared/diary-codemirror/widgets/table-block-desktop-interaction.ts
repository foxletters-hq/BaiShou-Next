import type { EditorView } from '@codemirror/view'
import { parseTableFromDoc } from '../table/table.model'
import { readActiveTableCellFor, setActiveTableCell } from '../table/tableActiveCell'
import { setTableCellEditing } from '../table/tableCellEditing'
import { setTableChromeSelection } from '../table/tableChromeSelection'
import { logTableDesktop } from '../table/tableDesktopDebug'
import {
  blurTableCellEditor,
  dispatchTableModelFromBlock,
  findCurrentTableRange,
  isTableCellEditorFocused
} from '../table/tableDom'
import { pendingTableCellFocus } from '../table/tableEffects'
import { isTableTypeToEditKey } from '../table/tableInputKeys'
import {
  matchTableNavigateKey,
  runTableNavigateAction,
  sectionFromRangeSelection
} from '../table/tableNavigateActions'
import { TableOutlineSession } from '../table/tableOutlineSession'
import {
  copyTableRange,
  clearTableRange,
  pasteTableRange,
  readClipboardTextForTablePaste
} from '../table/tableRangeClipboard'
import { applyRangeHighlightToBlock, setTableRangeDragging } from '../table/tableRangeHighlight'
import {
  normalizeTableCellRange,
  readTableCellRangeSelectionFor,
  setTableCellRangeSelection,
  type TableCellRangeSelection
} from '../table/tableRangeSelection'
import { TableSection, type CellLocation } from '../table/tableSection'
import { commitTableCellEditors, isNestedCellEditorActive } from '../table/tableWidgetSync'

const TABLE_CHROME_INTERACTIVE_SELECTOR =
  '.cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn, .cm-table-context-menu-layer, .cm-table-context-menu'

/**
 * 框选结束写回 editor state。
 * 抽成函数是为了让桌面指针交互不回头抓 WidgetType 实例。
 */
export function commitTableRangeSelection(
  editorView: () => EditorView | null,
  tableFrom: number,
  anchorRow: number,
  anchorCol: number,
  headRow: number,
  headCol: number
): void {
  const view = editorView()
  if (!view) return
  view.dispatch({
    effects: [
      setActiveTableCell.of({ tableFrom, rowIndex: headRow, colIndex: headCol }),
      setTableCellEditing.of(null),
      setTableChromeSelection.of(null),
      setTableCellRangeSelection.of({
        tableFrom,
        anchorRow,
        anchorCol,
        headRow,
        headCol
      })
    ]
  })
  queueMicrotask(() => {
    const block = view.dom.querySelector(
      `.cm-table-block[data-table-from="${tableFrom}"]`
    ) as HTMLElement | null
    block?.focus()
  })
}

/**
 * 桌面端框选、剪贴板与键盘导航。
 * 这些监听必须挂在当前 root 上，但逻辑不依赖 WidgetType 生命周期。
 */
export function installDesktopTableInteraction(
  root: HTMLElement,
  tableFrom: number,
  editorView: () => EditorView | null
): void {
  root.tabIndex = -1
  const tableEl = root.querySelector('.cm-table-preview') as HTMLTableElement | null
  const scrollHost = root.querySelector('.cm-table-scroll-host') as HTMLElement | null

  let liveSection: TableSection | null = null

  const resolveBlock = (): HTMLElement | null => {
    const view = editorView()
    if (!view) return root.isConnected ? root : null
    return view.dom.querySelector(
      `.cm-table-block[data-table-from="${tableFrom}"]`
    ) as HTMLElement | null
  }

  const sectionToBounds = (section: TableSection) =>
    normalizeTableCellRange({
      tableFrom,
      anchorRow: section.startRow,
      anchorCol: section.startCol,
      headRow: section.endRow,
      headCol: section.endCol
    })

  const getRangeSelection = (): TableCellRangeSelection | null => {
    const view = editorView()
    if (!view) return null
    return readTableCellRangeSelectionFor(view.state, tableFrom)
  }

  const getBounds = () => {
    if (liveSection) return sectionToBounds(liveSection)
    const selected = getRangeSelection()
    if (selected) return normalizeTableCellRange(selected)
    return null
  }

  const paintSection = (section: TableSection | null) => {
    const block = resolveBlock()
    if (!block) return
    applyRangeHighlightToBlock(block, section ? sectionToBounds(section) : null)
  }

  const getScrollOffset = () => {
    const view = editorView()
    const scrollX = (scrollHost?.scrollLeft ?? 0) + (view?.scrollDOM.scrollLeft ?? 0)
    const scrollY = (scrollHost?.scrollTop ?? 0) + (view?.scrollDOM.scrollTop ?? 0)
    return { x: scrollX, y: scrollY }
  }

  const getCellFromPoint = (x: number, y: number) => {
    const block = resolveBlock()
    if (!block) return null
    const cell = document
      .elementFromPoint(x, y)
      ?.closest('.cm-table-grid-cell') as HTMLElement | null
    if (!cell || !block.contains(cell)) return null
    const row = Number(cell.dataset.row)
    const col = Number(cell.dataset.col)
    if (Number.isNaN(row) || Number.isNaN(col)) return null
    return { cell, row, col }
  }

  const isInCellEditor = (target: EventTarget | null): boolean => {
    return target instanceof Element && Boolean(target.closest('.cm-table-cell-editor'))
  }

  const outlineCallbacks = (hit: { row: number; col: number }, _event: PointerEvent) => ({
    onOutlineStart: (_anchor: CellLocation) => {
      liveSection = TableSection.ofCell({ row: hit.row, col: hit.col })
    },
    onBeforeOutlineDrag: () => {
      window.getSelection()?.removeAllRanges()
      blurTableCellEditor()
      const block = resolveBlock()
      if (block) setTableRangeDragging(block, true)
      const view = editorView()
      view?.dispatch({
        effects: [setActiveTableCell.of(null), setTableCellEditing.of(null)]
      })
    },
    onOutlineExpand: (anchor: CellLocation, head: CellLocation, section: TableSection) => {
      liveSection = section
      paintSection(section)
      logTableDesktop('range:drag', { anchor, head })
    },
    onOutlineEnd: (
      anchor: CellLocation,
      head: CellLocation,
      section: TableSection,
      dragged: boolean
    ) => {
      const block = resolveBlock()
      if (block) setTableRangeDragging(block, false)
      liveSection = null
      paintSection(null)
      commitTableRangeSelection(editorView, tableFrom, anchor.row, anchor.col, head.row, head.col)
      logTableDesktop('range:select', { anchor, head, dragged, single: section.isSingleCell() })
    },
    getScrollOffset,
    getScrollElements: () => ({
      x: scrollHost ?? root,
      y: editorView()?.scrollDOM ?? root
    })
  })

  const resolveCellHit = (event: PointerEvent, target: Element) => {
    const cellFromTarget = target.closest('.cm-table-grid-cell') as HTMLElement | null
    if (cellFromTarget) {
      const row = Number(cellFromTarget.dataset.row)
      const col = Number(cellFromTarget.dataset.col)
      if (!Number.isNaN(row) && !Number.isNaN(col)) {
        return { cell: cellFromTarget, row, col }
      }
    }
    if (typeof document.elementFromPoint !== 'function') return null
    return getCellFromPoint(event.clientX, event.clientY)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest(TABLE_CHROME_INTERACTIVE_SELECTOR)) return
    if (!tableEl) return

    const block = resolveBlock()
    if (!block) return

    const hit = resolveCellHit(event, target)
    if (!hit) return

    const view = editorView()
    if (!view) return

    if (isTableCellEditorFocused()) {
      const editorCell = (document.activeElement as HTMLElement)?.closest(
        '.cm-table-cell-editor'
      ) as HTMLElement | null
      const prevRow = Number(editorCell?.dataset.row)
      const prevCol = Number(editorCell?.dataset.col)
      if (prevRow !== hit.row || prevCol !== hit.col) {
        commitTableCellEditors(block, view)
      }
    }

    if (
      isNestedCellEditorActive(view, tableFrom, hit.row, hit.col) &&
      !event.shiftKey &&
      !getRangeSelection()
    ) {
      return
    }

    if (
      event.shiftKey &&
      isInCellEditor(target) &&
      readActiveTableCellFor(view.state, tableFrom)?.rowIndex === hit.row &&
      readActiveTableCellFor(view.state, tableFrom)?.colIndex === hit.col
    ) {
      return
    }

    const rangeSel = getRangeSelection()
    const existingAnchor: CellLocation | undefined = rangeSel
      ? { row: rangeSel.anchorRow, col: rangeSel.anchorCol }
      : undefined

    if (!isInCellEditor(target) || rangeSel) {
      event.preventDefault()
    }

    TableOutlineSession.start(
      tableEl,
      { row: hit.row, col: hit.col },
      event,
      outlineCallbacks(hit, event),
      { shiftKey: event.shiftKey, existingAnchor }
    )
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTableCellEditorFocused()) return
    const block = resolveBlock()
    const view = editorView()
    if (!view || !block) return

    const rangeSel = readTableCellRangeSelectionFor(view.state, tableFrom)
    const active = readActiveTableCellFor(view.state, tableFrom)
    if (!rangeSel && !active) return

    if (isTableTypeToEditKey(event) && active) {
      const section = rangeSel
        ? sectionFromRangeSelection(rangeSel)
        : TableSection.ofCell({ row: active.rowIndex, col: active.colIndex })
      if (section.isSingleCell()) {
        event.preventDefault()
        const row = rangeSel?.headRow ?? active.rowIndex
        const col = rangeSel?.headCol ?? active.colIndex
        view.dispatch({
          effects: [
            setTableCellEditing.of({ tableFrom, rowIndex: row, colIndex: col }),
            pendingTableCellFocus.of({
              tableFrom,
              rowIndex: row,
              colIndex: col,
              placeAtEnd: true,
              initialInsertText: event.key
            })
          ]
        })
        return
      }
    }

    const navKey = matchTableNavigateKey(event)
    if (navKey && active && rangeSel) {
      const range = findCurrentTableRange(view, block)
      const table = range ? parseTableFromDoc(view.state.doc, range.from, range.to) : null
      if (range && table) {
        event.preventDefault()
        runTableNavigateAction(
          view,
          {
            tableFrom,
            tableTo: range.to,
            table,
            activeCell: { row: active.rowIndex, col: active.colIndex },
            anchorCell: { row: rangeSel.anchorRow, col: rangeSel.anchorCol },
            section: sectionFromRangeSelection(rangeSel)
          },
          navKey
        )
        block.focus()
        return
      }
    }

    const bounds = getBounds()
    if (!bounds) return

    const mod = event.metaKey || event.ctrlKey
    if (mod && event.key === 'c') {
      event.preventDefault()
      copyTableRange(block, bounds)
      return
    }
    if (mod && event.key === 'x') {
      event.preventDefault()
      copyTableRange(block, bounds)
      clearTableRange(block, bounds)
      dispatchTableModelFromBlock(view, block)
      return
    }
    if (mod && event.key === 'v') {
      event.preventDefault()
      void readClipboardTextForTablePaste().then((text) => {
        const target = resolveBlock()
        if (!text || !target) return
        pasteTableRange(target, bounds, text)
        dispatchTableModelFromBlock(view, target)
      })
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      clearTableRange(block, bounds)
      dispatchTableModelFromBlock(view, block)
      view.dispatch({ effects: setTableCellRangeSelection.of(null) })
      applyRangeHighlightToBlock(block, null)
    }
  }

  const onCopy = (event: ClipboardEvent) => {
    if (isTableCellEditorFocused()) return
    const block = resolveBlock()
    const bounds = getBounds()
    if (!block || !bounds) return
    event.preventDefault()
    copyTableRange(block, bounds)
  }

  const onCut = (event: ClipboardEvent) => {
    if (isTableCellEditorFocused()) return
    const block = resolveBlock()
    const bounds = getBounds()
    const view = editorView()
    if (!block || !bounds || !view) return
    event.preventDefault()
    copyTableRange(block, bounds)
    clearTableRange(block, bounds)
    dispatchTableModelFromBlock(view, block)
  }

  const onPaste = (event: ClipboardEvent) => {
    if (isTableCellEditorFocused()) return
    const block = resolveBlock()
    const bounds = getBounds()
    const view = editorView()
    if (!block || !bounds || !view) return
    const text = event.clipboardData?.getData('text/plain')
    if (!text) return
    event.preventDefault()
    pasteTableRange(block, bounds, text)
    dispatchTableModelFromBlock(view, block)
  }

  root.addEventListener('pointerdown', onPointerDown, true)
  root.addEventListener('keydown', onKeyDown)
  root.addEventListener('copy', onCopy)
  root.addEventListener('cut', onCut)
  root.addEventListener('paste', onPaste)
}
