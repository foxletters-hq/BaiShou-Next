import { type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { logDiaryBridge } from '../diaryBridgeDebug'

export interface TouchSelectionProbeTouch {
  clientX: number
  clientY: number
  durationMs?: number
}

function nodeLabel(node: Node | null): string {
  if (!node) return '(null)'
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    const preview = text.length > 24 ? `${text.slice(0, 24)}…` : text
    return `text:"${preview}"`
  }
  if (node instanceof Element) {
    return node.className ? `${node.tagName.toLowerCase()}.${String(node.className).slice(0, 32)}` : node.tagName.toLowerCase()
  }
  return `node#${node.nodeType}`
}

function safePosAtDom(view: EditorView, node: Node | null, offset: number): number | null {
  if (!node || !view.contentDOM.contains(node)) return null
  try {
    const pos = view.posAtDOM(node, offset)
    return pos >= 0 ? pos : null
  } catch {
    return null
  }
}

function sliceAround(doc: string, pos: number, radius = 24): string {
  const safe = Math.max(0, Math.min(pos, doc.length))
  const from = Math.max(0, safe - radius)
  const to = Math.min(doc.length, safe + radius)
  return doc.slice(from, to)
}

/** 采集 DOM 选区、CM 选区、触摸坐标落点，用于对比长按高亮错位 */
export function captureSelectionSnapshot(
  view: EditorView,
  reason: string,
  touch?: TouchSelectionProbeTouch
) {
  const doc = view.state.doc.toString()
  const { from: cmFrom, to: cmTo, head: cmHead } = view.state.selection.main
  const cmText = view.state.sliceDoc(cmFrom, cmTo)

  const domSel = view.dom.ownerDocument.getSelection()
  const domCollapsed = !domSel || domSel.isCollapsed
  const domText = domSel?.toString() ?? ''

  const cmFromDomAnchor = domSel ? safePosAtDom(view, domSel.anchorNode, domSel.anchorOffset) : null
  const cmFromDomFocus = domSel ? safePosAtDom(view, domSel.focusNode, domSel.focusOffset) : null

  let posAtCoords: number | null = null
  let posAtCoordsPrecise: number | null = null
  if (touch) {
    posAtCoords = view.posAtCoords({ x: touch.clientX, y: touch.clientY }, false)
    posAtCoordsPrecise = view.posAtCoords({ x: touch.clientX, y: touch.clientY }, true as false)
  }

  const anchorPos = posAtCoords ?? cmFromDomAnchor ?? cmHead
  const mismatch =
    domText.length > 0 &&
    (domText !== cmText ||
      (cmFromDomAnchor != null && cmFromDomAnchor !== cmFrom) ||
      (cmFromDomFocus != null && cmFromDomFocus !== cmTo))

  let lineAtCoords: number | undefined
  if (posAtCoords != null) {
    try {
      lineAtCoords = view.state.doc.lineAt(posAtCoords).number
    } catch {
      lineAtCoords = undefined
    }
  }

  return {
    reason,
    touchMs: touch?.durationMs,
    clientX: touch?.clientX,
    clientY: touch?.clientY,
    posAtCoords,
    posAtCoordsPrecise,
    lineAtCoords,
    docSliceAtCoords: posAtCoords != null ? sliceAround(doc, posAtCoords) : undefined,
    domCollapsed,
    domText,
    domTextLen: domText.length,
    domAnchorOffset: domSel?.anchorOffset,
    domFocusOffset: domSel?.focusOffset,
    domAnchorNode: nodeLabel(domSel?.anchorNode ?? null),
    domFocusNode: nodeLabel(domSel?.focusNode ?? null),
    cmFrom,
    cmTo,
    cmHead,
    cmText,
    cmFromDomAnchor,
    cmFromDomFocus,
    docSliceCm: cmFrom !== cmTo || cmText ? sliceAround(doc, cmFrom) : sliceAround(doc, cmHead),
    mismatch
  }
}

export function logTouchSelectionProbe(
  view: EditorView,
  reason: string,
  touch?: TouchSelectionProbeTouch
): void {
  logDiaryBridge('selectDbg', reason, captureSelectionSnapshot(view, reason, touch))
}

/** 触摸结束后分阶段采样，观察系统选区何时稳定 */
export function scheduleSelectionProbesAfterTouch(
  view: EditorView,
  touch: TouchSelectionProbeTouch
): void {
  for (const delayMs of [0, 80, 200, 400]) {
    window.setTimeout(() => {
      logTouchSelectionProbe(view, `afterTouch+${delayMs}ms`, touch)
    }, delayMs)
  }
}

/** 触摸端：DOM selectionchange + CM selectionSet 对比日志（仅 __DEV__） */
export function touchSelectionDebugPlugin(): Extension {
  return ViewPlugin.fromClass(
    class {
      private domSelectionTimer: ReturnType<typeof setTimeout> | null = null

      constructor(private readonly view: EditorView) {
        document.addEventListener('selectionchange', this.onDomSelectionChange)
      }

      destroy(): void {
        document.removeEventListener('selectionchange', this.onDomSelectionChange)
        if (this.domSelectionTimer != null) clearTimeout(this.domSelectionTimer)
      }

      private readonly onDomSelectionChange = (): void => {
        const sel = document.getSelection()
        if (!sel?.anchorNode || !this.view.contentDOM.contains(sel.anchorNode)) return
        if (this.domSelectionTimer != null) clearTimeout(this.domSelectionTimer)
        this.domSelectionTimer = setTimeout(() => {
          this.domSelectionTimer = null
          logTouchSelectionProbe(this.view, 'dom-selectionchange')
        }, 40)
      }
    },
    {
      eventHandlers: {
        touchstart(event, view) {
          const touch = event.touches[0]
          if (!touch) return false
          logTouchSelectionProbe(view, 'touchstart', {
            clientX: touch.clientX,
            clientY: touch.clientY
          })
          return false
        },
        touchend(event, view) {
          const touch = event.changedTouches[0]
          if (!touch) return false
          logTouchSelectionProbe(view, 'touchend-sync', {
            clientX: touch.clientX,
            clientY: touch.clientY
          })
          return false
        }
      }
    }
  )
}
