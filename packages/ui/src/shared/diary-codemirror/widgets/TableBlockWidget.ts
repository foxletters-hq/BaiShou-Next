import { WidgetType, EditorView } from '@codemirror/view'
import { type ParsedTable, tableContentSignature } from '../table/table.model'
import { normalizeTableCellDisplay } from '../table/tableCellText'
import { resolveTableKeyAction, type TableKeyCommand } from '../table/tableKeyResolver'
import type { ActiveTableCell } from '../table/tableActiveCell'
import { setActiveTableCell } from '../table/tableActiveCell'
import { setTableCellEditing } from '../table/tableCellEditing'
import { setTableChromeSelection } from '../table/tableChromeSelection'
import {
  blurTableCellEditor,
  copyTableMarkdownFromBlock,
  dispatchTableModelFromBlock,
  findCurrentTableRange,
  findRootEditorViewFromTableBlock,
  focusTableCellSource,
  focusTableCellSourceAtPoint,
  isTableCellEditorFocused,
  readCellSourceRaw
} from '../table/tableDom'
import { invokeTableAction, pendingTableCellFocus } from '../table/tableEffects'
import type { DiaryCmPlatform } from '../types'
import { findTableToByFrom } from '../table/tableBounds'
import { placeCursorAfterTable } from '../table/tableFocus'
import {
  buildColMenuItems,
  buildColMenuSections,
  buildRowMenuItems,
  buildRowMenuSections,
  openTableCellContextMenu,
  runCellContextMenuAction,
  showTableBottomSheet,
  showTableContextMenu,
  type TableMenuItem
} from '../table/tableContextMenu'
import type { TableChromeSelection } from '../table/tableChromeSelection'
import {
  isCellInTableRange,
  normalizeTableCellRange,
  setTableCellRangeSelection,
  type TableCellRangeSelection
} from '../table/tableRangeSelection'
import {
  copyTableRange,
  clearTableRange,
  pasteTableRange,
  readClipboardTextForTablePaste
} from '../table/tableRangeClipboard'
import {
  applyRangeHighlightToBlock,
  setTableRangeDragging
} from '../table/tableRangeHighlight'
import { TableOutlineSession } from '../table/tableOutlineSession'
import { TableSection, type CellLocation } from '../table/tableSection'
import { isTableTypeToEditKey } from '../table/tableInputKeys'
import {
  matchTableNavigateKey,
  runTableNavigateAction,
  sectionFromRangeSelection
} from '../table/tableNavigateActions'
import { parseTableFromDoc } from '../table/table.model'
import {
  commitTableCellEditors,
  destroyTableBlockSync,
  focusNestedTableCellEditor,
  getTableCellEditorHost,
  isNestedCellEditorActive,
  syncAllTableBlocks
} from '../table/tableWidgetSync'
import { readTableCellRangeSelectionFor } from '../table/tableRangeSelection'
import { readActiveTableCellFor } from '../table/tableActiveCell'
import { createTableGripIcon, createTableGridIcon } from './tableChromeIcons'
import { logTableDesktop } from '../table/tableDesktopDebug'

const TABLE_CHROME_INTERACTIVE_SELECTOR =
  '.cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn, .cm-table-context-menu-layer, .cm-table-context-menu'

const tableWidgetHeightCache = new Map<string, number>()

type MenuItem = TableMenuItem

export class TableBlockWidget extends WidgetType {
  private rootEl: HTMLElement | null = null
  private readonly heightCacheKey: string

  constructor(
    private readonly table: ParsedTable,
    private readonly activeCell: ActiveTableCell | null,
    private readonly platform?: DiaryCmPlatform,
    private readonly chromeSelection: TableChromeSelection | null = null,
    private readonly rangeSelection: TableCellRangeSelection | null = null
  ) {
    super()
    this.heightCacheKey = `${table.from}:${table.to}:${table.columnCount}:${table.bodyRows.length}`
  }

  eq(other: TableBlockWidget): boolean {
    if (this.table.from !== other.table.from) return false
    if (this.table.columnCount !== other.table.columnCount) return false
    if (this.table.bodyRows.length !== other.table.bodyRows.length) return false
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
    topBar.appendChild(this.createCorner())
    const colHandles = document.createElement('div')
    colHandles.className = 'cm-table-col-handles'
    this.table.header.cells.forEach((_, colIndex) => {
      colHandles.appendChild(this.createColHandle(colIndex))
    })
    topBar.appendChild(colHandles)
    root.appendChild(topBar)

    const bodyWrap = document.createElement('div')
    bodyWrap.className = 'cm-table-chrome-body'

    const rowHandles = document.createElement('div')
    rowHandles.className = 'cm-table-row-handles'
    rowHandles.appendChild(this.createRowHandle(-1, '表头'))
    this.table.bodyRows.forEach((_, rowIndex) => {
      rowHandles.appendChild(this.createRowHandle(rowIndex, `第 ${rowIndex + 1} 行`))
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
    tableColumn.appendChild(this.createAddBtn('row'))
    bodyWrap.appendChild(tableColumn)
    bodyWrap.appendChild(this.createAddBtn('col'))

    root.appendChild(bodyWrap)

    if (!isTouch) {
      this.installDesktopTableInteraction(root)
      if (this.rangeSelection) {
        applyRangeHighlightToBlock(root, normalizeTableCellRange(this.rangeSelection))
      }
    }

    this.syncActiveHandles()
    requestAnimationFrame(() => {
      this.syncChromeLayout()
      this.observeChromeLayout()
      this.cacheWidgetHeight(root)
      const view = this.editorView()
      if (view) syncAllTableBlocks(view)
    })

    return root
  }

  private createAddBtn(kind: 'row' | 'col'): HTMLElement {
    const isTouch = this.platform?.interactionMode === 'touch'
    const btn = this.createChromeTrigger(isTouch ? 'div' : 'button')
    btn.className = `cm-table-add-btn cm-table-add-${kind}`
    btn.setAttribute('aria-label', kind === 'row' ? '添加行' : '添加列')
    const icon = document.createElement('span')
    icon.className = 'cm-table-add-btn-icon'
    icon.textContent = '+'
    btn.appendChild(icon)

    const run = () => {
      this.runAction({
        type: kind === 'row' ? 'addRow' : 'addColumn',
        tableFrom: this.table.from,
        tableTo: this.table.to
      })
    }

    if (!isTouch) {
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        run()
      })
    }
    return btn
  }

  private buildTableElement(): HTMLTableElement {
    const tableEl = document.createElement('table')
    tableEl.className = 'cm-table-preview'
    const thead = document.createElement('thead')
    const headTr = document.createElement('tr')
    this.table.header.cells.forEach((cell, colIndex) => {
      headTr.appendChild(this.createCell(cell, -1, colIndex, true))
    })
    thead.appendChild(headTr)
    tableEl.appendChild(thead)

    const tbody = document.createElement('tbody')
    this.table.bodyRows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr')
      row.cells.forEach((cell, colIndex) => {
        tr.appendChild(this.createCell(cell, rowIndex, colIndex, false))
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

  private chromeLayoutObserver: ResizeObserver | null = null

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

  private focusGridCell(
    gridCell: HTMLElement,
    clientX?: number,
    clientY?: number
  ): void {
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
      const effects = [
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

  private commitRangeSelection(
    anchorRow: number,
    anchorCol: number,
    headRow: number,
    headCol: number
  ): void {
    const view = this.editorView()
    if (!view) return
    const tableFrom = this.table.from
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

  destroy(): void {
    if (this.rootEl) destroyTableBlockSync(this.rootEl)
    this.chromeLayoutObserver?.disconnect()
    this.rootEl = null
  }

  private installDesktopTableInteraction(root: HTMLElement): void {
    root.tabIndex = -1
    const tableFrom = this.table.from
    const tableEl = root.querySelector('.cm-table-preview') as HTMLTableElement | null
    const scrollHost = root.querySelector('.cm-table-scroll-host') as HTMLElement | null

    let liveSection: TableSection | null = null

    const resolveBlock = (): HTMLElement | null => {
      const view = this.editorView()
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

    const getRangeSelection = () => {
      const view = this.editorView()
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
      const view = this.editorView()
      const scrollX = (scrollHost?.scrollLeft ?? 0) + (view?.scrollDOM.scrollLeft ?? 0)
      const scrollY = (scrollHost?.scrollTop ?? 0) + (view?.scrollDOM.scrollTop ?? 0)
      return { x: scrollX, y: scrollY }
    }

    const getCellFromPoint = (x: number, y: number) => {
      const block = resolveBlock()
      if (!block) return null
      const cell = document.elementFromPoint(x, y)?.closest('.cm-table-grid-cell') as HTMLElement | null
      if (!cell || !block.contains(cell)) return null
      const row = Number(cell.dataset.row)
      const col = Number(cell.dataset.col)
      if (Number.isNaN(row) || Number.isNaN(col)) return null
      return { cell, row, col }
    }

    const isInCellEditor = (target: EventTarget | null): boolean => {
      return target instanceof Element && Boolean(target.closest('.cm-table-cell-editor'))
    }

    const outlineCallbacks = (hit: { row: number; col: number }, event: PointerEvent) => ({
      onOutlineStart: (_anchor: CellLocation) => {
        liveSection = TableSection.ofCell({ row: hit.row, col: hit.col })
      },
      onBeforeOutlineDrag: () => {
        window.getSelection()?.removeAllRanges()
        blurTableCellEditor()
        const block = resolveBlock()
        if (block) setTableRangeDragging(block, true)
        const view = this.editorView()
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
        this.commitRangeSelection(anchor.row, anchor.col, head.row, head.col)
        logTableDesktop('range:select', { anchor, head, dragged, single: section.isSingleCell() })
      },
      getScrollOffset,
      getScrollElements: () => ({
        x: scrollHost ?? root,
        y: this.editorView()?.scrollDOM ?? root
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

      const view = this.editorView()
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
      const view = this.editorView()
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
      const view = this.editorView()
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
      const view = this.editorView()
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

  private createCorner(): HTMLElement {
    const isTouch = this.platform?.interactionMode === 'touch'
    const btn = this.createChromeTrigger(isTouch ? 'div' : 'button')
    btn.className = 'cm-table-chrome-corner cm-table-corner-menu'
    if (this.platform?.interactionMode === 'touch') {
      btn.classList.add('cm-table-handle--touch')
    }
    btn.setAttribute('aria-label', '表格菜单')
    btn.appendChild(createTableGridIcon(3, 3))
    this.bindTableMenu(btn)
    return btn
  }

  private createCell(
    raw: string,
    rowIndex: number,
    colIndex: number,
    isHeader: boolean
  ): HTMLElement {
    const el = document.createElement(isHeader ? 'th' : 'td')
    el.className = 'cm-table-grid-cell'
    el.dataset.row = String(rowIndex)
    el.dataset.col = String(colIndex)
    if (this.chromeSelection?.kind === 'col' && this.chromeSelection.index === colIndex) {
      el.classList.add('cm-table-grid-cell--col-selected')
    }
    if (this.chromeSelection?.kind === 'row' && this.chromeSelection.index === rowIndex) {
      el.classList.add('cm-table-grid-cell--row-selected')
    }
    if (this.rangeSelection) {
      const bounds = normalizeTableCellRange(this.rangeSelection)
      if (isCellInTableRange(rowIndex, colIndex, bounds)) {
        el.classList.add('cm-table-grid-cell--range-selected')
      }
    }

    el.appendChild(
      this.platform?.interactionMode === 'touch'
        ? this.createEditableCell(raw, rowIndex, colIndex)
        : this.createCellContent(raw, rowIndex, colIndex)
    )

    const onCellContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const view = this.editorView()
      if (!view) return
      this.commitFocusedCell()
      if (this.rangeSelection) {
        this.openRangeContextMenu(view, event.clientX, event.clientY)
        return
      }
      logTableDesktop('cell:contextmenu', { rowIndex, colIndex })
      openTableCellContextMenu(view, this.table, rowIndex, colIndex, event.clientX, event.clientY)
    }
    el.addEventListener('contextmenu', onCellContextMenu, true)

    return el
  }

  private createCellContent(raw: string, rowIndex: number, colIndex: number): HTMLElement {
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
  private createEditableCell(raw: string, rowIndex: number, colIndex: number): HTMLElement {
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
      if (!this.rootEl) return
      const view = this.editorView()
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
        dispatchTableModelFromBlock(view, this.rootEl)
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
      this.syncActiveHandles(rowIndex, colIndex)
      const view = this.editorView()
      if (!view) return
      const effects = [
        setActiveTableCell.of({
          tableFrom: this.table.from,
          rowIndex,
          colIndex
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
    })
    source.addEventListener('blur', () => {
      if (committing) return
      flushCommit('blur')
      const root = this.rootEl
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
        const view = this.editorView()
        view?.dispatch({ effects: setActiveTableCell.of(null) })
      })
    })
    source.addEventListener('keydown', (event) => {
      const command = mapTableKeyCommand(event)
      if (!command) return
      const action = resolveTableKeyAction(this.table, rowIndex, colIndex, command)
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      this.handleCellKeyAction(action, rowIndex, colIndex)
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

  private handleCellKeyAction(
    action: ReturnType<typeof resolveTableKeyAction>,
    rowIndex: number,
    colIndex: number
  ): void {
    if (!action || !this.rootEl) return
    const view = this.editorView()
    if (!view) return

    switch (action.kind) {
      case 'insert-inline-break': {
        const host = this.rootEl ? getTableCellEditorHost(this.rootEl) : undefined
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
        this.commitFocusedCell()
        return
      }
      case 'focus-cell': {
        this.commitFocusedCell()
        focusTableCellSource(this.rootEl, action.rowIndex, action.colIndex)
        view.dispatch({
          effects: [
            setActiveTableCell.of({
              tableFrom: this.table.from,
              rowIndex: action.rowIndex,
              colIndex: action.colIndex
            }),
            pendingTableCellFocus.of({
              tableFrom: this.table.from,
              rowIndex: action.rowIndex,
              colIndex: action.colIndex
            })
          ]
        })
        return
      }
      case 'insert-row-below': {
        this.commitFocusedCell()
        const newRowIndex = action.afterRowIndex + 1
        this.runAction({
          type: 'addRow',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          atIndex: newRowIndex,
          focusAfter: { rowIndex: newRowIndex, colIndex: 0 }
        })
        return
      }
      case 'exit-after': {
        this.commitFocusedCell()
        blurTableCellEditor()
        view.dispatch({ effects: setActiveTableCell.of(null) })
        const tableTo = findTableToByFrom(view.state, this.table.from) ?? this.table.to
        placeCursorAfterTable(view, tableTo)
        return
      }
    }
  }

  private commitFocusedCell(): void {
    if (!this.rootEl) return
    const view = this.editorView()
    if (!view) return
    commitTableCellEditors(this.rootEl, view)
  }

  private syncActiveHandles(rowIndex?: number, colIndex?: number): void {
    const root = this.rootEl
    if (!root) return
    const activeRow =
      this.chromeSelection?.kind === 'row'
        ? this.chromeSelection.index
        : (rowIndex ?? this.activeCell?.rowIndex)
    const activeCol =
      this.chromeSelection?.kind === 'col'
        ? this.chromeSelection.index
        : (colIndex ?? this.activeCell?.colIndex)
    if (activeRow == null && activeCol == null) return

    root.classList.add('cm-table-block--has-active-cell')
    root.querySelectorAll('.cm-table-col-handle').forEach((handle) => {
      const handleCol = Number((handle as HTMLElement).dataset.colIndex)
      handle.classList.toggle(
        'cm-table-handle--active',
        activeCol != null && handleCol === activeCol
      )
    })
    root.querySelectorAll('.cm-table-row-handle').forEach((handle) => {
      const handleRow = Number((handle as HTMLElement).dataset.rowIndex)
      handle.classList.toggle(
        'cm-table-handle--active',
        activeRow != null && handleRow === activeRow
      )
    })
  }

  private bindTableMenu(btn: HTMLElement): void {
    const open = () => {
      const rect = btn.getBoundingClientRect()
      this.showMenu(
        [
          { id: 'copy-table', label: '复制表格' },
          { id: 'delete-table', label: '删除表格', destructive: true }
        ],
        rect.left,
        rect.bottom + 4,
        (id) => {
          if (id === 'copy-table') {
            void this.copyTableMarkdown()
            return
          }
          if (id !== 'delete-table') return
          this.runAction({
            type: 'deleteTable',
            tableFrom: this.table.from,
            tableTo: this.table.to
          })
        }
      )
    }

    this.bindMenuTrigger(btn, open)
  }

  private async copyTableMarkdown(): Promise<void> {
    this.commitFocusedCell()
    const view = this.editorView()
    const root = this.rootEl
    if (!view || !root) return
    await copyTableMarkdownFromBlock(view, root)
  }

  /**
   * 鼠标端触发（click / contextmenu）。触摸端一律走 installTouchDelegation。
   */
  private bindMenuTrigger(btn: HTMLElement, open: (e?: Event) => void): void {
    if (this.platform?.interactionMode === 'touch') return
    const runOpen = (e?: Event) => {
      this.commitFocusedCell()
      open(e)
    }
    btn.addEventListener('click', (e) => runOpen(e))
    btn.addEventListener('contextmenu', (e) => runOpen(e))
  }

  private bindHandleMenuClick(
    btn: HTMLElement,
    openMenu: (clientX: number, clientY: number) => void
  ): void {
    let dragged = false
    btn.addEventListener('dragstart', () => {
      dragged = true
    })
    btn.addEventListener('dragend', () => {
      requestAnimationFrame(() => {
        dragged = false
      })
    })

    const openFromButton = (e?: Event) => {
      if (dragged) return
      e?.preventDefault()
      e?.stopPropagation()
      const rect = btn.getBoundingClientRect()
      openMenu(rect.left, rect.bottom + 4)
    }

    this.bindMenuTrigger(btn, openFromButton)
  }

  private createChromeTrigger(tagName: 'button' | 'div'): HTMLElement {
    if (tagName === 'button') {
      const btn = document.createElement('button')
      btn.type = 'button'
      return btn
    }
    const el = document.createElement('div')
    el.setAttribute('role', 'button')
    el.tabIndex = -1
    return el
  }

  private createColHandle(colIndex: number): HTMLElement {
    const isTouch = this.platform?.interactionMode === 'touch'
    const btn = this.createChromeTrigger(isTouch ? 'div' : 'button')
    btn.className = 'cm-table-handle cm-table-col-handle'
    if (this.platform?.interactionMode === 'touch') {
      btn.classList.add('cm-table-handle--touch')
    }
    btn.setAttribute('aria-label', `列 ${colIndex + 1}`)
    btn.appendChild(createTableGripIcon())
    btn.dataset.colIndex = String(colIndex)

    this.bindHandleMenu(
      btn,
      () => this.colMenuItems(colIndex),
      (from, to) => {
        this.runAction({
          type: 'moveColumn',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          fromIndex: from,
          toIndex: to
        })
      }
    )
    return btn
  }

  private createRowHandle(rowIndex: number, label: string): HTMLElement {
    const isTouch = this.platform?.interactionMode === 'touch'
    const btn = this.createChromeTrigger(isTouch ? 'div' : 'button')
    btn.className = 'cm-table-handle cm-table-row-handle'
    if (this.platform?.interactionMode === 'touch') {
      btn.classList.add('cm-table-handle--touch')
    }
    btn.setAttribute('aria-label', label)
    btn.appendChild(createTableGripIcon())
    btn.dataset.rowIndex = String(rowIndex)

    if (rowIndex < 0) {
      btn.classList.add('cm-table-row-handle--header')
    }

    this.bindHandleMenu(
      btn,
      () => this.rowMenuItems(rowIndex),
      (from, to) => {
        this.runAction({
          type: 'moveRow',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          fromIndex: from,
          toIndex: to
        })
      }
    )
    return btn
  }

  private bindHandleMenu(
    btn: HTMLElement,
    items: () => MenuItem[],
    onReorder?: (fromIndex: number, toIndex: number) => void
  ): void {
    const kind = btn.classList.contains('cm-table-col-handle') ? 'col' : 'row'
    const index = Number(btn.dataset.colIndex ?? btn.dataset.rowIndex)
    const handleSelector = kind === 'col' ? '.cm-table-col-handle' : '.cm-table-row-handle'
    const dataKey = kind === 'col' ? 'colIndex' : 'rowIndex'

    const openMenu = (clientX: number, clientY: number) => {
      const colIndex = Number(btn.dataset.colIndex)
      const rowIndex = Number(btn.dataset.rowIndex)
      const isCol = kind === 'col'
      const index = isCol ? colIndex : rowIndex
      const sections = isCol
        ? buildColMenuSections(this.table, colIndex)
        : buildRowMenuSections(this.table, rowIndex)
      const title = isCol
        ? `第 ${colIndex + 1} 列`
        : rowIndex < 0
          ? '表头'
          : `第 ${rowIndex + 1} 行`
      this.showMenu(
        sections.flatMap((s) => s.items),
        clientX,
        clientY,
        (id) => this.runMenuAction(btn, id),
        { title, sections }
      )
    }

    this.bindHandleMenuClick(btn, openMenu)

    if (!onReorder || Number.isNaN(index) || index < 0) {
      return
    }

    if (this.platform?.interactionMode === 'touch') {
      btn.draggable = false
      return
    }

    btn.draggable = true
    btn.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', `${kind}:${index}`)
      e.dataTransfer!.effectAllowed = 'move'
      btn.classList.add('cm-table-handle--dragging')
    })
    btn.addEventListener('dragend', () => {
      btn.classList.remove('cm-table-handle--dragging')
      this.clearDropHighlight(handleSelector)
    })
    btn.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.dataTransfer!.dropEffect = 'move'
      this.highlightDropTarget(e.target as HTMLElement, handleSelector)
    })
    btn.addEventListener('dragleave', () => {
      btn.classList.remove('cm-table-handle--drop-target')
    })
    btn.addEventListener('drop', (e) => {
      e.preventDefault()
      btn.classList.remove('cm-table-handle--dragging', 'cm-table-handle--drop-target')
      this.clearDropHighlight(handleSelector)
      const raw = e.dataTransfer?.getData('text/plain') ?? ''
      const fromIndex = Number(raw.split(':')[1])
      const target = (e.target as HTMLElement).closest(handleSelector) as HTMLElement | null
      const toIndex = Number(target?.dataset[dataKey])
      if (Number.isNaN(fromIndex) || Number.isNaN(toIndex) || fromIndex === toIndex) return
      onReorder(fromIndex, toIndex)
    })
  }

  private highlightDropTarget(target: HTMLElement | null, selector: string): void {
    this.clearDropHighlight(selector)
    const handle = target?.closest(selector) as HTMLElement | null
    handle?.classList.add('cm-table-handle--drop-target')
  }

  private clearDropHighlight(selector: string): void {
    this.rootEl?.querySelectorAll(selector).forEach((el) => {
      el.classList.remove('cm-table-handle--drop-target')
    })
  }

  private colMenuItems(colIndex: number): MenuItem[] {
    return buildColMenuItems(this.table, colIndex)
  }

  private rowMenuItems(rowIndex: number): MenuItem[] {
    return buildRowMenuItems(this.table, rowIndex)
  }

  private runAction(action: Parameters<typeof invokeTableAction>[1]): void {
    const view = this.editorView()
    const root = this.rootEl
    if (!view || !root) return
    const range = findCurrentTableRange(view, root)
    if (!range) return
    invokeTableAction(view, { ...action, tableFrom: range.from, tableTo: range.to })
  }

  private openRangeContextMenu(view: EditorView, clientX: number, clientY: number): void {
    if (!this.rangeSelection || !this.rootEl) return
    const bounds = normalizeTableCellRange(this.rangeSelection)
    const sections = [
      {
        items: [
          { id: 'cut-range', label: '剪切' },
          { id: 'copy-range', label: '复制' },
          { id: 'paste-range', label: '粘贴' }
        ]
      },
      {
        items: [
          { id: 'clear-range', label: '清空选中的单元格' },
          { id: 'delete-range', label: '删除选中的单元格', destructive: true }
        ]
      }
    ]
    const items = sections.flatMap((s) => s.items)
    this.showMenu(items, clientX, clientY, (id) => {
      const root = this.rootEl
      if (!root) return
      if (id === 'copy-range') {
        copyTableRange(root, bounds)
        return
      }
      if (id === 'cut-range') {
        copyTableRange(root, bounds)
        clearTableRange(root, bounds)
        dispatchTableModelFromBlock(view, root)
        return
      }
      if (id === 'paste-range') {
        void readClipboardTextForTablePaste().then((text) => {
          if (!text || !this.rootEl) return
          pasteTableRange(this.rootEl, bounds, text)
          dispatchTableModelFromBlock(view, this.rootEl)
        })
        return
      }
      if (id === 'clear-range' || id === 'delete-range') {
        clearTableRange(root, bounds)
        dispatchTableModelFromBlock(view, root)
        view.dispatch({ effects: setTableCellRangeSelection.of(null) })
      }
    })
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

  private runMenuAction(handle: HTMLElement, actionId: string): void {
    if (actionId === 'noop') return
    this.commitFocusedCell()

    const view = this.editorView()
    const root = this.rootEl
    if (!view || !root) return
    const range = findCurrentTableRange(view, root)
    if (!range) return

    const colIndex = Number(handle.dataset.colIndex)
    const rowIndex = Number(handle.dataset.rowIndex)

    if (handle.classList.contains('cm-table-col-handle')) {
      runCellContextMenuAction(view, range.from, range.to, -1, colIndex, actionId)
      return
    }
    if (handle.classList.contains('cm-table-row-handle')) {
      runCellContextMenuAction(view, range.from, range.to, rowIndex, 0, actionId)
    }
  }

  private showMenu(
    items: MenuItem[],
    clientX: number,
    clientY: number,
    onPick: (id: string) => void,
    options?: { title?: string; sections?: { items: MenuItem[] }[] }
  ): void {
    if (this.platform?.interactionMode === 'touch') {
      const sections = options?.sections ?? [{ items }]
      showTableBottomSheet(options?.title ?? '表格', sections, onPick)
      return
    }
    showTableContextMenu(items, clientX, clientY, onPick)
  }

  private editorView(): EditorView | null {
    return this.rootEl ? findRootEditorViewFromTableBlock(this.rootEl) : null
  }
}

function mapTableKeyCommand(event: KeyboardEvent): TableKeyCommand | null {
  if (event.key === 'Tab' && event.shiftKey) return 'shift-tab'
  if (event.key === 'Tab') return 'tab'
  if (event.key === 'Enter' && event.shiftKey) return 'shift-enter'
  if (event.key === 'Enter') return 'enter'
  if (event.key === 'Escape') return 'escape'
  return null
}
