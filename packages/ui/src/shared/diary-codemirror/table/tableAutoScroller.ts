/** 拖拽靠近边缘时自动滚动（对齐 ckant AutoScroller） */
export type TableAutoScrollerProps = {
  offset?: number
  maxScroll: number
  boundaryElement: { x: HTMLElement; y: HTMLElement }
  scrollElement: { x: HTMLElement; y: HTMLElement }
}

export class TableAutoScroller {
  private readonly offset: number
  private readonly maxScroll: number
  private readonly boundaryElement: { x: HTMLElement; y: HTMLElement }
  private readonly scrollElement: { x: HTMLElement; y: HTMLElement }
  private handle: number | undefined
  private xAmount = 0
  private yAmount = 0

  private constructor({
    offset,
    maxScroll,
    boundaryElement,
    scrollElement
  }: TableAutoScrollerProps) {
    this.offset = offset ?? 0
    this.maxScroll = maxScroll
    this.boundaryElement = boundaryElement
    this.scrollElement = scrollElement
  }

  static of(props: TableAutoScrollerProps): TableAutoScroller {
    return new TableAutoScroller(props)
  }

  updatePosition(x: number, y: number): void {
    const xBoundary = this.boundaryElement.x.getBoundingClientRect()
    if (x < xBoundary.left + this.offset) {
      this.xAmount = -Math.min(this.maxScroll, this.offset + (xBoundary.left - x))
    } else if (x > xBoundary.right - this.offset) {
      this.xAmount = Math.min(this.maxScroll, this.offset - (xBoundary.right - x))
    } else {
      this.xAmount = 0
    }

    const yBoundary = this.boundaryElement.y.getBoundingClientRect()
    if (y < yBoundary.top + this.offset) {
      this.yAmount = -Math.min(this.maxScroll, this.offset + (yBoundary.top - y))
    } else if (y > yBoundary.bottom - this.offset) {
      this.yAmount = Math.min(this.maxScroll, this.offset - (yBoundary.bottom - y))
    } else {
      this.yAmount = 0
    }

    if (this.xAmount !== 0 || this.yAmount !== 0) {
      this.scheduleScroll()
    }
  }

  destroy(): void {
    if (this.handle != null) cancelAnimationFrame(this.handle)
    this.handle = undefined
  }

  private scheduleScroll(): void {
    if (this.handle != null) return
    this.handle = requestAnimationFrame(() => {
      this.handle = undefined
      if (this.xAmount === 0 && this.yAmount === 0) return
      this.scrollElement.x.scrollBy({ left: this.xAmount })
      this.scrollElement.y.scrollBy({ top: this.yAmount })
      this.scheduleScroll()
    })
  }
}

/** outline 拖拽 500ms 后才启用自动滚动，避免误触 */
export function outlineAutoScrollEnabled(startedAt: number, delayMs = 500): boolean {
  return Date.now() - startedAt >= delayMs
}
