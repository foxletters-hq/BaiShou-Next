import type { CellLocation } from '../models/cellLocation'
import { DesktopTableSection } from '../models/desktopTableSection'
import { DesktopAutoScroller, outlineAutoScrollEnabled } from '../measurement/desktopAutoScroller'
import { cellAtPoint } from '../cellAtPoint'

const DRAG_THRESHOLD_PX = 4

export type DesktopOutlineCallbacks = {
  onOutlineStart: (anchor: CellLocation) => void
  onOutlineExpand: (section: DesktopTableSection) => void
  onOutlineEnd: (
    section: DesktopTableSection,
    dragged: boolean,
    lastPointer: { clientX: number; clientY: number }
  ) => void
  onBeforeOutlineDrag?: () => void
  getTableRoot: () => HTMLElement
  getScrollElements: () => { x: HTMLElement; y: HTMLElement }
}

/** ckant OutlineActions：矩形框选 */
export class DesktopOutlineSession {
  private readonly anchorCell: CellLocation
  private currentCell: CellLocation
  private dragging = false
  private removeListeners: (() => void) | null = null
  private readonly startedAt = Date.now()
  private autoScroller: DesktopAutoScroller | null = null
  private lastPointer = { clientX: 0, clientY: 0 }

  private readonly startX: number
  private readonly startY: number

  private constructor(
    private readonly tableRoot: HTMLElement,
    cellLocation: CellLocation,
    event: PointerEvent,
    private readonly callbacks: DesktopOutlineCallbacks,
    resizeMode: boolean
  ) {
    this.startX = event.clientX
    this.startY = event.clientY
    this.lastPointer = { clientX: event.clientX, clientY: event.clientY }
    this.anchorCell = { ...cellLocation }
    this.currentCell = { ...cellLocation }

    if (!resizeMode) {
      this.callbacks.onOutlineStart(this.anchorCell)
    }
    this.attachWindowListeners()
  }

  static start(
    tableRoot: HTMLElement,
    cellLocation: CellLocation,
    event: PointerEvent,
    callbacks: DesktopOutlineCallbacks,
    options?: { shiftKey?: boolean; existingAnchor?: CellLocation }
  ): DesktopOutlineSession {
    const session = new DesktopOutlineSession(
      tableRoot,
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
    const onUp = (e: PointerEvent) => this.end(e)
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
      this.end(event)
      return
    }

    this.lastPointer = { clientX: event.clientX, clientY: event.clientY }

    const dx = Math.abs(event.clientX - this.startX)
    const dy = Math.abs(event.clientY - this.startY)
    if (!this.dragging) {
      if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return
      this.dragging = true
      this.callbacks.onBeforeOutlineDrag?.()
      const scrollEls = this.callbacks.getScrollElements()
      this.autoScroller = DesktopAutoScroller.of({
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

    const cell = cellAtPoint(
      this.tableRoot,
      event.clientX,
      event.clientY,
      event.target instanceof Element ? event.target : null
    )
    if (!cell) return
    if (cell.row === this.currentCell.row && cell.col === this.currentCell.col) return
    this.currentCell = cell
    this.expandTo(cell)
  }

  private expandTo(boundary: CellLocation): void {
    const section = DesktopTableSection.fromAnchorHead(this.anchorCell, boundary)
    this.callbacks.onOutlineExpand(section)
  }

  private end(event: PointerEvent): void {
    this.lastPointer = { clientX: event.clientX, clientY: event.clientY }
    this.removeListeners?.()
    this.removeListeners = null
    this.autoScroller?.destroy()
    this.autoScroller = null
    const section = DesktopTableSection.fromAnchorHead(this.anchorCell, this.currentCell)
    this.callbacks.onOutlineEnd(section, this.dragging, this.lastPointer)
  }
}
