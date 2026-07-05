import type { EditorView } from '@codemirror/view'
import { invokeTableAction } from '../../tableEffects'
import { DesktopTableMeasurement } from '../measurement/desktopTableMeasurement'
import { DesktopAutoScroller, outlineAutoScrollEnabled } from '../measurement/desktopAutoScroller'
import { beginDesktopTableBlocking, syncDesktopBlockingOverlay } from '../desktopInteractiveState'

const DRAG_THRESHOLD = 4

export type MoveSessionOptions = {
  block: HTMLElement
  view: EditorView
  tableFrom: number
  tableTo: number
  rowOrCol: 'row' | 'col'
  index: number
  event: PointerEvent
  getScrollOffset: () => { x: number; y: number }
  onClickMenu: () => void
}

export class DesktopMoveSession {
  private readonly startX: number
  private readonly startY: number
  private dragging = false
  private currentIndex: number
  private endBlocking: (() => void) | null = null
  private autoScroller: DesktopAutoScroller | null = null
  private readonly startedAt = Date.now()
  private removeListeners: (() => void) | null = null

  private constructor(private readonly opts: MoveSessionOptions) {
    this.startX = opts.event.clientX
    this.startY = opts.event.clientY
    this.currentIndex = opts.index
    this.attach()
  }

  static start(opts: MoveSessionOptions): DesktopMoveSession {
    return new DesktopMoveSession(opts)
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
    this.endBlocking?.()
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
    this.updateSlot(event)
  }

  private onUp(_event: PointerEvent): void {
    const { view, tableFrom, tableTo, rowOrCol, index } = this.opts
    this.detach()
    if (!this.dragging) {
      this.opts.onClickMenu()
      return
    }
    if (this.currentIndex === index) return
    if (rowOrCol === 'row' && index >= 0) {
      invokeTableAction(view, {
        type: 'moveRow',
        tableFrom,
        tableTo,
        fromIndex: index,
        toIndex: this.currentIndex
      })
    } else if (rowOrCol === 'col') {
      invokeTableAction(view, {
        type: 'moveColumn',
        tableFrom,
        tableTo,
        fromIndex: index,
        toIndex: this.currentIndex
      })
    }
  }

  private updateSlot(event: PointerEvent): void {
    const tableEl = this.opts.block.querySelector('.cm-table-preview') as HTMLTableElement | null
    if (!tableEl) return
    const measure = DesktopTableMeasurement.of(tableEl, this.opts.getScrollOffset())
    const coord = this.opts.rowOrCol === 'row' ? event.clientY : event.clientX
    const sizes = this.opts.rowOrCol === 'row' ? measure.rows : measure.cols
    let best = this.currentIndex
    let bestDist = Infinity
    sizes.forEach((seg, i) => {
      const mid = seg.start + seg.size / 2
      const d = Math.abs(coord - mid)
      if (d < bestDist) {
        bestDist = d
        best = this.opts.rowOrCol === 'row' ? i - 1 : i
      }
    })
    if (this.opts.rowOrCol === 'row') {
      this.currentIndex = Math.max(-1, Math.min(measure.lastRowIndex - 1, best))
    } else {
      this.currentIndex = Math.max(0, Math.min(measure.lastColIndex, best))
    }
  }
}

export function installHeaderHandleMove(
  btn: HTMLElement,
  opts: Omit<MoveSessionOptions, 'event'>
): void {
  btn.addEventListener('pointerdown', (event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    DesktopMoveSession.start({ ...opts, event })
  })
}
