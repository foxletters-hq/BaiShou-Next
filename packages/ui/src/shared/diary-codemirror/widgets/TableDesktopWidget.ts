import { WidgetType, type EditorView } from '@codemirror/view'
import type { ColumnAlignment } from '../table/tableGridModel'
import { type ParsedTable, tableContentSignature } from '../table/table.model'
import { parsedRowToDomRow } from '../table/desktop/models/cellLocation'
import {
  commitDesktopCellEditors,
  destroyDesktopTableSync,
  findDesktopRootView,
  syncAllDesktopTables
} from '../table/desktop/sync/desktopTableSync'
import { installHeaderHandleMove } from '../table/desktop/actions/desktopMoveSession'
import { installBorderHandleResize } from '../table/desktop/actions/desktopResizeSession'
import { installDesktopWidgetInteraction } from '../table/desktop/installDesktopWidgetInteraction'
import { invokeTableAction } from '../table/tableEffects'
import {
  buildColMenuSections,
  buildRowMenuSections,
  openTableCellContextMenu,
  runCellContextMenuAction,
  showTableContextMenu
} from '../table/tableContextMenu'
import {
  createCkantHorizontalGrip,
  createCkantPlusIcon,
  createCkantVerticalGrip,
  createTableGridIcon
} from './tableChromeIcons'
import { formatDesktopTableCellDisplay } from '../table/tableCellText'
import { copyTableMarkdownFromBlock, findCurrentTableRange } from '../table/tableDom'
import type { DiaryCmPlatform } from '../types'

const tableWidgetHeightCache = new Map<string, number>()

export class TableDesktopWidget extends WidgetType {
  private rootEl: HTMLElement | null = null
  private heightObserver: ResizeObserver | null = null
  private interactionTeardown: (() => void) | null = null
  private readonly heightCacheKey: string
  private readonly alignSignature: string

  constructor(
    private readonly table: ParsedTable,
    private readonly platform?: DiaryCmPlatform,
    private readonly columnAlignments: ColumnAlignment[] = []
  ) {
    super()
    this.heightCacheKey = `${table.from}:${table.to}:${table.columnCount}:${table.bodyRows.length}`
    this.alignSignature = columnAlignments.join(',')
  }

  eq(other: TableDesktopWidget): boolean {
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
    root.className = 'cm-table-block cm-table-block--desktop'
    root.dataset.interactionMode = 'mouse'
    root.dataset.tableFrom = String(this.table.from)
    root.dataset.tableTo = String(this.table.to)
    root.dataset.tblHoverable = 'true'
    root.dataset.tblHandlePosition = 'outside'

    const widget = document.createElement('div')
    widget.className = 'cm-tbl-widget'

    const scroll = document.createElement('div')
    scroll.className = 'cm-tbl-scroll'

    const shell = document.createElement('div')
    shell.className = 'cm-tbl-table-shell'

    const hscroll = document.createElement('div')
    hscroll.className = 'cm-tbl-hscroll'
    hscroll.appendChild(this.buildTableElement())

    shell.appendChild(hscroll)
    shell.appendChild(this.createTableMenuHandle())
    shell.appendChild(this.createTableAddHandle('col'))
    shell.appendChild(this.createTableAddHandle('row'))
    shell.appendChild(this.createTableCornerResizeHandle())

    scroll.appendChild(shell)
    widget.appendChild(scroll)
    root.appendChild(widget)

    this.interactionTeardown?.()
    this.interactionTeardown = installDesktopWidgetInteraction(root, this.table.from, () =>
      this.editorView()
    )

    requestAnimationFrame(() => {
      this.observeHeight(root)
      this.cacheWidgetHeight(root)
      this.wireDesktopHandles(root)
      const view = this.editorView()
      if (view) syncAllDesktopTables(view)
    })
    return root
  }

  ignoreEvent(event: Event): boolean {
    if (!this.rootEl) return false
    const target = event.target
    return target instanceof Node && this.rootEl.contains(target)
  }

  destroy(): void {
    this.interactionTeardown?.()
    this.interactionTeardown = null
    if (this.rootEl) destroyDesktopTableSync(this.rootEl)
    this.heightObserver?.disconnect()
    this.rootEl = null
  }

  private editorView(): EditorView | null {
    return this.rootEl ? findDesktopRootView(this.rootEl) : null
  }

  private buildTableElement(): HTMLTableElement {
    const tableEl = document.createElement('table')
    tableEl.className = 'cm-table-preview cm-tbl-table'
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

  private createCell(
    raw: string,
    parsedRow: number,
    colIndex: number,
    isHeader: boolean
  ): HTMLElement {
    const el = document.createElement(isHeader ? 'th' : 'td')
    el.className = `cm-table-grid-cell cm-tbl-cell ${isHeader ? 'cm-tbl-header-cell' : 'cm-tbl-data-cell'}`
    const domRow = parsedRowToDomRow(parsedRow)
    el.dataset.row = String(domRow)
    el.dataset.col = String(colIndex)
    el.dataset.border = 'top right bottom left'
    const align = this.columnAlignments[colIndex]
    if (align && align !== 'none') el.setAttribute('align', align)

    if (isHeader) {
      el.appendChild(this.createHeaderHandle('col', colIndex))
    }
    if (colIndex === 0) {
      el.appendChild(this.createHeaderHandle('row', parsedRow))
    }
    el.appendChild(this.createBorderHandle('col', colIndex + 1))
    el.appendChild(this.createBorderHandle('row', parsedRow + 1))

    el.appendChild(this.createCellContent(raw, domRow, colIndex))
    el.addEventListener(
      'contextmenu',
      (event) => {
        event.preventDefault()
        event.stopPropagation()
        const view = this.editorView()
        if (!view) return
        this.commitEditors()
        openTableCellContextMenu(
          view,
          this.table,
          parsedRow,
          colIndex,
          event.clientX,
          event.clientY
        )
      },
      true
    )
    return el
  }

  private createHeaderHandle(kind: 'col' | 'row', index: number): HTMLElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `cm-tbl-handle cm-tbl-handle--header cm-table-handle ${
      kind === 'col' ? 'cm-table-col-handle' : 'cm-table-row-handle'
    }`
    btn.dataset.type = 'header'
    btn.dataset.location = kind === 'col' ? 'col' : 'row'
    btn.setAttribute('aria-hidden', 'true')
    btn.tabIndex = -1
    if (kind === 'col') {
      btn.dataset.colIndex = String(index)
      btn.appendChild(createCkantHorizontalGrip())
      this.bindHeaderHandle(btn, 'col', index, () => buildColMenuSections(this.table, index))
    } else {
      btn.dataset.rowIndex = String(index)
      if (index < 0) btn.classList.add('cm-table-row-handle--header')
      btn.appendChild(createCkantVerticalGrip())
      this.bindHeaderHandle(btn, 'row', index, () => buildRowMenuSections(this.table, index))
    }
    return btn
  }

  private createBorderHandle(kind: 'col' | 'row', index: number): HTMLElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `cm-tbl-handle cm-tbl-handle--border-${kind === 'col' ? 'right' : 'bottom'} cm-table-handle`
    btn.dataset.type = 'border'
    btn.dataset.location = kind === 'col' ? 'col' : 'row'
    btn.dataset.borderIndex = String(index)
    btn.setAttribute('aria-hidden', 'true')
    btn.tabIndex = -1
    btn.dataset.desktopHandle = kind === 'col' ? 'border-col' : 'border-row'
    btn.dataset.handleIndex = String(kind === 'col' ? index : Math.max(0, index - 1))
    return btn
  }

  private bindHeaderHandle(
    btn: HTMLElement,
    kind: 'col' | 'row',
    index: number,
    sections: () => { items: { id: string; label: string }[] }[]
  ): void {
    btn.dataset.desktopHandle = kind === 'col' ? 'header-col' : 'header-row'
    btn.dataset.handleIndex = String(index)
    btn.dataset.menuSections = '1'
    ;(
      btn as HTMLElement & { __menuSections?: () => { items: { id: string; label: string }[] }[] }
    ).__menuSections = sections
  }

  private getScrollOffset(): { x: number; y: number } {
    const scrollHost = this.rootEl?.querySelector('.cm-tbl-scroll') as HTMLElement | null
    return { x: scrollHost?.scrollLeft ?? 0, y: 0 }
  }

  private createCellContent(raw: string, domRow: number, colIndex: number): HTMLElement {
    const inner = document.createElement('div')
    inner.className = 'cm-table-cell-inner'
    const viewEl = document.createElement('div')
    viewEl.className = 'cm-table-cell-view'
    viewEl.dataset.row = String(domRow)
    viewEl.dataset.col = String(colIndex)
    viewEl.textContent = formatDesktopTableCellDisplay(raw) || ''
    const source = document.createElement('div')
    source.className = 'cm-table-cell-source'
    source.hidden = true
    source.dataset.row = String(domRow)
    source.dataset.col = String(colIndex)
    source.dataset.raw = raw
    inner.appendChild(viewEl)
    inner.appendChild(source)
    return inner
  }

  private createTableMenuHandle(): HTMLElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cm-tbl-table-handle cm-tbl-table-handle--menu cm-table-corner-menu'
    btn.setAttribute('aria-label', '表格菜单')
    btn.appendChild(createTableGridIcon(2, 2))
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.commitEditors()
      const rect = btn.getBoundingClientRect()
      showTableContextMenu(
        [
          { id: 'copy-table', label: '复制表格' },
          { id: 'delete-table', label: '删除表格', destructive: true }
        ],
        rect.left,
        rect.bottom + 4,
        (id) => {
          if (id === 'copy-table') void this.copyTableMarkdown()
          else if (id === 'delete-table') {
            this.runAction({
              type: 'deleteTable',
              tableFrom: this.table.from,
              tableTo: this.table.to
            })
          }
        }
      )
    })
    return btn
  }

  private createTableAddHandle(kind: 'col' | 'row'): HTMLElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `cm-tbl-table-handle cm-tbl-table-handle--add-${kind} cm-table-add-btn cm-table-add-${kind === 'col' ? 'col' : 'row'}`
    btn.setAttribute('aria-label', kind === 'row' ? '添加行' : '添加列')
    btn.appendChild(createCkantPlusIcon(14))
    btn.dataset.desktopHandle = kind === 'col' ? 'table-right' : 'table-bottom'
    btn.dataset.handleIndex = String(
      kind === 'col' ? this.table.columnCount : this.table.bodyRows.length
    )
    return btn
  }

  private createTableCornerResizeHandle(): HTMLElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cm-tbl-table-handle cm-tbl-table-handle--corner cm-table-add-btn'
    btn.setAttribute('aria-label', '扩展表格')
    btn.appendChild(createCkantPlusIcon(12))
    btn.dataset.desktopHandle = 'table-corner'
    btn.dataset.handleIndex = '0'
    return btn
  }

  private wireDesktopHandles(root: HTMLElement): void {
    const view = this.editorView()
    if (!view) return
    const scrollOffset = () => this.getScrollOffset()
    root.querySelectorAll<HTMLElement>('[data-desktop-handle]').forEach((btn) => {
      const kind = btn.dataset.desktopHandle
      const index = Number(btn.dataset.handleIndex)
      if (kind === 'header-col' || kind === 'header-row') {
        const sections = (
          btn as HTMLElement & {
            __menuSections?: () => { items: { id: string; label: string }[] }[]
          }
        ).__menuSections
        const openMenu = () => {
          this.commitEditors()
          const rect = btn.getBoundingClientRect()
          showTableContextMenu(
            sections?.().flatMap((s) => s.items) ?? [],
            rect.left,
            rect.bottom + 4,
            (id) => this.runMenuAction(btn, id)
          )
        }
        installHeaderHandleMove(btn, {
          block: root,
          view,
          tableFrom: this.table.from,
          tableTo: this.table.to,
          rowOrCol: kind === 'header-col' ? 'col' : 'row',
          index,
          getScrollOffset: scrollOffset,
          onClickMenu: openMenu
        })
        return
      }
      if (
        kind === 'border-col' ||
        kind === 'border-row' ||
        kind === 'table-right' ||
        kind === 'table-bottom' ||
        kind === 'table-corner'
      ) {
        installBorderHandleResize(btn, {
          block: root,
          view,
          tableFrom: this.table.from,
          tableTo: this.table.to,
          kind,
          index,
          getScrollOffset: scrollOffset
        })
      }
    })
  }

  private runMenuAction(handle: HTMLElement, actionId: string): void {
    if (actionId === 'noop') return
    this.commitEditors()
    const view = this.editorView()
    const root = this.rootEl
    if (!view || !root) return
    const range = findCurrentTableRange(view, root)
    if (!range) return
    const colIndex = Number(handle.dataset.colIndex)
    const rowIndex = Number(handle.dataset.rowIndex)
    if (handle.classList.contains('cm-tbl-handle--header') && handle.dataset.location === 'col') {
      runCellContextMenuAction(view, range.from, range.to, -1, colIndex, actionId)
    } else {
      runCellContextMenuAction(view, range.from, range.to, rowIndex, 0, actionId)
    }
  }

  private runAction(action: Parameters<typeof invokeTableAction>[1]): void {
    const view = this.editorView()
    const root = this.rootEl
    if (!view || !root) return
    const range = findCurrentTableRange(view, root)
    if (!range) return
    invokeTableAction(view, { ...action, tableFrom: range.from, tableTo: range.to })
  }

  private commitEditors(): void {
    const root = this.rootEl
    const view = this.editorView()
    if (root && view) commitDesktopCellEditors(root, view)
  }

  private async copyTableMarkdown(): Promise<void> {
    this.commitEditors()
    const view = this.editorView()
    const root = this.rootEl
    if (!view || !root) return
    await copyTableMarkdownFromBlock(view, root)
  }

  private observeHeight(root: HTMLElement): void {
    const shell = root.querySelector('.cm-tbl-table-shell')
    if (!shell || typeof ResizeObserver === 'undefined') return
    this.heightObserver?.disconnect()
    this.heightObserver = new ResizeObserver(() => this.cacheWidgetHeight(root))
    this.heightObserver.observe(shell)
  }

  private cacheWidgetHeight(root: HTMLElement): void {
    const height = root.getBoundingClientRect().height
    if (height > 0) {
      const prev = tableWidgetHeightCache.get(this.heightCacheKey)
      tableWidgetHeightCache.set(this.heightCacheKey, height)
      if (prev !== height) this.editorView()?.requestMeasure()
    }
  }
}
