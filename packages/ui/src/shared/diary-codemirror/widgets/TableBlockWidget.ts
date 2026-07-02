import { WidgetType, EditorView } from '@codemirror/view'
import { type ParsedTable, tableContentSignature } from '../table/table.model'
import { normalizeTableCellDisplay } from '../table/tableCellText'
import { resolveTableKeyAction, type TableKeyCommand } from '../table/tableKeyResolver'
import type { ActiveTableCell } from '../table/tableActiveCell'
import { setActiveTableCell } from '../table/tableActiveCell'
import {
  blurTableCellEditor,
  dispatchTableModelFromBlock,
  focusTableCellSource,
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
  showTableBottomSheet,
  showTableContextMenu,
  type TableMenuItem
} from '../table/tableContextMenu'
import type { TableChromeSelection } from '../table/tableChromeSelection'
import { createTableGripIcon, createTableGridIcon } from './tableChromeIcons'

const tableWidgetHeightCache = new Map<string, number>()

function eventInteractionTarget(event: Event): Element | null {
  const target = event.target
  if (target instanceof Element) return target
  if (target instanceof Node) return target.parentElement
  return null
}

type MenuItem = TableMenuItem

export class TableBlockWidget extends WidgetType {
  private rootEl: HTMLElement | null = null
  private readonly heightCacheKey: string

  constructor(
    private readonly table: ParsedTable,
    private readonly activeCell: ActiveTableCell | null,
    private readonly platform?: DiaryCmPlatform,
    private readonly chromeSelection: TableChromeSelection | null = null
  ) {
    super()
    this.heightCacheKey = `${table.from}:${table.to}:${table.columnCount}:${table.bodyRows.length}`
  }

  eq(other: TableBlockWidget): boolean {
    return (
      this.table.from === other.table.from &&
      this.table.columnCount === other.table.columnCount &&
      this.table.bodyRows.length === other.table.bodyRows.length &&
      tableContentSignature(this.table) === tableContentSignature(other.table) &&
      this.activeCell?.rowIndex === other.activeCell?.rowIndex &&
      this.activeCell?.colIndex === other.activeCell?.colIndex &&
      this.chromeSelection?.kind === other.chromeSelection?.kind &&
      this.chromeSelection?.index === other.chromeSelection?.index
    )
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

    this.syncActiveHandles()
    requestAnimationFrame(() => {
      this.syncChromeLayout()
      this.observeChromeLayout()
      this.cacheWidgetHeight(root)
      if (this.activeCell && this.rootEl) {
        requestAnimationFrame(() => {
          if (!this.rootEl || !this.activeCell) return
          focusTableCellSource(
            this.rootEl,
            this.activeCell.rowIndex,
            this.activeCell.colIndex
          )
        })
      }
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
      tableWidgetHeightCache.set(this.heightCacheKey, height)
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

  ignoreEvent(event: Event): boolean {
    if (!this.rootEl) return false
    const target = event.target
    if (!(target instanceof Node)) return false
    if (!this.rootEl.contains(target)) return false
    const interactive = eventInteractionTarget(event)
    if (!interactive) return true

    // CM #1639：widget 内 selectionchange 若返回 true 会导致选区乱跳
    if (event.type === 'selectionchange') return false

    if (
      interactive.closest(
        'button, [role="button"], .cm-table-cell-source, .cm-table-handle, .cm-table-corner-menu, .cm-table-add-btn, .cm-table-context-menu, .cm-table-context-menu-layer'
      )
    ) {
      return false
    }
    if (event.type === 'click' || event.type === 'touchend' || event.type === 'touchstart') {
      return false
    }
    return true
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

  private createCell(raw: string, rowIndex: number, colIndex: number, isHeader: boolean): HTMLElement {
    const el = document.createElement(isHeader ? 'th' : 'td')
    el.className = 'cm-table-grid-cell'
    el.dataset.row = String(rowIndex)
    el.dataset.col = String(colIndex)
    if (
      this.chromeSelection?.kind === 'col' &&
      this.chromeSelection.index === colIndex
    ) {
      el.classList.add('cm-table-grid-cell--col-selected')
    }
    if (
      this.chromeSelection?.kind === 'row' &&
      this.chromeSelection.index === rowIndex
    ) {
      el.classList.add('cm-table-grid-cell--row-selected')
    }

    el.appendChild(this.createEditableCell(raw, rowIndex, colIndex))
    return el
  }

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
    const commit = () => {
      if (!this.rootEl) return
      const view = this.editorView()
      if (!view) return
      source.dataset.raw = readCellSourceRaw(source)
      dispatchTableModelFromBlock(view, this.rootEl)
    }

    source.addEventListener('compositionstart', () => {
      composing = true
    })
    source.addEventListener('compositionend', () => {
      composing = false
      commit()
    })
    source.addEventListener('input', (event) => {
      if (composing || (event as InputEvent).isComposing) return
      commit()
    })
    source.addEventListener('focus', () => {
      this.syncActiveHandles(rowIndex, colIndex)
      const view = this.editorView()
      if (!view) return
      view.dispatch({
        effects: setActiveTableCell.of({
          tableFrom: this.table.from,
          rowIndex,
          colIndex
        })
      })
    })
    source.addEventListener('blur', () => {
      source.dataset.raw = readCellSourceRaw(source)
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
      commit()
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
        const selection = document.getSelection()
        if (!selection || selection.rangeCount === 0) return
        const range = selection.getRangeAt(0)
        range.deleteContents()
        range.insertNode(document.createTextNode(action.insertText))
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
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
        this.runAction({ type: 'addRow', tableFrom: this.table.from, tableTo: this.table.to })
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
    dispatchTableModelFromBlock(view, this.rootEl)
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
        [{ id: 'delete-table', label: '删除表格', destructive: true }],
        rect.left,
        rect.bottom + 4,
        (id) => {
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

    this.bindHandleMenu(btn, () => this.colMenuItems(colIndex), (from, to) => {
      this.runAction({
        type: 'moveColumn',
        tableFrom: this.table.from,
        tableTo: this.table.to,
        fromIndex: from,
        toIndex: to
      })
    })
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

    this.bindHandleMenu(btn, () => this.rowMenuItems(rowIndex), (from, to) => {
      this.runAction({
        type: 'moveRow',
        tableFrom: this.table.from,
        tableTo: this.table.to,
        fromIndex: from,
        toIndex: to
      })
    })
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
      const title = isCol ? `第 ${colIndex + 1} 列` : rowIndex < 0 ? '表头' : `第 ${rowIndex + 1} 行`
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
    if (!view) return
    invokeTableAction(view, action)
  }

  private runMenuAction(handle: HTMLElement, actionId: string): void {
    if (actionId === 'noop') return

    const colIndex = Number(handle.dataset.colIndex)
    const rowIndex = Number(handle.dataset.rowIndex)

    if (!Number.isNaN(colIndex)) {
      if (actionId === 'delete') {
        this.runAction({
          type: 'deleteColumn',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          colIndex
        })
      } else if (actionId === 'left') {
        this.runAction({
          type: 'moveColumn',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          fromIndex: colIndex,
          toIndex: colIndex - 1
        })
      } else if (actionId === 'right') {
        this.runAction({
          type: 'moveColumn',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          fromIndex: colIndex,
          toIndex: colIndex + 1
        })
      }
      return
    }

    if (!Number.isNaN(rowIndex)) {
      if (actionId === 'delete') {
        this.runAction({
          type: 'deleteRow',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          rowIndex
        })
      } else if (actionId === 'up') {
        this.runAction({
          type: 'moveRow',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          fromIndex: rowIndex,
          toIndex: rowIndex - 1
        })
      } else if (actionId === 'down') {
        this.runAction({
          type: 'moveRow',
          tableFrom: this.table.from,
          tableTo: this.table.to,
          fromIndex: rowIndex,
          toIndex: rowIndex + 1
        })
      }
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
    return this.rootEl ? EditorView.findFromDOM(this.rootEl) : null
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
