/**
 * WidgetType 生命周期与 toDOM 组装。
 * 单元格编辑、chrome 把手、桌面框选已按职责抽出，避免再靠 eslint-disable 压行数。
 */
import i18n from 'i18next'
import { WidgetType, type EditorView } from '@codemirror/view'
import { StateEffect } from '@codemirror/state'
import { type ParsedTable, tableContentSignature } from '../table/table.model'
import {
  type ActiveTableCell,
  setActiveTableCell,
  readActiveTableCellFor
} from '../table/tableActiveCell'
import { setTableCellEditing } from '../table/tableCellEditing'
import { setTableChromeSelection, type TableChromeSelection } from '../table/tableChromeSelection'
import {
  dispatchTableModelFromBlock,
  findRootEditorViewFromTableBlock,
  focusTableCellSource,
  focusTableCellSourceAtPoint,
  isTableCellEditorFocused
} from '../table/tableDom'
import { copyTableRange, clearTableRange } from '../table/tableRangeClipboard'
import { pendingTableCellFocus } from '../table/tableEffects'
import type { DiaryCmPlatform } from '../types'
import {
  normalizeTableCellRange,
  readTableCellRangeSelectionFor,
  setTableCellRangeSelection,
  type TableCellRangeSelection
} from '../table/tableRangeSelection'
import { applyRangeHighlightToBlock } from '../table/tableRangeHighlight'
import {
  commitTableCellEditors,
  destroyTableBlockSync,
  focusNestedTableCellEditor,
  syncAllTableBlocks
} from '../table/tableWidgetSync'
import { logTableDesktop } from '../table/tableDesktopDebug'
import type { ColumnAlignment } from '../table/tableGridModel'
import { installDesktopTableInteraction } from './table-block-desktop-interaction'
import { createCell } from './table-block-cell-dom'
import {
  createAddBtn,
  createCorner,
  createColHandle,
  createRowHandle,
  syncActiveHandles
} from './table-block-chrome'
import type { TableBlockWidgetContext } from './table-block-widget-context'

const tableWidgetHeightCache = new Map<string, number>()

export class TableBlockWidget extends WidgetType {
  private rootEl: HTMLElement | null = null
  private readonly heightCacheKey: string
  private readonly alignSignature: string
  private readonly ctx: TableBlockWidgetContext
  private chromeLayoutObserver: ResizeObserver | null = null

  constructor(
    private readonly table: ParsedTable,
    private readonly activeCell: ActiveTableCell | null,
    private readonly platform?: DiaryCmPlatform,
    private readonly chromeSelection: TableChromeSelection | null = null,
    private readonly rangeSelection: TableCellRangeSelection | null = null,
    private readonly columnAlignments: ColumnAlignment[] = []
  ) {
    super()
    this.heightCacheKey = `${table.from}:${table.to}:${table.columnCount}:${table.bodyRows.length}`
    this.alignSignature = columnAlignments.join(',')
    this.ctx = {
      table: this.table,
      activeCell: this.activeCell,
      platform: this.platform,
      chromeSelection: this.chromeSelection,
      rangeSelection: this.rangeSelection,
      columnAlignments: this.columnAlignments,
      getRootEl: () => this.rootEl,
      editorView: () => this.editorView()
    }
  }

  eq(other: TableBlockWidget): boolean {
    if (this.table.from !== other.table.from) return false
    if (this.table.columnCount !== other.table.columnCount) return false
    if (this.table.bodyRows.length !== other.table.bodyRows.length) return false
    if (this.alignSignature !== other.alignSignature) return false
    return tableContentSignature(this.table) === tableContentSignature(other.table)
  }

  get estimatedHeight(): number {
    return tableWidgetHeightCache.get(this.heightCacheKey) ?? -1
  }

  toDOM(): HTMLElement {
    const root = document.createElement('div')
    this.rootEl = root
    const isTouch = this.platform?.interactionMode === 'touch'
    root.className = 'cm-table-block'
    if (this.activeCell) {
      root.classList.add('cm-table-block--has-active-cell')
    }
    if (isTouch) {
      root.classList.add('cm-table-block--touch')
      root.dataset.interactionMode = 'touch'
    } else {
      root.dataset.interactionMode = 'mouse'
    }
    root.dataset.tableFrom = String(this.table.from)
    root.dataset.tableTo = String(this.table.to)
    if (this.chromeSelection?.kind === 'col') {
      root.dataset.selectedCol = String(this.chromeSelection.index)
      root.classList.add('cm-table-block--col-selected')
    } else if (this.chromeSelection?.kind === 'row') {
      root.dataset.selectedRow = String(this.chromeSelection.index)
      root.classList.add('cm-table-block--row-selected')
    }
    if (this.rangeSelection) {
      root.classList.add('cm-table-block--range-selected')
    }

    const topBar = document.createElement('div')
    topBar.className = 'cm-table-chrome-top'
    topBar.appendChild(createCorner(this.ctx))
    const colHandles = document.createElement('div')
    colHandles.className = 'cm-table-col-handles'
    this.table.header.cells.forEach((_, colIndex) => {
      colHandles.appendChild(createColHandle(this.ctx, colIndex))
    })
    topBar.appendChild(colHandles)
    root.appendChild(topBar)

    const bodyWrap = document.createElement('div')
    bodyWrap.className = 'cm-table-chrome-body'

    const rowHandles = document.createElement('div')
    rowHandles.className = 'cm-table-row-handles'
    rowHandles.appendChild(
      createRowHandle(
        this.ctx,
        -1,
        i18n.t('auto.packages.ui.src.shared.diary.codemirror.widgets.TableBlockWidget.L153', '表头')
      )
    )
    this.table.bodyRows.forEach((_, rowIndex) => {
      rowHandles.appendChild(createRowHandle(this.ctx, rowIndex, `第 ${rowIndex + 1} 行`))
    })
    bodyWrap.appendChild(rowHandles)

    const tableEl = this.buildTableElement()
    const tableShell = document.createElement('div')
    tableShell.className = 'cm-table-grid-shell'
    tableShell.appendChild(tableEl)

    const scrollHost = document.createElement('div')
    scrollHost.className = 'cm-table-scroll-host'
    scrollHost.appendChild(tableShell)

    const tableColumn = document.createElement('div')
    tableColumn.className = 'cm-table-main-column'
    tableColumn.appendChild(scrollHost)
    tableColumn.appendChild(createAddBtn(this.ctx, 'row'))
    bodyWrap.appendChild(tableColumn)
    bodyWrap.appendChild(createAddBtn(this.ctx, 'col'))

    root.appendChild(bodyWrap)

    if (!isTouch) {
      installDesktopTableInteraction(root, this.table.from, () => this.editorView())
      if (this.rangeSelection) {
        applyRangeHighlightToBlock(root, normalizeTableCellRange(this.rangeSelection))
      }
    }

    syncActiveHandles(this.ctx)
    requestAnimationFrame(() => {
      this.syncChromeLayout()
      this.observeChromeLayout()
      this.cacheWidgetHeight(root)
      const view = this.editorView()
      if (view) syncAllTableBlocks(view)
    })

    return root
  }

  private buildTableElement(): HTMLTableElement {
    const tableEl = document.createElement('table')
    tableEl.className = 'cm-table-preview'
    const thead = document.createElement('thead')
    const headTr = document.createElement('tr')
    this.table.header.cells.forEach((cell, colIndex) => {
      headTr.appendChild(createCell(this.ctx, cell, -1, colIndex, true))
    })
    thead.appendChild(headTr)
    tableEl.appendChild(thead)

    const tbody = document.createElement('tbody')
    this.table.bodyRows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr')
      row.cells.forEach((cell, colIndex) => {
        tr.appendChild(createCell(this.ctx, cell, rowIndex, colIndex, false))
      })
      tbody.appendChild(tr)
    })
    tableEl.appendChild(tbody)
    return tableEl
  }

  private cacheWidgetHeight(root: HTMLElement): void {
    const height = root.getBoundingClientRect().height
    if (height > 0) {
      const prev = tableWidgetHeightCache.get(this.heightCacheKey)
      tableWidgetHeightCache.set(this.heightCacheKey, height)
      if (prev !== height) {
        logTableDesktop('widget:height', { key: this.heightCacheKey, prev, height })
        const view = this.editorView()
        view?.requestMeasure()
      }
    }
  }

  private observeChromeLayout(): void {
    const shell = this.rootEl?.querySelector('.cm-table-grid-shell')
    if (!shell || typeof ResizeObserver === 'undefined') return
    this.chromeLayoutObserver?.disconnect()
    this.chromeLayoutObserver = new ResizeObserver(() => {
      this.syncChromeLayout()
      if (this.rootEl) this.cacheWidgetHeight(this.rootEl)
    })
    this.chromeLayoutObserver.observe(shell)
  }

  private syncChromeLayout(): void {
    const root = this.rootEl
    if (!root) return

    const table = root.querySelector('.cm-table-preview')
    if (!table) return

    const rows = table.querySelectorAll('tr')
    const rowHandles = root.querySelectorAll('.cm-table-row-handle')
    rows.forEach((row, index) => {
      const handle = rowHandles[index] as HTMLElement | undefined
      if (!handle) return
      const height = (row as HTMLElement).getBoundingClientRect().height
      handle.style.height = `${height}px`
      handle.style.flex = '0 0 auto'
      handle.style.margin = '0'
    })

    const headerCells = table.querySelectorAll('thead th')
    const colHandles = root.querySelectorAll('.cm-table-col-handle')
    headerCells.forEach((cell, index) => {
      const handle = colHandles[index] as HTMLElement | undefined
      if (!handle) return
      const width = (cell as HTMLElement).getBoundingClientRect().width
      handle.style.width = `${width}px`
      handle.style.flex = '0 0 auto'
      handle.style.margin = '0'
    })
  }

  /**
   * 与 atomic-editor 一致：widget 内所有事件 CM 一律不处理，
   * 由 contenteditable / chrome 自行管理焦点与选区。
   */
  ignoreEvent(event: Event): boolean {
    if (!this.rootEl) return false
    const target = event.target
    if (!(target instanceof Node)) return false
    const inside = this.rootEl.contains(target)
    if (
      inside &&
      (event.type === 'pointerdown' || event.type === 'mousedown' || event.type === 'click')
    ) {
      const el = target instanceof Element ? target : target.parentElement
      logTableDesktop('widget:event', {
        type: event.type,
        className: el?.className?.toString().slice(0, 60) ?? '',
        activeElement:
          document.activeElement instanceof HTMLElement
            ? document.activeElement.className.slice(0, 40)
            : null
      })
    }
    return inside
  }

  private focusGridCell(gridCell: HTMLElement, clientX?: number, clientY?: number): void {
    const rowIndex = Number(gridCell.dataset.row)
    const colIndex = Number(gridCell.dataset.col)
    if (Number.isNaN(rowIndex) || Number.isNaN(colIndex)) return
    this.syncActiveCell(rowIndex, colIndex, { clientX, clientY })
  }

  private syncActiveCell(
    rowIndex: number,
    colIndex: number,
    opts?: { clientX?: number; clientY?: number }
  ): void {
    const root = this.rootEl
    if (!root) return

    const view = this.editorView()
    const active = view ? readActiveTableCellFor(view.state, this.table.from) : null
    const sameCell = active?.rowIndex === rowIndex && active?.colIndex === colIndex

    if (view && !sameCell && isTableCellEditorFocused()) {
      commitTableCellEditors(root, view)
    }

    if (view && sameCell) {
      const range = readTableCellRangeSelectionFor(view.state, this.table.from)
      if (range) {
        view.dispatch({ effects: setTableCellRangeSelection.of(null) })
        applyRangeHighlightToBlock(root, null)
      }
      if (opts?.clientX != null && opts?.clientY != null) {
        focusNestedTableCellEditor(root, rowIndex, colIndex, {
          clientX: opts.clientX,
          clientY: opts.clientY
        })
      }
      return
    }

    if (view) {
      const effects: StateEffect<unknown>[] = [
        setActiveTableCell.of({
          tableFrom: this.table.from,
          rowIndex,
          colIndex
        }),
        setTableCellEditing.of({
          tableFrom: this.table.from,
          rowIndex,
          colIndex
        }),
        pendingTableCellFocus.of({
          tableFrom: this.table.from,
          rowIndex,
          colIndex,
          clientX: opts?.clientX,
          clientY: opts?.clientY
        }),
        setTableCellRangeSelection.of(null)
      ]
      if (rowIndex >= 0) {
        effects.push(
          setTableChromeSelection.of({ tableFrom: this.table.from, kind: 'row', index: rowIndex })
        )
      } else {
        effects.push(
          setTableChromeSelection.of({ tableFrom: this.table.from, kind: 'col', index: colIndex })
        )
      }
      view.dispatch({ effects })
      return
    }

    if (opts?.clientX != null && opts.clientY != null) {
      focusTableCellSourceAtPoint(root, rowIndex, colIndex, opts.clientX, opts.clientY)
    } else {
      focusTableCellSource(root, rowIndex, colIndex, false)
    }
  }

  destroy(): void {
    if (this.rootEl) destroyTableBlockSync(this.rootEl)
    this.chromeLayoutObserver?.disconnect()
    this.rootEl = null
  }

  private copyRangeSelection(): void {
    const root = this.rootEl
    if (!root || !this.rangeSelection) return
    copyTableRange(root, normalizeTableCellRange(this.rangeSelection))
  }

  private clearRangeSelection(view: EditorView): void {
    const root = this.rootEl
    if (!root || !this.rangeSelection) return
    clearTableRange(root, normalizeTableCellRange(this.rangeSelection))
    dispatchTableModelFromBlock(view, root)
    view.dispatch({ effects: setTableCellRangeSelection.of(null) })
  }

  private editorView(): EditorView | null {
    return this.rootEl ? findRootEditorViewFromTableBlock(this.rootEl) : null
  }
}
