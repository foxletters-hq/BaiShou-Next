import { TableMeasurement } from './tableMeasurement'
import { TableSection, type CellLocation } from './tableSection'
import { TableAutoScroller, outlineAutoScrollEnabled } from './tableAutoScroller'

const DRAG_THRESHOLD_PX = 4

export type TableOutlineCallbacks = {
  onOutlineStart: (anchor: CellLocation) => void
  onOutlineExpand: (anchor: CellLocation, head: CellLocation, section: TableSection) => void
  onOutlineEnd: (anchor: CellLocation, head: CellLocation, section: TableSection, dragged: boolean) => void
  onBeforeOutlineDrag?: () => void
  getScrollOffset: () => { x: number; y: number }
  getScrollElements: () => { x: HTMLElement; y: HTMLElement }
}

/** 矩形框选拖拽（对齐 ckant OutlineActions） */
export class TableOutlineSession {
  private readonly tableElement: HTMLTableElement
  private readonly callbacks: TableOutlineCallbacks
  private readonly anchorCell: CellLocation
  private readonly shiftKey: boolean
  private readonly startX: number
  private readonly startY: number

  private currentCell: CellLocation
  private dragging = false
  private removeListeners: (() => void) | null = null
  private readonly startedAt = Date.now()
  private autoScroller: TableAutoScroller | null = null

  private constructor(
    tableElement: HTMLTableElement,
    cellLocation: CellLocation,
    event: PointerEvent,
    callbacks: TableOutlineCallbacks,
    private readonly resizeMode: boolean
  ) {
    this.tableElement = tableElement
    this.callbacks = callbacks
    this.anchorCell = { ...cellLocation }
    this.currentCell = { ...cellLocation }
    this.shiftKey = resizeMode
    this.startX = event.clientX
    this.startY = event.clientY

    if (!resizeMode) {
      this.callbacks.onOutlineStart(this.anchorCell)
    }
    this.attachWindowListeners()
  }

  static start(
    tableElement: HTMLTableElement,
    cellLocation: CellLocation,
    event: PointerEvent,
    callbacks: TableOutlineCallbacks,
    options?: { shiftKey?: boolean; existingAnchor?: CellLocation }
  ): TableOutlineSession {
    const session = new TableOutlineSession(
      tableElement,
      cellLocation,
      event,
      callbacks,
      Boolean(options?.shiftKey && options.existingAnchor)
    )
    if (options?.shiftKey && options.existingAnchor) {
      session.anchorCellOverride(options.existingAnchor)
      session.expandTo(cellLocation)
    }
    return session
  }

  private anchorCellOverride(anchor: CellLocation): void {
    Object.assign(this.anchorCell, anchor)
  }

  private attachWindowListeners(): void {
    const onMove = (e: PointerEvent) => this.onPointerMove(e)
    const onUp = () => this.end()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    this.removeListeners = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }

  private onPointerMove(event: PointerEvent): void {
    if (event.buttons !== 1) {
      this.end()
      return
    }

    const dx = Math.abs(event.clientX - this.startX)
    const dy = Math.abs(event.clientY - this.startY)
    if (!this.dragging) {
      if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return
      this.dragging = true
      this.callbacks.onBeforeOutlineDrag?.()
      const scrollEls = this.callbacks.getScrollElements()
      this.autoScroller = TableAutoScroller.of({
        offset: 10,
        maxScroll: 32,
        boundaryElement: scrollEls,
        scrollElement: scrollEls
      })
    }

    event.preventDefault()
    if (this.autoScroller && outlineAutoScrollEnabled(this.startedAt)) {
      this.autoScroller.updatePosition(event.clientX, event.clientY)
    }
    const scrollOffset = this.callbacks.getScrollOffset()
    const measurement = TableMeasurement.of(this.tableElement, scrollOffset)
    const cell = measurement.lastCellBeforePosition({
      x: event.clientX + scrollOffset.x,
      y: event.clientY + scrollOffset.y
    })

    if (cell.row === this.currentCell.row && cell.col === this.currentCell.col) return
    this.currentCell = cell
    this.expandTo(cell)
  }

  private expandTo(boundary: CellLocation): void {
    const section = TableSection.fromAnchorHead(this.anchorCell, boundary)
    this.callbacks.onOutlineExpand(this.anchorCell, boundary, section)
  }

  private end(): void {
    this.removeListeners?.()
    this.removeListeners = null
    this.autoScroller?.destroy()
    this.autoScroller = null
    const section = TableSection.fromAnchorHead(this.anchorCell, this.currentCell)
    this.callbacks.onOutlineEnd(this.anchorCell, this.currentCell, section, this.dragging)
  }
}
