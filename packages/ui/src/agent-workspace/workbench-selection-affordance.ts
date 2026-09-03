import type { Extension } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'

export type WorkbenchSelectionAffordancePlacement = 'above' | 'below'

export type WorkbenchSelectionAffordanceState = {
  key: string
  startLine: number
  endLine: number
  left: number
  top: number
  /** 选区最后一个可见字符的右下角，供评论浮层锚定，不跟随鼠标。 */
  endLeft: number
  endTop: number
  placement: WorkbenchSelectionAffordancePlacement
}

const SHOW_DELAY_MS = 240
const POPOVER_WIDTH_PX = 230
const POPOVER_HEIGHT_PX = 38
const POPOVER_GAP_PX = 8
const VIEWPORT_PADDING_PX = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function selectionKey(view: EditorView): string | null {
  const { from, to } = view.state.selection.main
  return from === to ? null : `${from}:${to}`
}

export function resolveWorkbenchSelectionAffordancePosition(params: {
  coords: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left'>
  editorRect: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left'>
  windowWidth: number
  windowHeight: number
  pointsUp: boolean
}): Pick<WorkbenchSelectionAffordanceState, 'left' | 'top' | 'placement'> | null {
  const { coords, editorRect, windowWidth, windowHeight, pointsUp } = params
  const endpointVisible =
    coords.bottom >= editorRect.top &&
    coords.top <= editorRect.bottom &&
    coords.right >= editorRect.left &&
    coords.left <= editorRect.right
  if (!endpointVisible) return null

  const viewportRight = Math.min(editorRect.right, windowWidth)
  const viewportBottom = Math.min(editorRect.bottom, windowHeight)
  const minLeft = Math.max(VIEWPORT_PADDING_PX, editorRect.left + VIEWPORT_PADDING_PX)
  const maxLeft = viewportRight - POPOVER_WIDTH_PX - VIEWPORT_PADDING_PX
  const fitsBelow =
    !pointsUp &&
    coords.bottom + POPOVER_GAP_PX + POPOVER_HEIGHT_PX <= viewportBottom - VIEWPORT_PADDING_PX

  return {
    left: clamp(coords.left, minLeft, maxLeft),
    top: fitsBelow ? coords.bottom + POPOVER_GAP_PX : coords.top - POPOVER_GAP_PX,
    placement: fitsBelow ? 'below' : 'above'
  }
}

export function resolveWorkbenchSelectionAffordance(
  view: EditorView
): WorkbenchSelectionAffordanceState | null {
  if (!view.hasFocus) return null

  if (view.state.selection.ranges.length !== 1) return null
  const selection = view.state.selection.main
  const { from, to, head } = selection
  if (from === to || !view.state.sliceDoc(from, to).trim()) return null

  const pointsUp = head === from
  const coords = view.coordsAtPos(head, pointsUp ? -1 : 1)
  if (!coords) return null

  const editorRect = view.scrollDOM.getBoundingClientRect()
  const position = resolveWorkbenchSelectionAffordancePosition({
    coords,
    editorRect,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    pointsUp
  })
  if (!position) return null

  const lastChar = Math.max(from, to - 1)
  const startLine = view.state.doc.lineAt(from).number
  const endLine = view.state.doc.lineAt(lastChar).number
  const endCoords = view.coordsAtPos(lastChar, 1) ?? view.coordsAtPos(Math.max(from, to), -1)

  return {
    key: `${from}:${to}`,
    startLine: Math.min(startLine, endLine),
    endLine: Math.max(startLine, endLine),
    endLeft: endCoords?.right ?? position.left,
    endTop: endCoords?.bottom ?? position.top,
    ...position
  }
}

/**
 * 跟随非空文本选区发布浮层位置。选区拖动结束后短暂延迟显示，
 * 避免用户仍在调整范围时反复闪动。
 */
export function workbenchSelectionAffordance(
  onChange: (state: WorkbenchSelectionAffordanceState | null) => void
): Extension {
  return ViewPlugin.fromClass(
    class {
      private timer: ReturnType<typeof setTimeout> | null = null
      private suppressedKey: string | null = null

      constructor(private readonly view: EditorView) {
        this.view.scrollDOM.addEventListener('scroll', this.handleGeometryChange, {
          passive: true
        })
        this.view.dom.addEventListener('contextmenu', this.handleContextMenu)
        window.addEventListener('resize', this.handleGeometryChange)
      }

      update(update: ViewUpdate): void {
        if (update.selectionSet) {
          const key = selectionKey(update.view)
          if (key !== this.suppressedKey) this.suppressedKey = null
          this.schedule(SHOW_DELAY_MS)
          return
        }
        if (
          update.docChanged ||
          update.focusChanged ||
          update.viewportChanged ||
          update.geometryChanged
        ) {
          if (update.focusChanged && !update.view.hasFocus) {
            this.suppressedKey = selectionKey(update.view)
          }
          this.schedule(0)
        }
      }

      destroy(): void {
        this.clearTimer()
        this.view.scrollDOM.removeEventListener('scroll', this.handleGeometryChange)
        this.view.dom.removeEventListener('contextmenu', this.handleContextMenu)
        window.removeEventListener('resize', this.handleGeometryChange)
        onChange(null)
      }

      private readonly handleGeometryChange = (): void => {
        this.schedule(0)
      }

      private readonly handleContextMenu = (): void => {
        this.suppressedKey = selectionKey(this.view)
        this.clearTimer()
        onChange(null)
      }

      private clearTimer(): void {
        if (this.timer) clearTimeout(this.timer)
        this.timer = null
      }

      private schedule(delay: number): void {
        this.clearTimer()
        this.timer = setTimeout(() => {
          this.timer = null
          const key = selectionKey(this.view)
          if (key && key === this.suppressedKey) {
            onChange(null)
            return
          }
          onChange(resolveWorkbenchSelectionAffordance(this.view))
        }, delay)
      }
    }
  )
}
