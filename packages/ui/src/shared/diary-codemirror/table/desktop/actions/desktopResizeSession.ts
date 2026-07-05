import type { EditorView } from '@codemirror/view'
import { invokeTableAction } from '../../tableEffects'
import { DesktopTableMeasurement } from '../measurement/desktopTableMeasurement'
import { DesktopAutoScroller, outlineAutoScrollEnabled } from '../measurement/desktopAutoScroller'
import {
  insertGridColsAt,
  insertGridRowsAt,
  isGridColEmpty,
  isGridRowEmpty,
  removeGridColsAt,
  removeGridRowsAt,
  type TableGridModel
} from '../../tableGridModel'
import { readTableGridFromDesktopBlock } from '../readDesktopGrid'
import { commitDesktopGridToDoc } from '../tableDescription'
import { beginDesktopTableBlocking, syncDesktopBlockingOverlay } from '../desktopInteractiveState'

const DRAG_THRESHOLD = 4

export type ResizeHandleKind = 'border-row' | 'border-col' | 'table-right' | 'table-bottom' | 'table-corner'

export type ResizeSessionOptions = {
  block: HTMLElement
  view: EditorView
  tableFrom: number
  tableTo: number
  kind: ResizeHandleKind
  index: number
  event: PointerEvent
  getScrollOffset: () => { x: number; y: number }
}

export class DesktopResizeSession {
  private readonly startX: number
  private readonly startY: number
  private dragging = false
  private endBlocking: (() => void) | null = null
  private autoScroller: DesktopAutoScroller | null = null
  private readonly startedAt = Date.now()
  private initialRowCount = 0
  private initialColCount = 0
  private liveGrid: TableGridModel | null = null
  private removeListeners: (() => void) | null = null

  private constructor(private readonly opts: ResizeSessionOptions) {
    this.startX = opts.event.clientX
    this.startY = opts.event.clientY
    const grid = readTableGridFromDesktopBlock(opts.block)
    if (grid) {
      this.liveGrid = grid
      this.initialRowCount = 1 + grid.rows.length
      this.initialColCount = grid.header.length
    }
    this.attach()
  }

  static start(opts: ResizeSessionOptions): DesktopResizeSession {
    return new DesktopResizeSession(opts)
  }

  private attach(): void {
    const onMove = (e: PointerEvent) => this.onMove(e)
    const onUp = (e: PointerEvent) => this.onUp(e)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    this.removeListeners = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    this.endBlocking = beginDesktopTableBlocking()
    syncDesktopBlockingOverlay(this.opts.block)
  }

  private detach(): void {
    this.removeListeners?.()
    this.removeListeners = null
    this.endBlocking?.()
    this.endBlocking = null
    this.autoScroller?.destroy()
    syncDesktopBlockingOverlay(this.opts.block)
  }

  private onMove(event: PointerEvent): void {
    if (event.buttons !== 1) {
      this.onUp(event)
      return
    }
    const dx = Math.abs(event.clientX - this.startX)
    const dy = Math.abs(event.clientY - this.startY)
    if (!this.dragging) {
      if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return
      this.dragging = true
      const scrollHost = this.opts.block.querySelector('.cm-tbl-scroll') as HTMLElement
      this.autoScroller = DesktopAutoScroller.of({
        offset: 10,
        maxScroll: 32,
        boundaryElement: { x: scrollHost, y: this.opts.view.scrollDOM },
        scrollElement: { x: scrollHost, y: this.opts.view.scrollDOM }
      })
    }
    if (this.autoScroller && outlineAutoScrollEnabled(this.startedAt)) {
      this.autoScroller.updatePosition(event.clientX, event.clientY)
    }
    this.applyDragDelta(event)
  }

  private onUp(_event: PointerEvent): void {
    this.detach()
    if (!this.dragging) {
      this.applyClick()
      return
    }
    const grid = this.liveGrid
    if (grid) {
      commitDesktopGridToDoc(this.opts.view, this.opts.tableFrom, grid)
    }
  }

  private applyClick(): void {
    const { view, tableFrom, tableTo, kind, index } = this.opts
    if (kind === 'border-row' || kind === 'table-bottom' || kind === 'table-corner') {
      invokeTableAction(view, {
        type: 'addRow',
        tableFrom,
        tableTo,
        atIndex: kind === 'border-row' ? Math.max(0, index) : undefined
      })
    }
    if (kind === 'border-col' || kind === 'table-right' || kind === 'table-corner') {
      invokeTableAction(view, {
        type: 'addColumn',
        tableFrom,
        tableTo,
        atIndex: kind === 'border-col' ? index : undefined
      })
    }
  }

  private applyDragDelta(event: PointerEvent): void {
    const grid = this.liveGrid ?? readTableGridFromDesktopBlock(this.opts.block)
    if (!grid) return
    this.liveGrid = grid
    const tableEl = this.opts.block.querySelector('.cm-table-preview') as HTMLTableElement | null
    if (!tableEl) return
    const measure = DesktopTableMeasurement.of(tableEl, this.opts.getScrollOffset())
    const rowDelta = this.calcDelta(event.clientY - this.startY, measure.rows[0]?.size ?? 28)
    const colDelta = this.calcDelta(event.clientX - this.startX, measure.cols[0]?.size ?? 80)
    const kind = this.opts.kind
    if (kind === 'border-row' || kind === 'table-bottom' || kind === 'table-corner') {
      this.applyRowDelta(grid, rowDelta)
    }
    if (kind === 'border-col' || kind === 'table-right' || kind === 'table-corner') {
      this.applyColDelta(grid, colDelta)
    }
  }

  private calcDelta(movement: number, cellSize: number): number {
    const full = Math.trunc(movement / cellSize)
    const rem = Math.abs(movement % cellSize)
    return full + (rem >= cellSize / 2 ? Math.sign(movement) : 0)
  }

  private applyRowDelta(grid: TableGridModel, delta: number): void {
    const current = 1 + grid.rows.length
    const diff = this.initialRowCount + delta - current
    if (diff === 0) return
    const index = Math.max(0, this.opts.index)
    if (diff > 0) insertGridRowsAt(grid, index, diff)
    else this.removeEmptyRows(grid, index, -diff)
  }

  private applyColDelta(grid: TableGridModel, delta: number): void {
    const diff = this.initialColCount + delta - grid.header.length
    if (diff === 0) return
    const index = this.opts.index
    if (diff > 0) insertGridColsAt(grid, index, diff)
    else this.removeEmptyCols(grid, index, -diff)
  }

  private removeEmptyRows(grid: TableGridModel, start: number, max: number): void {
    let removed = 0
    for (let i = start - 1; i >= 0 && removed < max; i -= 1) {
      if (!isGridRowEmpty(grid, i)) break
      removeGridRowsAt(grid, i, 1)
      removed += 1
    }
  }

  private removeEmptyCols(grid: TableGridModel, start: number, max: number): void {
    let removed = 0
    for (let i = start - 1; i >= 0 && removed < max; i -= 1) {
      if (!isGridColEmpty(grid, i)) break
      removeGridColsAt(grid, i, 1)
      removed += 1
    }
  }
}

export function installBorderHandleResize(
  btn: HTMLElement,
  opts: Omit<ResizeSessionOptions, 'event'>
): void {
  btn.addEventListener('pointerdown', (event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    DesktopResizeSession.start({ ...opts, event })
  })
}
